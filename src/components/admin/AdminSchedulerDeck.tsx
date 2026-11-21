'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  UserCheck,
  Shield,
  Plus,
  Trash2,
  ExternalLink,
  Users,
  CheckCircle2,
  AlertCircle,
  Radio,
  FileSpreadsheet,
  Gavel,
  PowerOff,
  Sparkles,
} from 'lucide-react';
import { FRANCHISE_LIST } from '@/data/franchises';
import { FranchiseCode } from '@/types/auction';
import { getStoredUser, SUPER_ADMIN_EMAIL } from '@/lib/utils';
import { ScheduledAuction } from '@/server/scheduleService';
import { PlayerPoolUploader, UploadTarget } from '@/components/arena/PlayerPoolUploader';

interface AdminSchedulerDeckProps {
  onAuctionSelected?: (roomCode: string) => void;
}

export const AdminSchedulerDeck: React.FC<AdminSchedulerDeckProps> = ({ onAuctionSelected }) => {
  const [currentUser, setCurrentUser] = useState(getStoredUser());
  const [auctions, setAuctions] = useState<ScheduledAuction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Scheduling Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [title, setTitle] = useState('IPL 2027 Mini-Auction Main Stage');
  const [roomCode, setRoomCode] = useState(() => Math.random().toString(36).substring(2, 8).toUpperCase());
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [appointedAuctioneerEmail, setAppointedAuctioneerEmail] = useState(SUPER_ADMIN_EMAIL);
  const [appointedAuctioneerName, setAppointedAuctioneerName] = useState('Hariharan (Auctioneer)');
  const [teamAssignments, setTeamAssignments] = useState<Partial<Record<FranchiseCode, string>>>({
    CSK: 'hariharan12403@gmail.com',
  });
  const [notes, setNotes] = useState('Official mini-auction with ₹130 Cr purse and 25-player roster cap.');

  // Global Uploader Modal
  const [isUploaderOpen, setIsUploaderOpen] = useState(false);
  const [uploaderTarget, setUploaderTarget] = useState<UploadTarget>('RETAINED_SQUADS');

  // Load scheduled auctions
  const fetchSchedules = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/admin/schedule?email=${encodeURIComponent(currentUser.userEmail || '')}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.auctions)) {
        setAuctions(data.auctions);
      }
    } catch (e) {
      console.warn('Error fetching schedules:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setCurrentUser(getStoredUser());
    fetchSchedules();
  }, []);

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Convert comma-separated emails to arrays per franchise
    const formattedAssignments: Partial<Record<FranchiseCode, string[]>> = {};
    for (const [code, emailStr] of Object.entries(teamAssignments)) {
      if (emailStr && typeof emailStr === 'string') {
        const emails = emailStr
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        if (emails.length > 0) {
          formattedAssignments[code as FranchiseCode] = emails;
        }
      }
    }

    try {
      const res = await fetch('/api/admin/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminEmail: currentUser.userEmail,
          title,
          roomCode,
          scheduledAt: new Date(scheduledAt).toISOString(),
          appointedAuctioneerEmail,
          appointedAuctioneerName,
          teamAssignments: formattedAssignments,
          notes,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to schedule auction');
      }

      setSuccessMsg(data.message || 'Auction scheduled successfully!');
      setIsFormOpen(false);
      setRoomCode(Math.random().toString(36).substring(2, 8).toUpperCase());
      fetchSchedules();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Scheduling error');
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('Are you sure you want to remove this scheduled auction?')) return;
    try {
      const res = await fetch(`/api/admin/schedule?id=${encodeURIComponent(id)}&adminEmail=${encodeURIComponent(currentUser.userEmail)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Scheduled auction removed.');
        fetchSchedules();
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const handleEndLiveAuction = (code: string) => {
    if (!confirm(`Are you sure you want to END the Live Auction for room ${code}?`)) return;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ipl_active_room_code');
    }
    setSuccessMsg(`Live auction for ${code} ended and reset.`);
    fetchSchedules();
  };

  const isAdminUser = Boolean(
    currentUser.isAdmin ||
    (currentUser.userEmail && currentUser.userEmail.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase())
  );

  return (
    <div className="space-y-6 text-xs animate-in fade-in">
      {/* Admin Privilege Banner */}
      <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-blue-950/60 border border-amber-500/40 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                {isAdminUser ? 'Super Admin Deck' : 'Auction Hub'}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {currentUser.userEmail || 'Not signed in'}
              </span>
            </div>
            <h3 className="text-base font-black text-white mt-0.5">
              {isAdminUser
                ? 'Master Auction Control & Member Delegation'
                : 'Scheduled IPL 2027 Auctions'}
            </h3>
          </div>
        </div>

        {isAdminUser && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setUploaderTarget('RETAINED_SQUADS');
                setIsUploaderOpen(true);
              }}
              className="bg-blue-600 hover:bg-blue-500 text-white font-black px-3 py-2 rounded-xl flex items-center gap-1.5 shadow transition cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Update Server Squads</span>
            </button>
            <button
              onClick={() => {
                setUploaderTarget('AUCTION_POOL');
                setIsUploaderOpen(true);
              }}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3 py-2 rounded-xl flex items-center gap-1.5 shadow transition cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Update Server Pool</span>
            </button>
            <button
              onClick={() => setIsFormOpen(!isFormOpen)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-3 py-2 rounded-xl flex items-center gap-1.5 shadow transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isFormOpen ? 'Close Form' : 'Schedule New Auction'}</span>
            </button>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-xs font-bold text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs font-bold text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Schedule Auction Form (Only for Admin) */}
      {isAdminUser && isFormOpen && (
        <form
          onSubmit={handleCreateSchedule}
          className="bg-slate-900 border border-amber-500/40 rounded-2xl p-6 shadow-2xl space-y-4 backdrop-blur-md animate-in fade-in"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>Schedule New Live Auction</span>
            </h4>
            <span className="text-[11px] text-amber-400 font-bold">
              Only Admin can appoint auctioneers & assign team bidders
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Auction Event Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Room Code (6 Letters)
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono font-black text-amber-400 focus:border-amber-500 text-center uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Scheduled Date & Time
              </label>
              <input
                type="datetime-local"
                required
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:border-amber-500"
              />
            </div>
          </div>

          {/* Appointed Auctioneer */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950 p-3 rounded-xl border border-slate-800">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-amber-400 mb-1 flex items-center gap-1.5">
                <Gavel className="w-3.5 h-3.5" />
                <span>Appointed Auctioneer Email (Gavel Controller)</span>
              </label>
              <input
                type="email"
                required
                value={appointedAuctioneerEmail}
                onChange={(e) => setAppointedAuctioneerEmail(e.target.value)}
                placeholder="e.g. auctioneer@ipl.com"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-amber-500 font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Auctioneer Display Name
              </label>
              <input
                type="text"
                value={appointedAuctioneerName}
                onChange={(e) => setAppointedAuctioneerName(e.target.value)}
                placeholder="e.g. Richard Madley / Charu Sharma"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-amber-500 font-medium"
              />
            </div>
          </div>

          {/* Franchise Member Delegation Grid */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>Franchise Team Member Assignments (Comma-separated emails per franchise)</span>
            </label>
            <p className="text-[11px] text-slate-500 mb-2.5">
              Only users listed here will be granted exclusive bidding rights for that franchise. All other attendees join as spectators.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
              {FRANCHISE_LIST.map((f) => (
                <div key={f.code} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: f.primaryColor }}
                    />
                    <span className="font-black text-white">{f.code}</span>
                    <span className="text-[10px] text-slate-400 truncate">({f.shortName})</span>
                  </div>
                  <input
                    type="text"
                    placeholder="email1@..., email2@..."
                    value={teamAssignments[f.code] || ''}
                    onChange={(e) =>
                      setTeamAssignments((prev) => ({
                        ...prev,
                        [f.code]: e.target.value,
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-200 placeholder-slate-600 focus:border-amber-500"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 text-slate-950 font-black px-5 py-2 rounded-xl shadow-lg shadow-amber-500/20 transition cursor-pointer"
            >
              Save & Schedule Auction
            </button>
          </div>
        </form>
      )}

      {/* List of Scheduled Auctions */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span>Scheduled & Active Auctions ({auctions.length})</span>
          </h4>
          <button
            onClick={fetchSchedules}
            className="text-[11px] text-slate-400 hover:text-amber-400 transition"
          >
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-slate-500">Loading auction schedules...</div>
        ) : auctions.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            No auctions scheduled yet. {isAdminUser && 'Click "Schedule New Auction" above to create one.'}
          </div>
        ) : (
          <div className="space-y-3">
            {auctions.map((auc) => {
              const dateStr = new Date(auc.scheduledAt).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              });
              const appointedEmail = auc.appointedAuctioneerEmail || (auc as any).auctioneerEmail || '';
              const isAuctioneer =
                Boolean(currentUser.userEmail &&
                appointedEmail &&
                appointedEmail.toLowerCase() === currentUser.userEmail.toLowerCase());

              return (
                <div
                  key={auc.id}
                  className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-amber-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-xs">
                        {auc.roomCode}
                      </span>
                      <h5 className="font-black text-sm text-white">{auc.title}</h5>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          auc.status === 'LIVE'
                            ? 'bg-rose-950 text-rose-400 border border-rose-800 animate-pulse'
                            : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        }`}
                      >
                        {auc.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-[11px] text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1 text-slate-300">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>{dateStr}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Gavel className="w-3.5 h-3.5 text-blue-400" />
                        <span>
                          Auctioneer: <strong className="text-white">{appointedEmail || 'Not Appointed'}</strong>
                        </span>
                      </span>
                      {isAuctioneer && (
                        <span className="text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800">
                          ★ You are Appointed Auctioneer
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <Link
                      href={`/room/${auc.roomCode}/arena`}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 shadow transition"
                    >
                      <Radio className="w-3 h-3" />
                      <span>Live Stage</span>
                    </Link>
                    <Link
                      href={`/room/${auc.roomCode}/lobby`}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3 py-1.5 rounded-lg text-xs border border-slate-700 transition"
                    >
                      Lobby
                    </Link>
                    <Link
                      href={`/room/${auc.roomCode}/squads`}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3 py-1.5 rounded-lg text-xs border border-slate-700 transition"
                    >
                      Squads
                    </Link>

                    {isAdminUser && (
                      <>
                        <button
                          onClick={() => handleEndLiveAuction(auc.roomCode)}
                          title="End this live auction session"
                          className="bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 font-black px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 transition cursor-pointer"
                        >
                          <PowerOff className="w-3 h-3" />
                          <span>End</span>
                        </button>
                        <button
                          onClick={() => handleDeleteSchedule(auc.id)}
                          title="Delete scheduled auction"
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-900 rounded-lg transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Server Global Uploader Modal */}
      {isUploaderOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
          <PlayerPoolUploader
            initialTarget={uploaderTarget}
            onClose={() => setIsUploaderOpen(false)}
          />
        </div>
      )}
    </div>
  );
};
