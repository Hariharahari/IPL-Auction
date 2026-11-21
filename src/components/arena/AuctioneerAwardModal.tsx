'use client';

import React, { useState } from 'react';
import { Gavel, X, Crown, AlertCircle } from 'lucide-react';
import { FranchiseCode, Player } from '@/types/auction';
import { FRANCHISE_LIST, FRANCHISES } from '@/data/franchises';
import { formatIndianCurrency } from '@/lib/utils';
import { useAuctionStore } from '@/store/auctionStore';

interface AuctioneerAwardModalProps {
  player: Player;
  onClose: () => void;
}

export const AuctioneerAwardModal: React.FC<AuctioneerAwardModalProps> = ({
  player,
  onClose,
}) => {
  const { room, hammerSold } = useAuctionStore();

  const initialWinningTeam: FranchiseCode = room?.highestBidderTeam || 'CSK';
  const initialLakhs =
    room?.currentBid && room.currentBid > 0 ? room.currentBid : player.basePrice;

  const [selectedTeam, setSelectedTeam] = useState<FranchiseCode>(initialWinningTeam);
  const [soldPriceLakhs, setSoldPriceLakhs] = useState<number>(initialLakhs);
  const [soldPriceCr, setSoldPriceCr] = useState<string>((initialLakhs / 100).toFixed(2));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePriceCrChange = (val: string) => {
    setSoldPriceCr(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed >= 0) {
      setSoldPriceLakhs(Math.round(parsed * 100));
    }
  };

  const handlePriceLakhsChange = (lakhs: number) => {
    setSoldPriceLakhs(lakhs);
    setSoldPriceCr((lakhs / 100).toFixed(2));
  };

  const handleQuickAdd = (addLakhs: number) => {
    const next = Math.max(0, soldPriceLakhs + addLakhs);
    handlePriceLakhsChange(next);
  };

  const handleConfirmAward = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await hammerSold({
        winningTeam: selectedTeam,
        finalPrice: soldPriceLakhs,
      });

      if (res.success) {
        onClose();
      } else {
        setErrorMsg(res.error || 'Failed to award player');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error finalizing sale');
    } finally {
      setIsSubmitting(false);
    }
  };

  const chosenFranchise = FRANCHISES[selectedTeam];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-amber-500/60 rounded-3xl p-6 shadow-2xl flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40">
              <Gavel className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm text-white">Award & Hammer SOLD</h3>
              <p className="text-[11px] text-slate-400">
                Nominated: <strong className="text-white">{player.name}</strong> ({player.role})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step 1: Select Winning Franchise */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            1. Select Winning Franchise
          </label>
          <div className="grid grid-cols-5 gap-1.5">
            {FRANCHISE_LIST.map((f) => {
              const teamData = room?.teams[f.code];
              const remainingCr = ((teamData?.remainingPurse || 0) / 100).toFixed(1);
              const isSelected = selectedTeam === f.code;

              return (
                <button
                  key={f.code}
                  type="button"
                  onClick={() => {
                    setSelectedTeam(f.code);
                    setErrorMsg(null);
                  }}
                  className={`p-2 rounded-xl border text-center transition flex flex-col items-center justify-center cursor-pointer ${
                    isSelected
                      ? 'border-amber-400 bg-amber-500/20 text-white shadow-lg shadow-amber-500/20 ring-1 ring-amber-400'
                      : 'border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300'
                  }`}
                  style={{
                    borderColor: isSelected ? f.primaryColor : undefined,
                  }}
                >
                  <span className="font-black text-xs leading-none" style={{ color: f.primaryColor }}>
                    {f.code}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 mt-1 leading-none">
                    ₹{remainingCr}Cr
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Final Sold Price */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              2. Final Sold Price
            </label>
            <span className="text-xs text-amber-400 font-bold font-mono">
              {formatIndianCurrency(soldPriceLakhs)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 px-3 py-2 rounded-xl flex-1">
              <span className="text-amber-400 font-black text-sm">₹</span>
              <input
                type="number"
                step="0.05"
                min="0"
                value={soldPriceCr}
                onChange={(e) => handlePriceCrChange(e.target.value)}
                className="w-full bg-transparent text-white font-black text-base outline-none font-mono"
                placeholder="2.00"
              />
              <span className="text-slate-400 font-bold text-xs">Cr</span>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 px-3 py-2 rounded-xl w-32">
              <input
                type="number"
                step="5"
                min="0"
                value={soldPriceLakhs}
                onChange={(e) => handlePriceLakhsChange(Number(e.target.value))}
                className="w-full bg-transparent text-white font-black text-sm outline-none font-mono"
                placeholder="200"
              />
              <span className="text-slate-400 font-bold text-xs">Lakhs</span>
            </div>
          </div>

          {/* Quick Increment Pills */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <button
              type="button"
              onClick={() => handlePriceLakhsChange(player.basePrice)}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-[10px] font-bold text-slate-300 border border-slate-700 cursor-pointer"
            >
              Base ({formatIndianCurrency(player.basePrice)})
            </button>
            <button
              type="button"
              onClick={() => handleQuickAdd(10)}
              className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-[10px] font-bold text-amber-300 border border-slate-700 cursor-pointer"
            >
              +10L
            </button>
            <button
              type="button"
              onClick={() => handleQuickAdd(25)}
              className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-[10px] font-bold text-amber-300 border border-slate-700 cursor-pointer"
            >
              +25L
            </button>
            <button
              type="button"
              onClick={() => handleQuickAdd(50)}
              className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-[10px] font-bold text-amber-300 border border-slate-700 cursor-pointer"
            >
              +50L
            </button>
            <button
              type="button"
              onClick={() => handleQuickAdd(100)}
              className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-[10px] font-bold text-emerald-300 border border-slate-700 cursor-pointer"
            >
              +1.00 Cr
            </button>
            <button
              type="button"
              onClick={() => handleQuickAdd(200)}
              className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-[10px] font-bold text-emerald-300 border border-slate-700 cursor-pointer"
            >
              +2.00 Cr
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs font-bold flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Step 3: Big Confirm Hammer SOLD Button */}
        <button
          type="button"
          onClick={handleConfirmAward}
          disabled={isSubmitting}
          className="w-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 hover:brightness-110 disabled:opacity-40 text-white font-black py-3.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-900/30 transition cursor-pointer"
        >
          <Gavel className="w-4 h-4" />
          <span>
            {isSubmitting
              ? 'Finalizing Sold Award...'
              : `🔨 CONFIRM SOLD: Award to ${chosenFranchise.name} for ₹${soldPriceCr} Cr`}
          </span>
        </button>
      </div>
    </div>
  );
};
