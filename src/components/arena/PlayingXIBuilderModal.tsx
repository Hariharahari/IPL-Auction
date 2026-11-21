'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Shield,
  Plane,
  X,
  Crown,
  Check,
  AlertTriangle,
  Award,
  Sparkles,
  Share2,
  Copy,
  CheckCheck,
  UserCheck,
} from 'lucide-react';
import { FRANCHISES } from '@/data/franchises';
import { BoughtPlayer, FranchiseCode, PlayerRole } from '@/types/auction';
import { formatIndianCurrency } from '@/lib/utils';
import { FranchiseLogo } from '@/components/common/FranchiseLogo';

interface PlayingXIBuilderModalProps {
  franchiseCode: FranchiseCode;
  squad: BoughtPlayer[];
  onClose: () => void;
  roomCode?: string;
  isReadOnly?: boolean;
  userAssignedFranchise?: FranchiseCode | null;
}

export const PlayingXIBuilderModal: React.FC<PlayingXIBuilderModalProps> = ({
  franchiseCode,
  squad,
  onClose,
  roomCode = 'LIVE',
  isReadOnly = false,
  userAssignedFranchise,
}) => {
  const franchise = FRANCHISES[franchiseCode];
  const storageKey = `ipl_playing_xi_${roomCode}_${franchiseCode}`;

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [wicketKeeperId, setWicketKeeperId] = useState<string | null>(null);
  const [impactPlayerId, setImpactPlayerId] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<PlayerRole | 'ALL'>('ALL');
  const [copied, setCopied] = useState(false);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);

  // Load saved Playing XI from local storage or auto-seed top 11
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed.selectedIds)) {
            setSelectedIds(parsed.selectedIds);
            setCaptainId(parsed.captainId || null);
            setWicketKeeperId(parsed.wicketKeeperId || null);
            setImpactPlayerId(parsed.impactPlayerId || null);
            return;
          }
        }
      } catch (e) {
        console.warn('Error reading saved Playing XI', e);
      }
    }

    // Default auto-pick first 11 complying with overseas <= 4
    const initial: string[] = [];
    let os = 0;
    for (const p of squad) {
      if (initial.length >= 11) break;
      if (p.isOverseas && os >= 4) continue;
      initial.push(p.id);
      if (p.isOverseas) os++;
    }
    setSelectedIds(initial);
    // Find keeper
    const wk = squad.find((p) => p.role === 'WK' && initial.includes(p.id));
    if (wk) setWicketKeeperId(wk.id);
    if (initial[0]) setCaptainId(initial[0]);
  }, [storageKey, squad]);

  // Persist whenever state changes (only in edit mode)
  useEffect(() => {
    if (typeof window !== 'undefined' && selectedIds.length > 0 && !isReadOnly) {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            selectedIds,
            captainId,
            wicketKeeperId,
            impactPlayerId,
            updatedAt: Date.now(),
          })
        );
      } catch (e) {
        console.warn('Error saving Playing XI', e);
      }
    }
  }, [selectedIds, captainId, wicketKeeperId, impactPlayerId, storageKey, isReadOnly]);

  // Compute stats
  const selectedPlayers = useMemo(() => {
    return selectedIds
      .map((id) => squad.find((p) => p.id === id))
      .filter(Boolean) as BoughtPlayer[];
  }, [selectedIds, squad]);

  const overseasCount = selectedPlayers.filter((p) => p.isOverseas).length;
  const keeperCount = selectedPlayers.filter((p) => p.role === 'WK').length;
  const impactPlayer = squad.find((p) => p.id === impactPlayerId);

  const togglePlayer = (p: BoughtPlayer) => {
    if (isReadOnly) {
      setWarningMsg(`View Only: Only ${franchise.name} members can form this Playing XI.`);
      return;
    }
    setWarningMsg(null);
    if (selectedIds.includes(p.id)) {
      // Remove
      setSelectedIds(selectedIds.filter((id) => id !== p.id));
      if (captainId === p.id) setCaptainId(null);
      if (wicketKeeperId === p.id) setWicketKeeperId(null);
    } else {
      // Add
      if (selectedIds.length >= 11) {
        setWarningMsg('Playing XI is full (11/11). Remove a player first.');
        return;
      }
      if (p.isOverseas && overseasCount >= 4) {
        setWarningMsg('Maximum 4 Overseas players allowed in Playing XI under IPL rules.');
        return;
      }
      // If impact player, unselect from impact
      if (impactPlayerId === p.id) setImpactPlayerId(null);

      setSelectedIds([...selectedIds, p.id]);
      if (p.role === 'WK' && !wicketKeeperId) setWicketKeeperId(p.id);
    }
  };

  const setAsImpactSub = (p: BoughtPlayer) => {
    if (isReadOnly) {
      setWarningMsg(`View Only: Only ${franchise.name} members can select the Impact Player.`);
      return;
    }
    setWarningMsg(null);
    if (impactPlayerId === p.id) {
      setImpactPlayerId(null);
    } else {
      // Remove from main XI if in it
      setSelectedIds(selectedIds.filter((id) => id !== p.id));
      setImpactPlayerId(p.id);
    }
  };

  const handleCopyLineup = () => {
    const list = selectedPlayers
      .map((p, idx) => {
        const cTag = captainId === p.id ? ' (C)' : '';
        const wkTag = wicketKeeperId === p.id ? ' (WK)' : '';
        const osTag = p.isOverseas ? ' ✈️' : '';
        return `${idx + 1}. ${p.name}${cTag}${wkTag} [${p.role}]${osTag}`;
      })
      .join('\n');

    const subText = impactPlayer ? `\n\nImpact Player Substitute: ${impactPlayer.name} [${impactPlayer.role}]` : '';
    const fullText = `🏏 ${franchise.name} Official Playing XI\n${list}${subText}\n\nOverseas: ${overseasCount}/4 | Squad: ${squad.length} stars`;

    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredSquad = useMemo(() => {
    if (roleFilter === 'ALL') return squad;
    return squad.filter((p) => p.role === roleFilter);
  }, [squad, roleFilter]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div
        className="bg-slate-950 border rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        style={{ borderColor: franchise.primaryColor }}
      >
        {/* Modal Header */}
        <div
          className="p-4 sm:p-5 border-b flex items-center justify-between gap-4 text-white shrink-0"
          style={{
            background: `linear-gradient(135deg, ${franchise.primaryColor}30, #090d16)`,
            borderColor: `${franchise.primaryColor}55`,
          }}
        >
          <div className="flex items-center gap-3">
            <FranchiseLogo code={franchise.code} size="md" className="shadow-md" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg">{franchise.name} Playing XI</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-400">
                  IPL 2027
                </span>
                {isReadOnly ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300">
                    View Only — Assigned to {userAssignedFranchise ? (FRANCHISES[userAssignedFranchise]?.shortName || userAssignedFranchise) : 'Other Franchise'}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                    Active Editor • {franchise.code} Member
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300">
                {isReadOnly
                  ? `Viewing ${franchise.name}'s Playing XI formation (Only ${franchise.name} table members can edit).`
                  : 'Form and strategize your active matchday eleven live during the auction.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLineup}
              className="bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
              title="Copy Playing XI sheet to clipboard"
            >
              {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Share Lineup'}</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center border border-slate-700 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tactical Rule Counters Bar */}
        <div className="bg-slate-900 border-b border-slate-800/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-bold uppercase text-[10px]">XI Slots:</span>
              <span
                className={`font-black font-mono px-2 py-0.5 rounded ${
                  selectedIds.length === 11
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-amber-950 text-amber-400 border border-amber-800'
                }`}
              >
                {selectedIds.length} / 11
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Overseas Quota:</span>
              <span
                className={`font-black font-mono px-2 py-0.5 rounded flex items-center gap-1 ${
                  overseasCount > 4
                    ? 'bg-rose-950 text-rose-400 border border-rose-800'
                    : 'bg-blue-950 text-blue-400 border border-blue-800'
                }`}
              >
                <Plane className="w-3 h-3" />
                <span>{overseasCount} / 4 Max</span>
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Wicketkeeper:</span>
              <span
                className={`font-bold font-mono px-2 py-0.5 rounded ${
                  keeperCount >= 1
                    ? 'bg-emerald-950 text-emerald-400'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {keeperCount >= 1 ? '✓ Selected' : '⚠ None'}
              </span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 font-medium">
            Available Squad: <strong className="text-white">{squad.length} Players</strong>
          </div>
        </div>

        {warningMsg && (
          <div className="bg-rose-950/80 border-b border-rose-800 px-4 py-2 text-rose-300 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{warningMsg}</span>
          </div>
        )}

        {/* Modal Body: 2 Columns (Left: Selected XI Pitch Card, Right: Squad Picker) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Left Column (5 cols): Active Lineup Card & Pitch */}
          <div className="md:col-span-5 flex flex-col gap-3">
            <div className="bg-gradient-to-b from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-900/60 rounded-xl p-3.5 shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-emerald-900/40 pb-2 mb-2.5">
                <span className="text-[11px] font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1">
                  <span>Matchday Playing XI</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {selectedPlayers.length === 11 ? '✅ Ready' : 'Pending Selection'}
                </span>
              </div>

              {selectedPlayers.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs italic">
                  Select players from the squad roster on the right to build your matchday 11.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {selectedPlayers.map((player, idx) => {
                    const isC = captainId === player.id;
                    const isWk = wicketKeeperId === player.id;

                    return (
                      <div
                        key={player.id}
                        className="bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 rounded-lg p-2 flex items-center justify-between gap-2 text-xs transition"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-slate-500 font-bold w-4 text-center shrink-0">
                            {idx + 1}
                          </span>
                          <span
                            className={`font-black text-[9px] px-1.5 py-0.5 rounded border uppercase shrink-0 ${
                              player.role === 'BAT'
                                ? 'bg-blue-950 text-blue-300 border-blue-800'
                                : player.role === 'BOWL'
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                : player.role === 'AR'
                                ? 'bg-purple-950 text-purple-300 border-purple-800'
                                : 'bg-amber-950 text-amber-300 border-amber-800'
                            }`}
                          >
                            {player.role}
                          </span>
                          <span className="font-bold text-white truncate">{player.name}</span>
                          {player.isOverseas && (
                            <span className="text-[9px] text-blue-400 flex items-center gap-0.5 shrink-0" title="Overseas Player">
                              <Plane className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setCaptainId(isC ? null : player.id)}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-black cursor-pointer transition ${
                              isC ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-900 text-slate-500 hover:text-white'
                            }`}
                            title="Set as Captain"
                          >
                            C
                          </button>
                          <button
                            onClick={() => setWicketKeeperId(isWk ? null : player.id)}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-black cursor-pointer transition ${
                              isWk ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-900 text-slate-500 hover:text-white'
                            }`}
                            title="Set as Wicketkeeper"
                          >
                            WK
                          </button>
                          <button
                            onClick={() => togglePlayer(player)}
                            className="text-slate-500 hover:text-rose-400 p-0.5 transition cursor-pointer"
                            title="Remove from XI"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Impact Player Box */}
              <div className="mt-3 pt-2.5 border-t border-slate-800">
                <div className="flex items-center justify-between text-[11px] mb-1.5">
                  <span className="font-black text-amber-400 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>Impact Player Substitute</span>
                  </span>
                  {impactPlayer && (
                    <button
                      onClick={() => setImpactPlayerId(null)}
                      className="text-[10px] text-slate-500 hover:text-rose-400 underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {impactPlayer ? (
                  <div className="bg-slate-950 border border-amber-500/40 rounded-lg p-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded">
                        SUB
                      </span>
                      <span className="font-bold text-white">{impactPlayer.name}</span>
                      <span className="text-[10px] text-slate-400">[{impactPlayer.role}]</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-950/50 border border-dashed border-slate-800 rounded-lg p-2 text-center text-slate-500 text-[11px]">
                    Click &quot;Sub&quot; next to any bench player to nominate your Impact Player.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column (7 cols): Available Squad Picker */}
          <div className="md:col-span-7 flex flex-col gap-3">
            {/* Role Filter Tabs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {(['ALL', 'BAT', 'WK', 'AR', 'BOWL'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    roleFilter === r
                      ? 'bg-amber-500 text-slate-950 font-black shadow'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {r === 'ALL' ? `All Stars (${squad.length})` : r}
                </button>
              ))}
            </div>

            {/* Squad List */}
            <div className="space-y-1.5 overflow-y-auto max-h-[440px] pr-1">
              {filteredSquad.map((player) => {
                const isSelected = selectedIds.includes(player.id);
                const isSub = impactPlayerId === player.id;

                return (
                  <div
                    key={player.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 transition ${
                      isSelected
                        ? 'bg-emerald-950/30 border-emerald-600/70 shadow'
                        : isSub
                        ? 'bg-amber-950/30 border-amber-500/60'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                          isSelected
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {player.name[0]}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-white truncate">{player.name}</span>
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                              player.role === 'BAT'
                                ? 'bg-blue-950 text-blue-300'
                                : player.role === 'BOWL'
                                ? 'bg-emerald-950 text-emerald-300'
                                : player.role === 'AR'
                                ? 'bg-purple-950 text-purple-300'
                                : 'bg-amber-950 text-amber-300'
                            }`}
                          >
                            {player.role}
                          </span>
                          {player.isOverseas && (
                            <span className="text-[9px] bg-blue-950 text-blue-300 border border-blue-800 px-1 rounded flex items-center gap-0.5">
                              <Plane className="w-2.5 h-2.5" />
                              <span>OS</span>
                            </span>
                          )}
                        </div>

                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                          <span>{player.country}</span>
                          <span>•</span>
                          <span className="text-emerald-400 font-mono">
                            {formatIndianCurrency(player.soldAmount)}
                          </span>
                          {player.isRetained ? (
                            <span className="text-[9px] text-blue-400">Retained</span>
                          ) : (
                            <span className="text-[9px] text-emerald-400 font-bold">Auction Buy</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setAsImpactSub(player)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition cursor-pointer ${
                          isSub
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-amber-300'
                        }`}
                        title="Nominate as Impact Player"
                      >
                        {isSub ? '★ Impact' : 'Sub'}
                      </button>

                      <button
                        onClick={() => togglePlayer(player)}
                        className={`text-xs font-black px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                          isSelected
                            ? 'bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow'
                        }`}
                      >
                        {isSelected ? 'Remove' : '+ Add to XI'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
