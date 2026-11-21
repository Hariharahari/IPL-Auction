'use client';

import React, { useState, useEffect } from 'react';
import { Shield, User, Mail, Sparkles, CheckCircle2, Lock, ArrowRight } from 'lucide-react';
import { getStoredUser, saveStoredUser, SUPER_ADMIN_EMAIL, StoredSession } from '@/lib/utils';
import { useAuctionStore } from '@/store/auctionStore';

interface LoginModalProps {
  isOpen?: boolean;
  onSuccess?: (session: StoredSession) => void;
  allowClose?: boolean;
  onClose?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen = true,
  onSuccess,
  allowClose = false,
  onClose,
}) => {
  const { setIdentity } = useAuctionStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const current = getStoredUser();
    if (current.userName) setName(current.userName);
    if (current.userEmail) setEmail(current.userEmail);
  }, []);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      setErrorMsg('Full Name is required to enter the platform.');
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMsg('A valid Email Address is mandatory.');
      return;
    }

    setIsSubmitting(true);
    const session = saveStoredUser(cleanName, cleanEmail);
    setIdentity(cleanName);

    setIsSubmitting(false);
    if (onSuccess) onSuccess(session);
    if (onClose) onClose();
  };

  const isSuperAdminEmail = email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center gap-3 mb-6 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black tracking-widest text-amber-400 uppercase bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              Access Gate
            </span>
            <h2 className="text-xl font-black text-white tracking-tight mt-0.5">
              IPL Auction Platform Login
            </h2>
          </div>
        </div>

        <p className="text-xs text-slate-400 mb-5 relative z-10 leading-relaxed">
          Name and Email are mandatory to participate. The platform enforces authentic franchise bidding, scheduled auctions, and role-based permissions.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          {/* Name Field */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-amber-400" />
              <span>Full Name</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hariharan, Akash Ambani, Gautam Gambhir"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition font-medium"
            />
          </div>

          {/* Email Field */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-blue-400" />
              <span>Email Address</span>
              {isSuperAdminEmail && (
                <span className="ml-auto text-[10px] text-amber-400 font-black uppercase bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/30">
                  Super Admin
                </span>
              )}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. hariharan12403@gmail.com"
              className={`w-full bg-slate-950 border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none transition font-medium ${
                isSuperAdminEmail
                  ? 'border-amber-500 ring-1 ring-amber-500/50'
                  : 'border-slate-800 focus:border-amber-500'
              }`}
            />
          </div>

          {/* Role Indicator Preview */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 flex items-start gap-2.5">
            <Shield className={`w-4 h-4 shrink-0 mt-0.5 ${isSuperAdminEmail ? 'text-amber-400' : 'text-blue-400'}`} />
            <div className="text-[11px] leading-relaxed">
              {isSuperAdminEmail ? (
                <span className="text-amber-300 font-bold block">
                  👑 Super Admin Access: Full permissions for global server squads, auction scheduling, appointing auctioneers, and team member assignments.
                </span>
              ) : (
                <span className="text-slate-400 block">
                  Standard Member Access: Default user role. Can participate in scheduled auctions or join assigned franchise tables.
                </span>
              )}
            </div>
          </div>

          {/* Quick Pre-fill Super Admin Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                setName('Hariharan');
                setEmail(SUPER_ADMIN_EMAIL);
              }}
              className="text-[11px] text-amber-400/80 hover:text-amber-300 hover:underline flex items-center gap-1 transition"
            >
              <Sparkles className="w-3 h-3" />
              <span>Quick Fill Super Admin ({SUPER_ADMIN_EMAIL})</span>
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-xs font-bold text-rose-300 text-center animate-in fade-in">
              {errorMsg}
            </div>
          )}

          <div className="pt-2 flex gap-2">
            {allowClose && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-xl text-xs transition"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 text-slate-950 font-black py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer"
            >
              <span>{isSuperAdminEmail ? 'Enter as Super Admin' : 'Enter Auction Hub'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
