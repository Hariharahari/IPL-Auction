'use client';

import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Link as LinkIcon,
  Shield,
  Users,
  UserX,
  Eye,
  Key,
  Search,
} from 'lucide-react';
import { useAuctionStore } from '@/store/auctionStore';
import { FRANCHISES, FRANCHISE_LIST } from '@/data/franchises';
import { FranchiseCode } from '@/types/auction';

interface ShareTeamCodesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShareTeamCodesModal: React.FC<ShareTeamCodesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { room, roomCode, removeUser } = useAuctionStore();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  if (!isOpen || !room) return null;

  const accessCodes = room.accessCodes;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  const handleRemoveUser = async (targetUserId: string, targetUserName: string) => {
    if (
      confirm(
        `Are you sure you want to remove ${targetUserName}? This will release their franchise assignment so another user can join.`
      )
    ) {
      setRemovingUserId(targetUserId);
      try {
        await removeUser(targetUserId);
      } finally {
        setRemovingUserId(null);
      }
    }
  };

  const filteredFranchises = FRANCHISE_LIST.filter(
    (f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const allUsers = Object.values(room.users || {});
  const spectators = allUsers.filter((u) => u.role === 'SPECTATOR');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                Franchise Access Codes & Team Lock
                <span className="text-[10px] bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded">
                  HOST ONLY
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Share these 4-digit PINs or direct links to onboard franchise representatives with permanent team locks.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Room Invite Banner */}
        <div className="px-6 py-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Room Code:
            </span>
            <span className="font-mono text-base font-black text-amber-400 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800 tracking-widest">
              {roomCode}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => copyToClipboard(roomCode || '', 'room_code')}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
            >
              {copiedKey === 'room_code' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied Code</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Room Code</span>
                </>
              )}
            </button>

            <button
              onClick={() => copyToClipboard(`${origin}/?room=${roomCode}`, 'room_link')}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20"
            >
              {copiedKey === 'room_link' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Link Copied!</span>
                </>
              ) : (
                <>
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>Copy General Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-3 border-b border-slate-800/80 bg-slate-900/40">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search franchise by name, city, or code (e.g. CSK, Mumbai)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
            />
          </div>
        </div>

        {/* Franchise PINs List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredFranchises.map((franchise) => {
              const code = franchise.code;
              const teamPin = accessCodes?.franchises[code] || `${code}-0000`;
              const directLink = `${origin}/?room=${roomCode}&code=${teamPin}`;
              const teamMembers = allUsers.filter((u) => u.franchiseCode === code);

              return (
                <div
                  key={code}
                  className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition flex flex-col justify-between gap-3 shadow-md"
                >
                  {/* Top: Team Identity + PIN */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs text-white shadow"
                        style={{ backgroundColor: franchise.primaryColor }}
                      >
                        {franchise.code}
                      </div>
                      <div>
                        <div className="font-bold text-white text-xs leading-none">
                          {franchise.name}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {franchise.city}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
                      <Key className="w-3 h-3 text-amber-400" />
                      <span className="font-mono text-xs font-black text-amber-400 tracking-wider">
                        {teamPin}
                      </span>
                    </div>
                  </div>

                  {/* Connected Member Status */}
                  <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800/80 text-[11px]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Users className="w-3 h-3 text-blue-400" />
                        <span>Connected Members ({teamMembers.length})</span>
                      </span>
                    </div>

                    {teamMembers.length === 0 ? (
                      <span className="text-slate-500 italic text-[10px]">
                        No user joined yet • Slot vacant
                      </span>
                    ) : (
                      <div className="space-y-1.5 mt-1">
                        {teamMembers.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between bg-slate-950 px-2 py-1 rounded border border-slate-800"
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  member.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                                }`}
                              />
                              <span className="font-semibold text-slate-200 truncate">
                                {member.name}
                              </span>
                              {member.teamRole === 'CAPTAIN' && (
                                <span className="text-[9px] bg-amber-500/20 text-amber-400 font-bold px-1 rounded">
                                  Captain
                                </span>
                              )}
                            </div>

                            <button
                              onClick={() => handleRemoveUser(member.id, member.name)}
                              disabled={removingUserId === member.id}
                              className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/60 p-1 rounded transition cursor-pointer"
                              title="Remove user and free up team seat"
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Copy Action Buttons */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-900">
                    <button
                      onClick={() => copyToClipboard(teamPin, `pin_${code}`)}
                      className="flex-1 text-[11px] font-bold py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {copiedKey === `pin_${code}` ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">PIN Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-400" />
                          <span>Copy PIN</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => copyToClipboard(directLink, `link_${code}`)}
                      className="flex-1 text-[11px] font-bold py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {copiedKey === `link_${code}` ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Invite Link Copied!</span>
                        </>
                      ) : (
                        <>
                          <LinkIcon className="w-3 h-3" />
                          <span>Direct Invite</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Spectator Section */}
          <div className="mt-4 bg-slate-950/80 border border-slate-800 rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white text-xs">
                    Spectator Access Code
                  </div>
                  <div className="text-[10px] text-slate-400">
                    For viewers and media representatives (Read-only access)
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-black text-slate-300 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
                  {accessCodes?.spectator || 'SPEC-0000'}
                </span>

                <button
                  onClick={() =>
                    copyToClipboard(accessCodes?.spectator || 'SPEC-0000', 'pin_spec')
                  }
                  className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedKey === 'pin_spec' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-slate-400" />
                      <span>Copy PIN</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() =>
                    copyToClipboard(
                      `${origin}/?room=${roomCode}&code=${accessCodes?.spectator || 'SPEC-0000'}`,
                      'link_spec'
                    )
                  }
                  className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 transition flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedKey === 'link_spec' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <LinkIcon className="w-3 h-3" />
                      <span>Direct Spectator Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {spectators.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-900 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  Connected Spectators:
                </span>
                {spectators.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-1.5 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-[11px]"
                  >
                    <span className="text-slate-300">{s.name}</span>
                    <button
                      onClick={() => handleRemoveUser(s.id, s.name)}
                      className="text-rose-400 hover:text-rose-300 ml-1 cursor-pointer"
                      title="Remove spectator"
                    >
                      <UserX className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
