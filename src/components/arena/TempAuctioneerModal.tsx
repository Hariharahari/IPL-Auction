'use client';

import React, { useState } from 'react';
import { Gavel, Shield, UserCheck, X, Crown, ArrowRight, Sparkles, Check } from 'lucide-react';
import { useAuctionStore } from '@/store/auctionStore';
import { FRANCHISES } from '@/data/franchises';

interface TempAuctioneerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TempAuctioneerModal: React.FC<TempAuctioneerModalProps> = ({ isOpen, onClose }) => {
  const { room, userId, userName, appointTempAuctioneer, transferGavel } = useAuctionStore();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !room) return null;

  const onlineMembers = Object.values(room.users).filter(
    (u) => u.id !== userId && u.isOnline
  );

  const currentDeputy = room.tempAuctioneerId ? room.users[room.tempAuctioneerId] : null;

  const handleAppointDeputy = async (targetId: string, name: string) => {
    setLoadingId(targetId);
    setErrorMsg(null);
    try {
      const res = await appointTempAuctioneer(targetId);
      if (res.success) {
        setSuccessMsg(`${name} is now the designated Deputy Auctioneer.`);
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setErrorMsg(res.error || 'Failed to appoint deputy auctioneer');
      }
    } finally {
      setLoadingId(null);
    }
  };

  const handleTransferGavel = async (targetId: string, name: string) => {
    if (!confirm(`Hand over the live Auctioneer Gavel to ${name} immediately? You will transition to a member role.`)) {
      return;
    }
    setLoadingId(targetId);
    setErrorMsg(null);
    try {
      const res = await transferGavel(targetId);
      if (res.success) {
        onClose();
      } else {
        setErrorMsg(res.error || 'Failed to transfer gavel');
      }
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow">
              <Gavel className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>Deputy & Temporary Auctioneer</span>
              </h3>
              <p className="text-xs text-slate-400">
                Designate a standby auctioneer or transfer gavel anytime
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="px-5 py-3 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-300 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            If you leave the auction or disconnect, the designated <strong>Deputy Auctioneer</strong> will automatically assume the gavel so the auction continues without delay.
          </p>
        </div>

        {successMsg && (
          <div className="mx-5 mt-3 p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500 text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mx-5 mt-3 p-2.5 rounded-xl bg-rose-950/80 border border-rose-500 text-rose-300 text-xs">
            {errorMsg}
          </div>
        )}

        {/* Current Deputy Status */}
        {currentDeputy && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-400" />
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Standby Deputy</span>
                <span className="text-xs font-black text-white">{currentDeputy.name}</span>
              </div>
            </div>
            <span className="text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-md">
              Active Standby
            </span>
          </div>
        )}

        {/* Members List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Connected Members ({onlineMembers.length})
          </label>

          {onlineMembers.length === 0 ? (
            <div className="p-8 text-center bg-slate-950/50 rounded-xl border border-slate-800/80 text-slate-400 text-xs italic">
              No other members currently online in this session.
            </div>
          ) : (
            onlineMembers.map((m) => {
              const team = m.franchiseCode ? FRANCHISES[m.franchiseCode] : null;
              const isDeputy = room.tempAuctioneerId === m.id || m.isTempAuctioneer;

              return (
                <div
                  key={m.id}
                  className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 ${
                    isDeputy
                      ? 'bg-amber-500/10 border-amber-500/40'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs text-white shadow shrink-0"
                      style={{ backgroundColor: team ? team.primaryColor : '#475569' }}
                    >
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-xs font-black text-white truncate">{m.name}</span>
                        {isDeputy && (
                          <span className="text-[9px] font-black bg-amber-500 text-slate-950 px-1 rounded shadow">
                            DEPUTY
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block truncate">
                        {team ? `${team.code} Table` : 'Spectator / Floor'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isDeputy && (
                      <button
                        onClick={() => handleAppointDeputy(m.id, m.name)}
                        disabled={loadingId === m.id}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition cursor-pointer"
                        title="Designate as temporary standby auctioneer if you leave"
                      >
                        Appoint Deputy
                      </button>
                    )}

                    <button
                      onClick={() => handleTransferGavel(m.id, m.name)}
                      disabled={loadingId === m.id}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-black bg-amber-500 hover:bg-amber-400 text-slate-950 shadow transition cursor-pointer flex items-center gap-1"
                      title="Transfer the live gavel to this user immediately"
                    >
                      <span>Pass Gavel</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
