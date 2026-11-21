'use client';

import React, { useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import { useAuctionStore } from '@/store/auctionStore';
import { PlayerRole, PlayerSet } from '@/types/auction';
import { FRANCHISE_LIST } from '@/data/franchises';

interface CustomPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomPlayerModal: React.FC<CustomPlayerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { addCustomPlayer } = useAuctionStore();

  const [customName, setCustomName] = useState('');
  const [customRole, setCustomRole] = useState<PlayerRole>('BAT');
  const [customCountry, setCustomCountry] = useState('India');
  const [customIsOverseas, setCustomIsOverseas] = useState(false);
  const [customBasePrice, setCustomBasePrice] = useState(100);
  const [customPrevTeam, setCustomPrevTeam] = useState<string>('');
  const [customStats, setCustomStats] = useState('');
  const [customSet, setCustomSet] = useState<PlayerSet>('Accelerated');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    await addCustomPlayer({
      name: customName.trim(),
      role: customRole,
      country: customCountry.trim(),
      isOverseas: customIsOverseas,
      basePrice: customBasePrice,
      previousTeam: (customPrevTeam as any) || null,
      statsSummary: customStats.trim() || 'Custom Nominated Player',
      set: customSet,
    });

    onClose();
    setCustomName('');
    setCustomStats('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-black text-white flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-emerald-400" />
            Add Custom Player to Auction
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 text-xs">
          <div>
            <label className="font-bold text-slate-300 block mb-1">Player Full Name</label>
            <input
              type="text"
              required
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Jasprit Bumrah"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white outline-none focus:border-amber-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-300 block mb-1">Playing Role</label>
              <select
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value as PlayerRole)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
              >
                <option value="BAT">Batter (BAT)</option>
                <option value="BOWL">Bowler (BOWL)</option>
                <option value="AR">All-Rounder (AR)</option>
                <option value="WK">Wicketkeeper (WK)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-300 block mb-1">Base Price</label>
              <select
                value={customBasePrice}
                onChange={(e) => setCustomBasePrice(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
              >
                <option value={20}>₹20 Lakhs</option>
                <option value={30}>₹30 Lakhs</option>
                <option value={50}>₹50 Lakhs</option>
                <option value={75}>₹75 Lakhs</option>
                <option value={100}>₹1.00 Crore (100L)</option>
                <option value={150}>₹1.50 Crore (150L)</option>
                <option value={200}>₹2.00 Crore (200L)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-300 block mb-1">Country</label>
              <input
                type="text"
                required
                value={customCountry}
                onChange={(e) => setCustomCountry(e.target.value)}
                placeholder="e.g. India or Australia"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
              />
            </div>

            <div>
              <label className="font-bold text-slate-300 block mb-1">Previous Franchise</label>
              <select
                value={customPrevTeam}
                onChange={(e) => setCustomPrevTeam(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
              >
                <option value="">None (No RTM)</option>
                {FRANCHISE_LIST.map((f) => (
                  <option key={f.code} value={f.code}>
                    {f.name} ({f.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isOverseasCustom"
              checked={customIsOverseas}
              onChange={(e) => setCustomIsOverseas(e.target.checked)}
              className="rounded border-slate-700 text-amber-500 focus:ring-amber-500"
            />
            <label htmlFor="isOverseasCustom" className="font-bold text-slate-300 cursor-pointer">
              Is Overseas Player (Counts towards 8 Overseas Quota)
            </label>
          </div>

          <div>
            <label className="font-bold text-slate-300 block mb-1">Career Stats Summary</label>
            <input
              type="text"
              value={customStats}
              onChange={(e) => setCustomStats(e.target.value)}
              placeholder="e.g. Matches: 85 | Runs: 2150 | SR: 135.4"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-lg"
            >
              Add Player to Pool
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
