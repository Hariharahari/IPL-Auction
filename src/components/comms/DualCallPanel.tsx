'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Radio,
  Users,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  ShieldAlert,
  Crown,
  Sparkles,
  AlertCircle,
  Camera,
  RefreshCw,
} from 'lucide-react';
import { Room, RoomEvent, RemoteTrack, Track, RemoteAudioTrack } from 'livekit-client';
import { useAuctionStore, MicRouting } from '@/store/auctionStore';
import { FRANCHISES } from '@/data/franchises';

interface TokenResponse {
  demoMode: boolean;
  message?: string;
  serverUrl?: string;
  mainToken?: string;
  teamToken?: string;
}

export const DualCallPanel: React.FC = () => {
  const {
    roomCode,
    userId,
    userName,
    role,
    franchiseCode,
    room,
    micRoute,
    setMicRoute,
    isTeammateSpeaking,
    setIsTeammateSpeaking,
    isCameraActive,
    setIsCameraActive,
    activeCameras,
  } = useAuctionStore();

  const [isDemoMode, setIsDemoMode] = useState(true);
  const [demoBannerMsg, setDemoBannerMsg] = useState('Voice Demo Mode active');
  const [isConnecting, setIsConnecting] = useState(false);
  const [mainAudioMuted, setMainAudioMuted] = useState(false);
  const [teamSpeakingSimulated, setTeamSpeakingSimulated] = useState(false);

  // Real Webcam / Camera Access State
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  // LiveKit real instances
  const mainRoomRef = useRef<Room | null>(null);
  const teamRoomRef = useRef<Room | null>(null);
  const auctioneerVideoContainerRef = useRef<HTMLDivElement | null>(null);
  const remoteAudioTracksRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Determine current franchise and teammates
  const franchise = franchiseCode ? FRANCHISES[franchiseCode] : null;
  const teammates = room
    ? Object.values(room.users).filter(
        (u) => u.franchiseCode === franchiseCode && u.id !== userId && u.isOnline
      )
    : [];
  const auctioneerUser = room?.auctioneerId ? room.users[room.auctioneerId] : null;

  // Request token and initialize comms
  useEffect(() => {
    if (!roomCode || !userId || !userName) return;

    let mounted = true;
    setIsConnecting(true);

    async function initComms() {
      try {
        const res = await fetch('/api/livekit/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomCode,
            userId,
            userName,
            role,
            franchiseCode,
          }),
        });

        const data: TokenResponse = await res.json();
        if (!mounted) return;

        if (data.demoMode || !data.serverUrl || !data.mainToken) {
          setIsDemoMode(true);
          setDemoBannerMsg(
            data.message ||
              'Voice Demo Mode: LiveKit keys not configured in .env.local. Comm controls and UI state transitions are simulated.'
          );
          setIsConnecting(false);
          return;
        }

        // Connect real LiveKit clients
        setIsDemoMode(false);
        await setupLiveKit(data.serverUrl, data.mainToken, data.teamToken);
      } catch (err) {
        console.warn('LiveKit init error, falling back to demo mode:', err);
        if (mounted) {
          setIsDemoMode(true);
          setDemoBannerMsg('LiveKit unreachable. Running in interactive Demo Mode.');
        }
      } finally {
        if (mounted) setIsConnecting(false);
      }
    }

    initComms();

    return () => {
      mounted = false;
      cleanupRooms();
    };
  }, [roomCode, userId, userName, role, franchiseCode]);

  async function setupLiveKit(serverUrl: string, mainToken: string, teamToken?: string) {
    cleanupRooms();

    // 1. Connect Main Room
    const mainRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    mainRoomRef.current = mainRoom;

    mainRoom.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Video && auctioneerVideoContainerRef.current) {
        const element = track.attach();
        element.className = 'w-full h-full object-cover rounded-lg';
        auctioneerVideoContainerRef.current.innerHTML = '';
        auctioneerVideoContainerRef.current.appendChild(element);
      } else if (track.kind === Track.Kind.Audio) {
        const audioEl = track.attach() as HTMLAudioElement;
        if (track.sid) {
          remoteAudioTracksRef.current.set(track.sid, audioEl);
        }
      }
    });

    mainRoom.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      track.detach();
      if (track.sid) {
        remoteAudioTracksRef.current.delete(track.sid);
      }
    });

    await mainRoom.connect(serverUrl, mainToken);
    if (mainRoom.localParticipant) {
      await mainRoom.localParticipant.setMicrophoneEnabled(false);
    }
    mainRoom.startAudio().catch(() => {});

    // 2. Connect Team Room (if part of franchise)
    if (teamToken) {
      const teamRoom = new Room();
      teamRoomRef.current = teamRoom;

      teamRoom.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const teammateSpeaking = speakers.length > 0;
        setIsTeammateSpeaking(teammateSpeaking);
        applyMainAudioDucking(teammateSpeaking);
      });

      teamRoom.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          (track as RemoteAudioTrack).attach();
        }
      });

      await teamRoom.connect(serverUrl, teamToken);
      if (teamRoom.localParticipant) {
        await teamRoom.localParticipant.setMicrophoneEnabled(false);
      }
      teamRoom.startAudio().catch(() => {});
    }
  }

  function applyMainAudioDucking(duck: boolean) {
    remoteAudioTracksRef.current.forEach((audioEl) => {
      audioEl.volume = duck ? 0.25 : 1.0;
    });
  }

  function cleanupRooms() {
    if (mainRoomRef.current) {
      mainRoomRef.current.disconnect();
      mainRoomRef.current = null;
    }
    if (teamRoomRef.current) {
      teamRoomRef.current.disconnect();
      teamRoomRef.current = null;
    }
    remoteAudioTracksRef.current.clear();
  }

  // Handle 3-way Mic Routing Switch
  const handleMicRoute = async (target: MicRouting) => {
    setMicRoute(target);

    if (isDemoMode) {
      return;
    }

    try {
      const mainRoom = mainRoomRef.current;
      const teamRoom = teamRoomRef.current;

      if (target === 'MUTED') {
        if (mainRoom) await mainRoom.localParticipant.setMicrophoneEnabled(false);
        if (teamRoom) await teamRoom.localParticipant.setMicrophoneEnabled(false);
      } else if (target === 'TEAM') {
        if (mainRoom) await mainRoom.localParticipant.setMicrophoneEnabled(false);
        if (teamRoom) await teamRoom.localParticipant.setMicrophoneEnabled(true);
      } else if (target === 'MAIN') {
        if (teamRoom) await teamRoom.localParticipant.setMicrophoneEnabled(false);
        if (mainRoom) await mainRoom.localParticipant.setMicrophoneEnabled(true);
      }
    } catch (err: unknown) {
      console.warn('Microphone permission or toggle notice:', err);
    }
  };

  const toggleTeammateSimulation = () => {
    const next = !teamSpeakingSimulated;
    setTeamSpeakingSimulated(next);
    setIsTeammateSpeaking(next);
    applyMainAudioDucking(next);
  };

  // Start Simulated Studio Broadcaster Cam (Generates real 30fps MediaStream without needing physical webcam hardware)
  const startStudioSimulatedStream = () => {
    try {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }

      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let frame = 0;
      const render = () => {
        frame++;
        // 1. Dark sleek broadcast studio gradient
        const grad = ctx.createLinearGradient(0, 0, 1280, 720);
        grad.addColorStop(0, '#020617');
        grad.addColorStop(0.5, '#0f172a');
        grad.addColorStop(1, '#020617');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1280, 720);

        // 2. Decorative studio glow
        ctx.fillStyle = 'rgba(245, 158, 11, 0.08)';
        ctx.beginPath();
        ctx.arc(640, 360, 260 + Math.sin(frame * 0.05) * 20, 0, Math.PI * 2);
        ctx.fill();

        // 3. User Avatar Circle in center
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(640, 310, 80, 0, Math.PI * 2);
        ctx.fill();

        // 4. Initial letter
        ctx.fillStyle = '#020617';
        ctx.font = '900 75px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const initial = (userName || 'A').charAt(0).toUpperCase();
        ctx.fillText(initial, 640, 315);

        // 5. Broadcaster Title & Name
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 34px system-ui, sans-serif';
        ctx.fillText(userName || 'Auction Broadcaster', 640, 440);

        ctx.fillStyle = '#F59E0B';
        ctx.font = '700 18px system-ui, sans-serif';
        ctx.fillText('IPL AUCTION STAGE • STUDIO BROADCAST FEED', 640, 480);

        // 6. Live Audio Waveform animation at bottom
        for (let i = 0; i < 28; i++) {
          const h = 15 + Math.sin(frame * 0.15 + i * 0.45) * 26;
          ctx.fillStyle = i % 2 === 0 ? '#F59E0B' : '#38BDF8';
          ctx.fillRect(500 + i * 10, 560 - h / 2, 6, h);
        }

        // 7. Live REC badge top-left
        ctx.fillStyle = frame % 60 < 30 ? '#EF4444' : '#991B1B';
        ctx.beginPath();
        ctx.arc(80, 60, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('STUDIO LIVE 720p', 105, 66);

        // 8. Time readout top-right
        ctx.fillStyle = '#94A3B8';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(new Date().toLocaleTimeString(), 1200, 66);
      };

      const intervalId = setInterval(render, 1000 / 30);
      const stream = canvas.captureStream(30);

      // Clean up interval when track ends
      const track = stream.getVideoTracks()[0];
      if (track) {
        const origStop = track.stop.bind(track);
        track.stop = () => {
          clearInterval(intervalId);
          origStop();
        };
      }

      setLocalStream(stream);
      setIsCameraActive(true);
      setCameraError(null);
    } catch (e) {
      console.warn('Virtual studio camera fallback info:', e);
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    if (mainRoomRef.current) {
      try {
        mainRoomRef.current.localParticipant.setCameraEnabled(false);
      } catch (e) {
        console.warn('LiveKit camera disable info:', e);
      }
    }
    setIsCameraActive(false);
    setCameraError(null);
  };

  // Start Camera with Automatic Fallback
  const startCamera = async () => {
    setCameraLoading(true);
    setCameraError(null);
    try {
      if (typeof window === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Webcam/Camera access is not supported by your browser environment.');
      }

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      if (!stream) {
        throw new Error('No video stream received from camera.');
      }

      setLocalStream(stream);
      setIsCameraActive(true);

      if (mainRoomRef.current) {
        try {
          await mainRoomRef.current.localParticipant.setCameraEnabled(true);
        } catch (e) {
          console.warn('LiveKit camera publish info:', e);
        }
      }
    } catch (err: unknown) {
      console.warn('Camera access was not granted by browser/system:', err);
      const isNotAllowed =
        err instanceof Error &&
        (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');

      const msg = isNotAllowed
        ? 'Browser camera permission denied. Switched to Studio Virtual Cam below.'
        : err instanceof Error
        ? err.name === 'NotFoundError'
          ? 'No physical camera detected. Switched to Studio Virtual Cam below.'
          : err.message
        : 'Unable to start camera';

      setCameraError(msg);
      // Auto-fallback to Studio Virtual Cam so video is never broken
      startStudioSimulatedStream();
    } finally {
      setCameraLoading(false);
    }
  };

  // Toggle Camera
  const toggleCamera = async () => {
    if (isCameraActive) {
      stopCamera();
    } else {
      await startCamera();
    }
  };

  // Sync when header or other components change isCameraActive in Zustand store
  useEffect(() => {
    if (isCameraActive && !localStream && !cameraLoading) {
      startCamera();
    } else if (!isCameraActive && localStream) {
      stopCamera();
    }
  }, [isCameraActive]);

  useEffect(() => {
    if (localVideoRef.current) {
      if (localStream) {
        localVideoRef.current.srcObject = localStream;
        localVideoRef.current.play().catch(console.warn);
      } else {
        localVideoRef.current.srcObject = null;
      }
    }
  }, [localStream, isCameraActive]);

  useEffect(() => {
    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [localStream]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col gap-4 shadow-xl backdrop-blur-md">
      {/* Comms Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="font-bold text-sm tracking-wide uppercase text-slate-200 flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-amber-400" />
            Live Comms Center
          </h3>
        </div>
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
            isDemoMode
              ? 'bg-amber-950/60 text-amber-300 border-amber-800'
              : 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
          }`}
        >
          {isConnecting ? 'Connecting...' : isDemoMode ? 'Demo Mode' : 'Live WebRTC'}
        </span>
      </div>

      {/* Voice Demo Mode Banner */}
      {isDemoMode && (
        <div className="bg-amber-950/40 border border-amber-800/60 rounded-lg p-2.5 text-xs text-amber-200/90 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-snug">
            <p className="font-semibold text-amber-300">Voice Simulation Active</p>
            <p className="text-[11px] text-amber-300/70 mt-0.5">
              Dual-routing audio ducking to 25% is fully simulated below. Add LiveKit API keys to `.env.local` to switch to live peer streams.
            </p>
          </div>
        </div>
      )}

      {/* Stage Video Broadcast Tile */}
      <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video flex items-center justify-center group shadow-2xl">
        {/* If camera is active, display the live webcam feed! */}
        {isCameraActive && localStream ? (
          <div className="relative w-full h-full">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover rounded-xl transform -scale-x-100"
            />
            {/* Live Camera Badge */}
            <div className="absolute top-2.5 left-2.5 z-10 bg-emerald-500/90 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1.5 shadow-lg backdrop-blur-sm animate-pulse">
              <span className="w-2 h-2 rounded-full bg-slate-950" />
              <span>CAMERA LIVE (720p)</span>
            </div>

            {/* Broadcaster Name Pill */}
            <div className="absolute bottom-2.5 left-2.5 z-10 bg-slate-950/80 border border-slate-800/80 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>{userName} (Podium Cam)</span>
            </div>
          </div>
        ) : (
          <div ref={auctioneerVideoContainerRef} className="absolute inset-0 z-0">
            {/* Fallback visual avatar / broadcast podium */}
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950/30 to-slate-950 p-4 text-center">
              <div className="relative mb-2">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 font-black text-xl">
                  {auctioneerUser ? auctioneerUser.name.charAt(0).toUpperCase() : 'A'}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 p-1 rounded-full shadow">
                  <Crown className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-sm font-bold text-white tracking-wide">
                {auctioneerUser ? auctioneerUser.name : 'Waiting for Broadcaster...'}
              </p>
              <p className="text-xs text-amber-400/90 font-medium">Main Stage Broadcaster</p>
            </div>
          </div>
        )}

        {/* Live Audio Ducking Indicator */}
        {(isTeammateSpeaking || teamSpeakingSimulated) && (
          <div className="absolute top-2 right-12 z-10 bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md animate-pulse">
            <Volume2 className="w-3 h-3" />
            Stage Ducked
          </div>
        )}

        {/* Stage Audio Mute Toggle */}
        <button
          onClick={() => setMainAudioMuted(!mainAudioMuted)}
          className="absolute bottom-2.5 right-2.5 z-10 p-1.5 rounded-md bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700 transition cursor-pointer"
          title={mainAudioMuted ? 'Unmute Stage' : 'Mute Stage'}
        >
          {mainAudioMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Universal Camera Access Control Bar (For All Participants) */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-amber-400" />
            <span>Universal Live Camera (All Roles)</span>
          </span>
          <span
            className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
              isCameraActive
                ? 'bg-emerald-950 text-emerald-300 border-emerald-800 animate-pulse'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
          >
            {isCameraActive ? '● Camera Active' : 'Camera Disabled'}
          </span>
        </div>
        <p className="text-[11px] text-slate-400 leading-snug">
          Open to everyone: Auctioneer, Franchise Table reps, and Spectators. Speak out loud to place bids!
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-2">
          <button
            onClick={toggleCamera}
            disabled={cameraLoading}
            className={`flex-1 w-full py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition shadow cursor-pointer ${
              isCameraActive
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 text-white shadow-blue-900/30'
            }`}
          >
            {cameraLoading ? (
              <span>Starting camera...</span>
            ) : isCameraActive ? (
              <>
                <VideoOff className="w-4 h-4" />
                <span>Turn Camera OFF</span>
              </>
            ) : (
              <>
                <Video className="w-4 h-4" />
                <span>📹 Turn Camera ON (Webcam)</span>
              </>
            )}
          </button>

          {!isCameraActive && (
            <button
              onClick={startStudioSimulatedStream}
              className="w-full sm:w-auto py-2.5 px-3 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer shadow"
              title="Use high-framerate simulated studio broadcast feed with audio visualizer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Studio Virtual Cam</span>
            </button>
          )}
        </div>

        {cameraError && (
          <div className="bg-amber-950/60 border border-amber-800 p-2.5 rounded-xl text-xs text-amber-200 flex flex-col gap-1.5">
            <div className="flex items-start gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <div className="leading-snug">
                <span className="font-bold text-amber-300">Camera / Mic Access:</span>{' '}
                <span className="text-[11px] text-amber-200/90">{cameraError}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-amber-800/40">
              <button
                onClick={toggleCamera}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-2 py-0.5 rounded text-[10px] flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry Permission</span>
              </button>
              <button
                onClick={startStudioSimulatedStream}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-2 py-0.5 rounded text-[10px] flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                <span>Switch to Virtual Cam</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Franchise Team Huddle Section */}
      {franchise ? (
        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs font-bold text-slate-200">
                {franchise.name} Huddle
              </span>
            </div>
            {isDemoMode && (
              <button
                onClick={toggleTeammateSimulation}
                className={`text-[10px] px-2 py-0.5 rounded font-medium border transition ${
                  teamSpeakingSimulated
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                {teamSpeakingSimulated ? 'Teammate Speaking' : 'Test Audio Duck'}
              </button>
            )}
          </div>

          {/* Teammates List */}
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 border border-slate-800 text-xs text-white">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="font-medium text-slate-200">{userName} (You)</span>
            </div>
            {teammates.map((tm) => (
              <div
                key={tm.id}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs border transition ${
                  teamSpeakingSimulated
                    ? 'bg-emerald-950/70 border-emerald-500 text-emerald-200 animate-pulse'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    teamSpeakingSimulated ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'
                  }`}
                />
                <span>{tm.name}</span>
                {tm.teamRole === 'CAPTAIN' && (
                  <Crown className="w-3 h-3 text-amber-400 ml-0.5" />
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-slate-950/40 border border-slate-800/60 rounded-lg p-2.5 text-center text-xs text-slate-400">
          Join a franchise group in the Lobby to access private team voice huddles.
        </div>
      )}

      {/* Prominent 3-State Mic Routing Switch */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
          <span>Mic Routing</span>
          <span className="text-amber-400 font-semibold">{micRoute}</span>
        </label>
        <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
          {/* 1. Muted */}
          <button
            onClick={() => handleMicRoute('MUTED')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-md font-semibold text-xs transition ${
              micRoute === 'MUTED'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-900/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <MicOff className="w-3.5 h-3.5" />
            Muted
          </button>

          {/* 2. Team Huddle */}
          <button
            onClick={() => handleMicRoute('TEAM')}
            disabled={!franchiseCode}
            title={!franchiseCode ? 'Join a team to speak in Huddle' : 'Private to your franchise'}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-md font-semibold text-xs transition ${
              !franchiseCode
                ? 'opacity-40 cursor-not-allowed text-slate-500'
                : micRoute === 'TEAM'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Huddle
          </button>

          {/* 3. Main Stage (PTT / Public) */}
          <button
            onClick={() => handleMicRoute('MAIN')}
            title="Public to Auctioneer and all franchises"
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-md font-semibold text-xs transition ${
              micRoute === 'MAIN'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/30 animate-pulse'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            Main Stage
          </button>
        </div>
      </div>
    </div>
  );
};
