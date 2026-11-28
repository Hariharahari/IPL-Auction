import React from 'react';
import { FranchiseCode } from '@/types/auction';

export interface FranchiseBroadcastTheme {
  code: FranchiseCode;
  name: string;
  shortName: string;
  city: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  primaryGradient: string;
  cardGradient: string;
  bannerGradient: string;
  logoUrl: string;
  crestUrl: string;
}

export const FRANCHISE_BROADCAST_THEMES: Record<FranchiseCode, FranchiseBroadcastTheme> = {
  CSK: {
    code: 'CSK',
    name: 'Chennai Super Kings',
    shortName: 'Super Kings',
    city: 'Chennai',
    primaryColor: '#F9CD05',
    secondaryColor: '#005FA2',
    accentColor: '#F59E0B',
    textColor: '#111827',
    primaryGradient: 'linear-gradient(135deg, #FDE047 0%, #F9CD05 50%, #D97706 100%)',
    cardGradient: 'linear-gradient(180deg, #F9CD05 0%, #B45309 60%, #0F172A 100%)',
    bannerGradient: 'linear-gradient(90deg, #F9CD05 0%, #D97706 70%, #92400E 100%)',
    logoUrl: '/logos/csk.svg',
    crestUrl: '/logos/csk.svg',
  },
  MI: {
    code: 'MI',
    name: 'Mumbai Indians',
    shortName: 'Indians',
    city: 'Mumbai',
    primaryColor: '#004BA0',
    secondaryColor: '#D1AB3E',
    accentColor: '#60A5FA',
    textColor: '#FFFFFF',
    primaryGradient: 'linear-gradient(135deg, #1D4ED8 0%, #004BA0 50%, #002B66 100%)',
    cardGradient: 'linear-gradient(180deg, #004BA0 0%, #002B66 60%, #070D26 100%)',
    bannerGradient: 'linear-gradient(90deg, #004BA0 0%, #002B66 70%, #0F1C4D 100%)',
    logoUrl: '/logos/mi.png',
    crestUrl: '/logos/mi.png',
  },
  RCB: {
    code: 'RCB',
    name: 'Royal Challengers Bengaluru',
    shortName: 'Royal Challengers',
    city: 'Bengaluru',
    primaryColor: '#EC1C24',
    secondaryColor: '#D1AB3E',
    accentColor: '#F87171',
    textColor: '#FFFFFF',
    primaryGradient: 'linear-gradient(135deg, #EF4444 0%, #EC1C24 50%, #7F1D1D 100%)',
    cardGradient: 'linear-gradient(180deg, #EC1C24 0%, #7F1D1D 60%, #070D26 100%)',
    bannerGradient: 'linear-gradient(90deg, #EC1C24 0%, #991B1B 70%, #450A0A 100%)',
    logoUrl: '/logos/rcb.png',
    crestUrl: '/logos/rcb.png',
  },
  KKR: {
    code: 'KKR',
    name: 'Kolkata Knight Riders',
    shortName: 'Knight Riders',
    city: 'Kolkata',
    primaryColor: '#3A225D',
    secondaryColor: '#F7D54E',
    accentColor: '#C084FC',
    textColor: '#FFFFFF',
    primaryGradient: 'linear-gradient(135deg, #581C87 0%, #3A225D 50%, #1E1035 100%)',
    cardGradient: 'linear-gradient(180deg, #3A225D 0%, #1E1035 60%, #070D26 100%)',
    bannerGradient: 'linear-gradient(90deg, #3A225D 0%, #2E1065 70%, #1E1035 100%)',
    logoUrl: '/logos/kkr.svg',
    crestUrl: '/logos/kkr.svg',
  },
  SRH: {
    code: 'SRH',
    name: 'Sunrisers Hyderabad',
    shortName: 'Sunrisers',
    city: 'Hyderabad',
    primaryColor: '#FF822A',
    secondaryColor: '#1A1A1A',
    accentColor: '#FB923C',
    textColor: '#FFFFFF',
    primaryGradient: 'linear-gradient(135deg, #FB923C 0%, #FF822A 50%, #9A3412 100%)',
    cardGradient: 'linear-gradient(180deg, #FF822A 0%, #9A3412 60%, #070D26 100%)',
    bannerGradient: 'linear-gradient(90deg, #FF822A 0%, #C2410C 70%, #7C2D12 100%)',
    logoUrl: '/logos/srh.png',
    crestUrl: '/logos/srh.png',
  },
  RR: {
    code: 'RR',
    name: 'Rajasthan Royals',
    shortName: 'Royals',
    city: 'Jaipur',
    primaryColor: '#EA1A85',
    secondaryColor: '#004BA0',
    accentColor: '#F472B6',
    textColor: '#FFFFFF',
    primaryGradient: 'linear-gradient(135deg, #F472B6 0%, #EA1A85 50%, #831843 100%)',
    cardGradient: 'linear-gradient(180deg, #EA1A85 0%, #831843 60%, #070D26 100%)',
    bannerGradient: 'linear-gradient(90deg, #EA1A85 0%, #9D174D 70%, #500724 100%)',
    logoUrl: '/logos/rr.png',
    crestUrl: '/logos/rr.png',
  },
  DC: {
    code: 'DC',
    name: 'Delhi Capitals',
    shortName: 'Capitals',
    city: 'Delhi',
    primaryColor: '#0078BC',
    secondaryColor: '#D71920',
    accentColor: '#38BDF8',
    textColor: '#FFFFFF',
    primaryGradient: 'linear-gradient(135deg, #0284C7 0%, #0078BC 50%, #0C4A6E 100%)',
    cardGradient: 'linear-gradient(180deg, #0078BC 0%, #0C4A6E 60%, #070D26 100%)',
    bannerGradient: 'linear-gradient(90deg, #0078BC 0%, #0369A1 70%, #082F49 100%)',
    logoUrl: '/logos/dc.png',
    crestUrl: '/logos/dc.png',
  },
  PBKS: {
    code: 'PBKS',
    name: 'Punjab Kings',
    shortName: 'Kings',
    city: 'Mohali',
    primaryColor: '#ED1B24',
    secondaryColor: '#C5A566',
    accentColor: '#F87171',
    textColor: '#FFFFFF',
    primaryGradient: 'linear-gradient(135deg, #EF4444 0%, #ED1B24 50%, #7F1D1D 100%)',
    cardGradient: 'linear-gradient(180deg, #ED1B24 0%, #7F1D1D 60%, #070D26 100%)',
    bannerGradient: 'linear-gradient(90deg, #ED1B24 0%, #B91C1C 70%, #450A0A 100%)',
    logoUrl: '/logos/pbks.png',
    crestUrl: '/logos/pbks.png',
  },
  GT: {
    code: 'GT',
    name: 'Gujarat Titans',
    shortName: 'Titans',
    city: 'Ahmedabad',
    primaryColor: '#1C1C1C',
    secondaryColor: '#E0A93B',
    accentColor: '#EAB308',
    textColor: '#FFFFFF',
    primaryGradient: 'linear-gradient(135deg, #374151 0%, #1C1C1C 50%, #0B132B 100%)',
    cardGradient: 'linear-gradient(180deg, #1C1C1C 0%, #0B132B 60%, #070D26 100%)',
    bannerGradient: 'linear-gradient(90deg, #1C1C1C 0%, #0B132B 70%, #020617 100%)',
    logoUrl: '/logos/gt.svg',
    crestUrl: '/logos/gt.svg',
  },
  LSG: {
    code: 'LSG',
    name: 'Lucknow Super Giants',
    shortName: 'Super Giants',
    city: 'Lucknow',
    primaryColor: '#0057E2',
    secondaryColor: '#F59E0B',
    accentColor: '#38BDF8',
    textColor: '#FFFFFF',
    primaryGradient: 'linear-gradient(135deg, #0284C7 0%, #0057E2 50%, #0A2540 100%)',
    cardGradient: 'linear-gradient(180deg, #0057E2 0%, #0A2540 60%, #070D26 100%)',
    bannerGradient: 'linear-gradient(90deg, #0057E2 0%, #0369A1 70%, #0A2540 100%)',
    logoUrl: '/logos/lsg.svg',
    crestUrl: '/logos/lsg.svg',
  },
};

export function getFranchiseTheme(code?: FranchiseCode | string | null): FranchiseBroadcastTheme {
  if (!code) return FRANCHISE_BROADCAST_THEMES.CSK;
  const upper = code.trim().toUpperCase() as FranchiseCode;
  return FRANCHISE_BROADCAST_THEMES[upper] || FRANCHISE_BROADCAST_THEMES.CSK;
}

/**
 * Authentic IPL Broadcast Cricket Jersey & Player Silhouette
 * Replaces generic initials boxes with a stylized TV trading card silhouette.
 */
export const BroadcastCricketSilhouette: React.FC<{
  code: FranchiseCode | string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ code, size = 'md', className = '' }) => {
  const theme = getFranchiseTheme(code);

  const sizeClasses = {
    sm: 'w-20 h-24',
    md: 'w-28 h-32',
    lg: 'w-36 h-40',
  }[size];

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-xl select-none ${sizeClasses} ${className}`}
      style={{
        background: `radial-gradient(circle at 50% 35%, ${theme.primaryColor}35 0%, #070D26 80%)`,
      }}
    >
      {/* Stadium Diagonal Watermark Stripes */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.08) 10px, rgba(255,255,255,0.08) 20px)',
        }}
      />

      {/* Background Watermark Franchise Code */}
      <span
        className="absolute bottom-1 font-display font-extrabold text-5xl md:text-6xl tracking-tighter opacity-15 pointer-events-none uppercase"
        style={{ color: theme.primaryColor }}
      >
        {theme.code}
      </span>

      {/* Stylized Cricket Jersey Silhouette SVG */}
      <svg
        viewBox="0 0 120 140"
        className="w-4/5 h-4/5 drop-shadow-xl relative z-10 transition-transform duration-300 group-hover:scale-105"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Head / Helmet Silhouette */}
        <ellipse cx="60" cy="24" rx="14" ry="16" fill={theme.secondaryColor} />
        {/* Helmet Grill / Brim Accent */}
        <path d="M48 26 C48 34 72 34 72 26" stroke={theme.accentColor} strokeWidth="2.5" fill="none" />
        
        {/* Neck */}
        <path d="M54 38 L66 38 L68 44 L52 44 Z" fill={theme.secondaryColor} />

        {/* Jersey Torso & Sleeves */}
        <path
          d="M38 44 L52 44 L60 52 L68 44 L82 44 L98 62 L86 72 L78 62 L78 120 L42 120 L42 62 L34 72 L22 62 Z"
          fill={theme.primaryColor}
        />

        {/* Jersey Collar V-Neck Accent */}
        <path
          d="M52 44 L60 56 L68 44"
          stroke={theme.secondaryColor}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Authentic Jersey Side Accent Panels */}
        <path d="M42 66 L42 120 L48 120 L48 66 Z" fill={theme.secondaryColor} opacity="0.8" />
        <path d="M78 66 L78 120 L72 120 L72 66 Z" fill={theme.secondaryColor} opacity="0.8" />

        {/* Center Franchise Emblem Dot / Number */}
        <circle cx="60" cy="80" r="10" fill={theme.secondaryColor} />
        <circle cx="60" cy="80" r="8" fill={theme.primaryColor} />
        <text
          x="60"
          y="84"
          textAnchor="middle"
          fill={theme.textColor}
          fontSize="9"
          fontWeight="900"
          fontFamily="sans-serif"
        >
          {theme.code}
        </text>
      </svg>
    </div>
  );
};
