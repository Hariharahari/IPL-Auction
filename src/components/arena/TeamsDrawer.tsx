'use client';

import React from 'react';
import { X, Shield } from 'lucide-react';
import { PurseLeaderboard } from './PurseLeaderboard';

interface TeamsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TeamsDrawer: React.FC<TeamsDrawerProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      />

      {/* Drawer Panel */}
      <div className="absolute inset-y-0 left-0 w-full max-w-md bg-slate-900 border-r border-slate-800 shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
        {/* Header */}
        <div className="h-14 border-b border-slate-800 px-4 flex items-center justify-between shrink-0 bg-slate-950/70">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-black text-sm text-white">Franchise Purses & Squads</h2>
              <p className="text-[10px] text-slate-400">All 10 IPL Franchises • Live Purses & Roster Size</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4">
          <PurseLeaderboard />
        </div>
      </div>
    </div>
  );
};
