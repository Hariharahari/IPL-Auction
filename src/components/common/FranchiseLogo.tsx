'use client';

import React, { useState } from 'react';
import { FRANCHISES } from '@/data/franchises';
import { FranchiseCode } from '@/types/auction';

interface FranchiseLogoProps {
  code: FranchiseCode | string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showFallbackText?: boolean;
}

const SIZE_MAP = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-7 h-7 text-[10px]',
  md: 'w-9 h-9 text-xs',
  lg: 'w-12 h-12 text-sm',
  xl: 'w-16 h-16 text-lg',
};

const IMG_SIZE_MAP = {
  xs: 'w-4 h-4',
  sm: 'w-5 h-5',
  md: 'w-7 h-7',
  lg: 'w-9 h-9',
  xl: 'w-12 h-12',
};

export const FranchiseLogo: React.FC<FranchiseLogoProps> = ({
  code,
  size = 'md',
  className = '',
  showFallbackText = true,
}) => {
  const [hasError, setHasError] = useState(false);
  const franchise = FRANCHISES[code as FranchiseCode];

  if (!franchise) {
    return (
      <div
        className={`rounded-lg bg-slate-800 border border-slate-700 font-black text-white flex items-center justify-center shrink-0 ${SIZE_MAP[size]} ${className}`}
      >
        {code}
      </div>
    );
  }

  const logoSrc = franchise.logoUrl || franchise.crestUrl;

  return (
    <div
      className={`rounded-xl flex items-center justify-center shrink-0 shadow overflow-hidden relative border transition-transform duration-150 ${SIZE_MAP[size]} ${className}`}
      style={{
        backgroundColor: franchise.primaryColor,
        borderColor: `${franchise.secondaryColor || '#ffffff'}50`,
      }}
      title={`${franchise.name} (${franchise.code})`}
    >
      {!hasError && logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoSrc}
          alt={`${franchise.name} logo`}
          className={`${IMG_SIZE_MAP[size]} object-contain filter drop-shadow-sm`}
          onError={() => setHasError(true)}
          loading="lazy"
        />
      ) : showFallbackText ? (
        <span
          className="font-black tracking-tight select-none"
          style={{ color: franchise.textColor }}
        >
          {franchise.code}
        </span>
      ) : null}
    </div>
  );
};
