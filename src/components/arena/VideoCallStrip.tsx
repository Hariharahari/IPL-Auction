'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Crown, Mic, MicOff, Radio, Video } from 'lucide-react';
import { useAuctionStore } from '@/store/auctionStore';
import { subscribeToMediaStream } from '@/lib/mediaStream';
import { FRANCHISES } from '@/data/franchises';
import { useRemoteVideoTrack, useLiveKitActiveSpeakers } from '@/lib/livekitClient';
import { RemoteVideoTrack } from 'livekit-client';
import { RoomUser, FranchiseCode } from '@/types/auction';

// Dedicated WebRTC Video Element for Remote Participants
const RemoteVideoElement: React.FC<{ track: RemoteVideoTrack }> = ({ track }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    track.attach(el);
    el.play().catch(() => {});
    return () => {
      track.detach(el);
    };
  }, [track]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className="w-full h-full object-cover"
    />
  );
};

// Sub-component for Other Connected Participants
const ParticipantTile: React.FC<{
  user: RoomUser;
  isSpeaking: boolean;
  activeCameras: Array<{ userId: string; isCameraActive: boolean }>;
}> = ({ user, isSpeaking, activeCameras }) => {
  const team = user.franchiseCode ? FRANCHISES[user.franchiseCode as FranchiseCode] : null;
  const track = useRemoteVideoTrack(user.id);
  const hasCamera = !!track || activeCameras.some((c) => c.userId === user.id && c.isCameraActive);

  return (
    <div
      className={`relative aspect-video h-[92px] rounded-xl overflow-hidden bg-slate-900 border transition shadow shrink-0 flex items-center justify-center ${
        isSpeaking
          ? 'border-emerald-400 ring-2 ring-emerald-500/40 shadow-emerald-500/20'
          : hasCamera
          ? 'border-emerald-500/60 shadow-emerald-900/10'
          : 'border-slate-800/80 hover:border-slate-700'
      }`}
    >
      {track ? (
        <RemoteVideoElement track={track} />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 p-2 text-center">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm shadow-md"
            style={{
              backgroundColor: team ? team.primaryColor : '#475569',
            }}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-[10px] font-semibold text-slate-300 mt-1 truncate max-w-[110px]">
            {user.name}
          </span>
        </div>
      )}

      {/* Franchise Tag */}
      <div className="absolute top-1 left-1 bg-slate-950/80 text-[8px] font-bold px-1.5 py-0.2 rounded border border-slate-800 flex items-center gap-1 text-slate-400">
        {team ? <span style={{ color: team.primaryColor }}>{team.code}</span> : <span>Lobby</span>}
      </div>

      {/* Hand Raised Badge */}
      {user.handRaised && (
        <div className="absolute top-1 right-1 bg-amber-500 text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-lg shadow-amber-500/50 ring-2 ring-amber-300 animate-bounce">
          <span>✋</span>
          <span className="text-[8px] font-black uppercase">Hand Up</span>
        </div>
      )}

      {/* Camera Live Indicator */}
      {hasCamera && (
        <div className="absolute bottom-1 left-1 bg-emerald-500/90 text-slate-950 text-[7px] font-black px-1 rounded flex items-center gap-0.5 shadow">
          <Video className="w-2 h-2" />
          <span>CAM</span>
        </div>
      )}

      {/* Speaking Indicator */}
      {isSpeaking && (
        <div className="absolute bottom-1 right-1 bg-emerald-500 text-slate-950 text-[7px] font-black px-1.5 py-0.2 rounded flex items-center gap-0.5 shadow animate-pulse">
          <Radio className="w-2 h-2" />
          <span>SPEAKING</span>
        </div>
      )}
    </div>
  );
};

export const VideoCallStrip: React.FC = () => {
  const {
    room,
    userId,
    userName,
    role,
    franchiseCode,
    isCameraActive,
    activeCameras,
    micRoute,
    isHandRaised,
  } = useAuctionStore();

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  const activeSpeakers = useLiveKitActiveSpeakers();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToMediaStream((stream) => {
      setLocalStream(stream);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (localVideoRef.current) {
      if (localStream) {
        localVideoRef.current.srcObject = localStream;
        localVideoRef.current.play().catch(() => {});
      } else {
        localVideoRef.current.srcObject = null;
      }
    }
  }, [localStream, isCameraActive]);

  const isAuctioneer = role === 'AUCTIONEER' || room?.auctioneerId === userId;
  const auctioneerUser = room?.auctioneerId ? room.users[room.auctioneerId] : null;
  const auctioneerTrack = useRemoteVideoTrack(
    !isAuctioneer && room?.auctioneerId ? room.auctioneerId : undefined
  );
  const isAuctioneerSpeaking = room?.auctioneerId
    ? activeSpeakers.includes(room.auctioneerId)
    : false;

  // Build list of other participants
  const otherUsers = room
    ? Object.values(room.users).filter(
        (u) => u.id !== userId && u.id !== room.auctioneerId && u.isOnline
      )
    : [];

  return (
    <div className="w-full flex items-center gap-2.5 overflow-x-auto py-1 px-1 scrollbar-thin scrollbar-thumb-slate-800 shrink-0">
      {/* 1. AUCTIONEER TILE (Gold Border Spotlight) */}
      <div
        className={`relative aspect-video h-[92px] rounded-xl overflow-hidden bg-slate-900 border-2 transition shadow-lg shrink-0 flex items-center justify-center ${
          isAuctioneerSpeaking
            ? 'border-amber-400 ring-4 ring-amber-400/50 shadow-amber-500/30'
            : isAuctioneer
            ? 'border-amber-400 ring-2 ring-amber-500/30 shadow-amber-500/20'
            : 'border-amber-500/50 shadow-amber-500/10'
        }`}
      >
        {isMounted && isAuctioneer && isCameraActive && localStream ? (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform -scale-x-100"
          />
        ) : !isAuctioneer && auctioneerTrack ? (
          <RemoteVideoElement track={auctioneerTrack} />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-amber-950/20 to-slate-950 p-2 text-center">
            <div className="relative">
              <div
                className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 font-black text-sm shadow-md ring-2 ring-amber-400/40"
                suppressHydrationWarning
              >
                {isMounted
                  ? isAuctioneer
                    ? (userName || 'A').charAt(0).toUpperCase()
                    : auctioneerUser
                    ? auctioneerUser.name.charAt(0).toUpperCase()
                    : 'A'
                  : 'A'}
              </div>
              <div className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 p-0.5 rounded-full shadow">
                <Crown className="w-2.5 h-2.5" />
              </div>
            </div>
            <span
              className="text-[10px] font-bold text-amber-300 mt-1 truncate max-w-[110px]"
              suppressHydrationWarning
            >
              {isMounted
                ? isAuctioneer
                  ? `${userName} (You)`
                  : auctioneerUser
                  ? auctioneerUser.name
                  : 'Auctioneer'
                : 'Auctioneer'}
            </span>
          </div>
        )}

        {/* Live Broadcast Badge */}
        <div className="absolute top-1 left-1 bg-amber-500 text-slate-950 text-[8px] font-black px-1.5 py-0.2 rounded flex items-center gap-1 shadow">
          <Crown className="w-2.5 h-2.5" />
          <span>AUCTIONEER</span>
        </div>

        {/* Mic Status */}
        <div className="absolute bottom-1 right-1 bg-slate-950/80 px-1 py-0.5 rounded text-[8px] flex items-center gap-0.5 border border-slate-800">
          {isMounted && isAuctioneer ? (
            micRoute === 'MAIN' ? (
              <Radio className="w-2.5 h-2.5 text-amber-400 animate-pulse" />
            ) : micRoute === 'MUTED' ? (
              <MicOff className="w-2.5 h-2.5 text-rose-400" />
            ) : (
              <Mic className="w-2.5 h-2.5 text-blue-400" />
            )
          ) : isAuctioneerSpeaking ? (
            <Radio className="w-2.5 h-2.5 text-amber-400 animate-pulse" />
          ) : (
            <Radio className="w-2.5 h-2.5 text-slate-400" />
          )}
        </div>
      </div>

      {/* 2. LOCAL USER TILE (If mounted and not auctioneer) */}
      {isMounted && !isAuctioneer && (
        <div
          className={`relative aspect-video h-[92px] rounded-xl overflow-hidden bg-slate-900 border transition shadow-lg shrink-0 flex items-center justify-center ${
            isCameraActive ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-800'
          }`}
        >
          {isCameraActive && localStream ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 p-2 text-center">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm shadow-md"
                style={{
                  backgroundColor:
                    franchiseCode && FRANCHISES[franchiseCode]
                      ? FRANCHISES[franchiseCode].primaryColor
                      : '#3B82F6',
                }}
                suppressHydrationWarning
              >
                {(userName || 'U').charAt(0).toUpperCase()}
              </div>
              <span
                className="text-[10px] font-bold text-slate-200 mt-1 truncate max-w-[110px]"
                suppressHydrationWarning
              >
                {userName} (You)
              </span>
            </div>
          )}

          {/* Franchise Tag */}
          <div
            className="absolute top-1 left-1 bg-slate-950/80 text-[8px] font-bold px-1.5 py-0.2 rounded border border-slate-800 flex items-center gap-1 text-slate-300"
            suppressHydrationWarning
          >
            {franchiseCode && FRANCHISES[franchiseCode] ? (
              <span style={{ color: FRANCHISES[franchiseCode].primaryColor }}>
                {FRANCHISES[franchiseCode].code} Table
              </span>
            ) : (
              <span>Spectator</span>
            )}
          </div>

          {/* Hand Raised Badge */}
          {isHandRaised && (
            <div className="absolute top-1 right-1 bg-amber-500 text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-lg shadow-amber-500/50 ring-2 ring-amber-300 animate-bounce">
              <span>✋</span>
              <span className="text-[8px] font-black uppercase">Hand Up</span>
            </div>
          )}

          {/* Mic Status */}
          <div className="absolute bottom-1 right-1 bg-slate-950/80 px-1 py-0.5 rounded text-[8px] flex items-center gap-0.5 border border-slate-800">
            {micRoute === 'MUTED' ? (
              <MicOff className="w-2.5 h-2.5 text-rose-400" />
            ) : micRoute === 'MAIN' ? (
              <Radio className="w-2.5 h-2.5 text-amber-400 animate-pulse" />
            ) : (
              <Mic className="w-2.5 h-2.5 text-blue-400" />
            )}
          </div>
        </div>
      )}

      {/* 3. CONNECTED PARTICIPANTS / TEAMS */}
      {otherUsers.map((u) => (
        <ParticipantTile
          key={u.id}
          user={u}
          isSpeaking={activeSpeakers.includes(u.id)}
          activeCameras={activeCameras}
        />
      ))}
    </div>
  );
};
