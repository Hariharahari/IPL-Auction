'use client';

import {
  Room,
  RoomEvent,
  RemoteTrack,
  Track,
  RemoteAudioTrack,
  RemoteVideoTrack,
  LocalTrackPublication,
  RemoteParticipant,
  Participant,
} from 'livekit-client';
import { FranchiseCode } from '@/types/auction';
import { MicRouting } from '@/store/auctionStore';
import { getCurrentMediaStream } from '@/lib/mediaStream';
import { useEffect, useState } from 'react';

interface ConnectOptions {
  roomCode: string;
  userId: string;
  userName: string;
  role: string;
  franchiseCode?: FranchiseCode | null;
}

type VideoTracksListener = (tracks: Map<string, RemoteVideoTrack>) => void;
type SpeakersListener = (speakers: string[]) => void;

class LiveKitClientService {
  private mainRoom: Room | null = null;
  private teamRoom: Room | null = null;
  private remoteVideoTracks = new Map<string, RemoteVideoTrack>();
  private remoteAudioElements = new Map<string, HTMLAudioElement>();
  private videoListeners = new Set<VideoTracksListener>();
  private speakerListeners = new Set<SpeakersListener>();
  private publishedVideoTrack: LocalTrackPublication | null = null;
  private currentMicRoute: MicRouting = 'MUTED';
  private isConnecting = false;
  private currentRoomCode: string | null = null;
  private currentUserId: string | null = null;

  public isConnected(): boolean {
    return !!this.mainRoom && this.mainRoom.state === 'connected';
  }

  public getRemoteVideoTrack(userId: string): RemoteVideoTrack | undefined {
    return this.remoteVideoTracks.get(userId);
  }

  public getRemoteVideoTracks(): Map<string, RemoteVideoTrack> {
    return new Map(this.remoteVideoTracks);
  }

  public subscribeVideoTracks(listener: VideoTracksListener): () => void {
    this.videoListeners.add(listener);
    listener(new Map(this.remoteVideoTracks));
    return () => {
      this.videoListeners.delete(listener);
    };
  }

  public subscribeActiveSpeakers(listener: SpeakersListener): () => void {
    this.speakerListeners.add(listener);
    return () => {
      this.speakerListeners.delete(listener);
    };
  }

  private notifyVideoListeners() {
    const copy = new Map(this.remoteVideoTracks);
    this.videoListeners.forEach((l) => {
      try {
        l(copy);
      } catch (err) {
        console.warn('[LiveKit] video listener error:', err);
      }
    });
  }

  private notifySpeakerListeners(speakers: string[]) {
    this.speakerListeners.forEach((l) => {
      try {
        l(speakers);
      } catch (err) {
        console.warn('[LiveKit] speaker listener error:', err);
      }
    });
  }

  public async connect(opts: ConnectOptions): Promise<void> {
    if (typeof window === 'undefined') return;

    // Avoid duplicate connection to the same room
    if (
      this.isConnected() &&
      this.currentRoomCode === opts.roomCode &&
      this.currentUserId === opts.userId
    ) {
      return;
    }

    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      this.cleanup();
      this.currentRoomCode = opts.roomCode;
      this.currentUserId = opts.userId;

      console.log(`[LiveKit] Requesting tokens for room ${opts.roomCode}, user ${opts.userId}...`);
      const res = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: opts.roomCode,
          userId: opts.userId,
          userName: opts.userName,
          role: opts.role,
          franchiseCode: opts.franchiseCode,
        }),
      });

      if (!res.ok) {
        console.warn('[LiveKit] Token request failed with status:', res.status);
        return;
      }

      const data = await res.json();
      if (data.demoMode || !data.serverUrl || !data.mainToken) {
        console.info('[LiveKit] Running in Demo Mode (keys unconfigured or simulated):', data.message);
        return;
      }

      // 1. Initialize Main Stage Room
      const main = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      this.mainRoom = main;

      main.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, pub, participant: RemoteParticipant) => {
        console.log(`[LiveKit Main] Track subscribed: ${track.kind} from ${participant.identity}`);
        if (track.kind === Track.Kind.Video) {
          this.remoteVideoTracks.set(participant.identity, track as RemoteVideoTrack);
          this.notifyVideoListeners();
        } else if (track.kind === Track.Kind.Audio) {
          const audioEl = (track as RemoteAudioTrack).attach() as HTMLAudioElement;
          if (track.sid) {
            audioEl.id = `lk-audio-main-${track.sid}`;
            this.remoteAudioElements.set(track.sid, audioEl);
          }
          audioEl.style.display = 'none';
          document.body.appendChild(audioEl);
          audioEl.play().catch(() => {});
        }
      });

      main.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, pub, participant: RemoteParticipant) => {
        console.log(`[LiveKit Main] Track unsubscribed: ${track.kind} from ${participant.identity}`);
        if (track.kind === Track.Kind.Video) {
          this.remoteVideoTracks.delete(participant.identity);
          this.notifyVideoListeners();
        } else if (track.kind === Track.Kind.Audio) {
          track.detach();
          if (track.sid) {
            const el = document.getElementById(`lk-audio-main-${track.sid}`);
            if (el && el.parentNode) {
              el.parentNode.removeChild(el);
            }
            this.remoteAudioElements.delete(track.sid);
          }
        }
      });

      main.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        const identities = speakers.map((s) => s.identity);
        this.notifySpeakerListeners(identities);
      });

      main.on(RoomEvent.Disconnected, () => {
        console.log('[LiveKit Main] Disconnected from room');
      });

      await main.connect(data.serverUrl, data.mainToken);
      console.log(`[LiveKit Main] Connected to ${main.name} as ${opts.userId}`);

      // Auto-publish video if current local stream is already running
      const currentStream = getCurrentMediaStream();
      if (currentStream) {
        const videoTrack = currentStream.getVideoTracks()[0];
        if (videoTrack) {
          this.publishVideoTrack(videoTrack).catch((err) => {
            console.warn('[LiveKit] Auto video publish notice:', err);
          });
        }
      }

      // 2. Initialize Private Team Huddle Room (if teamToken provided)
      if (data.teamToken) {
        const team = new Room();
        this.teamRoom = team;

        team.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
          if (track.kind === Track.Kind.Audio) {
            const audioEl = (track as RemoteAudioTrack).attach() as HTMLAudioElement;
            if (track.sid) {
              audioEl.id = `lk-audio-team-${track.sid}`;
            }
            audioEl.style.display = 'none';
            document.body.appendChild(audioEl);
            audioEl.play().catch(() => {});
          }
        });

        team.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
          if (track.kind === Track.Kind.Audio) {
            track.detach();
            if (track.sid) {
              const el = document.getElementById(`lk-audio-team-${track.sid}`);
              if (el && el.parentNode) {
                el.parentNode.removeChild(el);
              }
            }
          }
        });

        team.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
          // Acoustic ducking: duck main room audio to 25% when teammate speaks
          const isTeamSpeaking = speakers.length > 0;
          this.remoteAudioElements.forEach((el) => {
            el.volume = isTeamSpeaking ? 0.25 : 1.0;
          });
        });

        await team.connect(data.serverUrl, data.teamToken);
        console.log(`[LiveKit Team] Connected to private huddle as ${opts.userId}`);
      }

      // Re-apply microphone route
      await this.setMicRoute(this.currentMicRoute);
    } catch (err) {
      console.warn('[LiveKit] Connection error:', err);
    } finally {
      this.isConnecting = false;
    }
  }

  public async publishVideoTrack(mediaStreamTrack: MediaStreamTrack): Promise<void> {
    if (!this.mainRoom || this.mainRoom.state !== 'connected') {
      return;
    }

    try {
      if (this.publishedVideoTrack) {
        await this.mainRoom.localParticipant.unpublishTrack(this.publishedVideoTrack.track!);
        this.publishedVideoTrack = null;
      }

      const publication = await this.mainRoom.localParticipant.publishTrack(mediaStreamTrack, {
        name: 'camera',
        source: Track.Source.Camera,
      });

      this.publishedVideoTrack = publication;
      console.log('[LiveKit] Published video track successfully');
    } catch (err) {
      console.warn('[LiveKit] Publish video track notice:', err);
    }
  }

  public async publishCurrentStream(): Promise<void> {
    const stream = getCurrentMediaStream();
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      await this.publishVideoTrack(videoTrack);
    }
  }

  public async unpublishVideoTrack(): Promise<void> {
    if (!this.mainRoom || !this.publishedVideoTrack) return;

    try {
      if (this.publishedVideoTrack.track) {
        await this.mainRoom.localParticipant.unpublishTrack(this.publishedVideoTrack.track);
      }
      this.publishedVideoTrack = null;
      console.log('[LiveKit] Unpublished video track');
    } catch (err) {
      console.warn('[LiveKit] Unpublish video track notice:', err);
    }
  }

  public async setMicRoute(target: MicRouting): Promise<void> {
    this.currentMicRoute = target;

    try {
      const main = this.mainRoom;
      const team = this.teamRoom;

      if (target === 'MUTED') {
        if (main && main.state === 'connected') {
          await main.localParticipant.setMicrophoneEnabled(false).catch(() => {});
        }
        if (team && team.state === 'connected') {
          await team.localParticipant.setMicrophoneEnabled(false).catch(() => {});
        }
      } else if (target === 'TEAM') {
        if (main && main.state === 'connected') {
          await main.localParticipant.setMicrophoneEnabled(false).catch(() => {});
        }
        if (team && team.state === 'connected') {
          await team.localParticipant.setMicrophoneEnabled(true).catch(() => {});
        }
      } else if (target === 'MAIN') {
        if (team && team.state === 'connected') {
          await team.localParticipant.setMicrophoneEnabled(false).catch(() => {});
        }
        if (main && main.state === 'connected') {
          await main.localParticipant.setMicrophoneEnabled(true).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('[LiveKit] Microphone routing notice:', err);
    }
  }

  public cleanup(): void {
    if (this.mainRoom) {
      try {
        this.mainRoom.disconnect();
      } catch {}
      this.mainRoom = null;
    }
    if (this.teamRoom) {
      try {
        this.teamRoom.disconnect();
      } catch {}
      this.teamRoom = null;
    }

    this.remoteAudioElements.forEach((el) => {
      try {
        if (el.parentNode) el.parentNode.removeChild(el);
      } catch {}
    });
    this.remoteAudioElements.clear();
    this.remoteVideoTracks.clear();
    this.publishedVideoTrack = null;
    this.currentRoomCode = null;
    this.currentUserId = null;
    this.notifyVideoListeners();
  }

  public disconnect(): void {
    this.cleanup();
  }
}

export const livekitClient = new LiveKitClientService();

/**
 * Hook to get a specific remote participant's video track
 */
export function useRemoteVideoTrack(userId?: string): RemoteVideoTrack | undefined {
  const [track, setTrack] = useState<RemoteVideoTrack | undefined>(
    userId ? livekitClient.getRemoteVideoTrack(userId) : undefined
  );

  useEffect(() => {
    if (!userId) {
      setTrack(undefined);
      return;
    }

    setTrack(livekitClient.getRemoteVideoTrack(userId));
    const unsubscribe = livekitClient.subscribeVideoTracks((tracks) => {
      setTrack(tracks.get(userId));
    });
    return unsubscribe;
  }, [userId]);

  return track;
}

/**
 * Hook to get all currently subscribed remote video tracks
 */
export function useRemoteVideoTracks(): Map<string, RemoteVideoTrack> {
  const [tracks, setTracks] = useState<Map<string, RemoteVideoTrack>>(
    livekitClient.getRemoteVideoTracks()
  );

  useEffect(() => {
    return livekitClient.subscribeVideoTracks((newTracks) => {
      setTracks(newTracks);
    });
  }, []);

  return tracks;
}

/**
 * Hook to get active speaker identities
 */
export function useLiveKitActiveSpeakers(): string[] {
  const [speakers, setSpeakers] = useState<string[]>([]);

  useEffect(() => {
    return livekitClient.subscribeActiveSpeakers((newSpeakers) => {
      setSpeakers(newSpeakers);
    });
  }, []);

  return speakers;
}
