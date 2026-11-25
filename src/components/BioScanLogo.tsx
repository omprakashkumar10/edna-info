import React from 'react';

interface LogoProps {
  size?: number;
  variant?: 'dark-bg' | 'light-bg';
  showTagline?: boolean;
}

export const BioScanLogo: React.FC<LogoProps> = ({
  size = 36,
  variant = 'light-bg',
  showTagline = false,
}) => {
  const titleColor = variant === 'dark-bg' ? 'text-white' : 'text-slate-900 dark:text-white';
  const taglineColor = variant === 'dark-bg' ? 'text-emerald-300/80' : 'text-emerald-800 dark:text-emerald-400';

  return (
    <div className="inline-flex items-center gap-3 select-none shrink-0">
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect
          x="2"
          y="2"
          width="44"
          height="44"
          rx="12"
          fill={variant === 'dark-bg' ? '#0F3D2E' : '#ECFDF5'}
          stroke={variant === 'dark-bg' ? '#10B981' : '#059669'}
          strokeWidth="1.75"
        />
        {/* Outer biodiversity conservation ring */}
        <circle
          cx="24"
          cy="24"
          r="15.5"
          stroke={variant === 'dark-bg' ? '#34D399' : '#047857'}
          strokeOpacity="0.35"
          strokeWidth="1.25"
          strokeDasharray="3 3"
        />
        {/* DNA Double Helix Strands */}
        <path
          d="M15 12C15 18 27 18 27 24C27 30 15 30 15 36"
          stroke={variant === 'dark-bg' ? '#6EE7B7' : '#065F46'}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M27 12C27 18 15 18 15 24C15 30 27 30 27 36"
          stroke={variant === 'dark-bg' ? '#10B981' : '#10B981'}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {/* Base-pair rungs */}
        <line x1="17" y1="15" x2="25" y2="15" stroke={variant === 'dark-bg' ? '#A7F3D0' : '#047857'} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="17" y1="24" x2="25" y2="24" stroke={variant === 'dark-bg' ? '#A7F3D0' : '#047857'} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="17" y1="33" x2="25" y2="33" stroke={variant === 'dark-bg' ? '#A7F3D0' : '#047857'} strokeWidth="1.5" strokeLinecap="round" />
        {/* Botanical Leaf & Conservation Motif */}
        <path
          d="M35.5 14C30.5 14 27.5 18 27.5 23.5C32.5 23.5 36.5 20.5 36.5 14.5C36.5 14.2 36.1 14 35.5 14Z"
          fill={variant === 'dark-bg' ? '#34D399' : '#059669'}
        />
        <path
          d="M27.5 23.5L33.5 17.5"
          stroke={variant === 'dark-bg' ? '#064E3B' : '#FFFFFF'}
          strokeWidth="1.25"
          strokeLinecap="round"
        />
      </svg>
      <div className="flex flex-col leading-tight">
        <span className={`text-base font-bold tracking-tight whitespace-nowrap ${titleColor}`}>
          eDNA BioScan
        </span>
        {showTagline && (
          <span className={`text-[11px] font-medium tracking-wide whitespace-nowrap ${taglineColor}`}>
            Discover. Analyze. Conserve.
          </span>
        )}
      </div>
    </div>
  );
};
