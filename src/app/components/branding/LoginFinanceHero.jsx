/**
 * Animated login hero for financial / switching platforms.
 * Uses brand greens on a dark panel — no external animation libs.
 */
export function LoginFinanceHero({ className = "" }) {
  return (
    <div className={`login-finance-hero relative w-full max-w-[360px] select-none ${className}`} aria-hidden>
      <style>{`
        @keyframes lfh-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes lfh-float-delayed {
          0%, 100% { transform: translateY(0) rotate(-6deg); }
          50% { transform: translateY(-8px) rotate(-4deg); }
        }
        @keyframes lfh-pulse {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.06); }
        }
        @keyframes lfh-dash {
          to { stroke-dashoffset: -48; }
        }
        @keyframes lfh-coin {
          0%, 100% { transform: translateY(0); opacity: 0.9; }
          50% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes lfh-bar {
          0%, 100% { transform: scaleY(0.72); }
          50% { transform: scaleY(1); }
        }
        @keyframes lfh-glow {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 0.85; }
        }
        .lfh-card-main { animation: lfh-float 4.2s ease-in-out infinite; transform-origin: center; }
        .lfh-card-back { animation: lfh-float-delayed 4.8s ease-in-out infinite; transform-origin: center; }
        .lfh-ring { animation: lfh-pulse 3.6s ease-in-out infinite; transform-origin: center; }
        .lfh-path { stroke-dasharray: 10 8; animation: lfh-dash 1.4s linear infinite; }
        .lfh-coin { animation: lfh-coin 2.8s ease-in-out infinite; }
        .lfh-coin-2 { animation: lfh-coin 3.2s ease-in-out infinite 0.4s; }
        .lfh-coin-3 { animation: lfh-coin 3s ease-in-out infinite 0.8s; }
        .lfh-bar { transform-box: fill-box; transform-origin: bottom; animation: lfh-bar 2.6s ease-in-out infinite; }
        .lfh-bar-2 { animation-delay: 0.25s; }
        .lfh-bar-3 { animation-delay: 0.5s; }
        .lfh-bar-4 { animation-delay: 0.75s; }
        .lfh-shield-glow { animation: lfh-glow 3s ease-in-out infinite; }
      `}</style>

      <svg viewBox="0 0 420 420" className="h-auto w-full" role="img" aria-label="Financial services illustration">
        <defs>
          <linearGradient id="lfh-card" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7a9e60" />
            <stop offset="55%" stopColor="#548235" />
            <stop offset="100%" stopColor="#3d6424" />
          </linearGradient>
          <linearGradient id="lfh-card-lite" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c8e6b0" />
            <stop offset="100%" stopColor="#a8c48a" />
          </linearGradient>
          <linearGradient id="lfh-mint" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#dff0c8" />
            <stop offset="100%" stopColor="#b0d995" />
          </linearGradient>
          <radialGradient id="lfh-aura" cx="50%" cy="48%" r="48%">
            <stop offset="0%" stopColor="#548235" stopOpacity="0.35" />
            <stop offset="70%" stopColor="#548235" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#1a1a1a" stopOpacity="0" />
          </radialGradient>
          <filter id="lfh-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#000" floodOpacity="0.45" />
          </filter>
        </defs>

        {/* Soft aura */}
        <circle cx="210" cy="210" r="170" fill="url(#lfh-aura)" className="lfh-ring" />

        {/* Orbit ring */}
        <circle
          cx="210"
          cy="210"
          r="148"
          fill="none"
          stroke="#a8c48a"
          strokeOpacity="0.22"
          strokeWidth="1.5"
          strokeDasharray="4 10"
        />

        {/* Transfer path */}
        <path
          className="lfh-path"
          d="M78 250 C120 180, 170 160, 210 168 C255 178, 300 210, 342 248"
          fill="none"
          stroke="#b0d995"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.85"
        />

        {/* Back card */}
        <g className="lfh-card-back" filter="url(#lfh-soft)">
          <rect x="96" y="128" width="176" height="112" rx="18" fill="url(#lfh-card-lite)" opacity="0.92" />
          <rect x="112" y="152" width="72" height="10" rx="5" fill="#548235" opacity="0.35" />
          <rect x="112" y="172" width="48" height="8" rx="4" fill="#548235" opacity="0.25" />
        </g>

        {/* Main payment card */}
        <g className="lfh-card-main" filter="url(#lfh-soft)">
          <rect x="132" y="148" width="196" height="124" rx="20" fill="url(#lfh-card)" />
          <rect x="152" y="172" width="36" height="28" rx="6" fill="#dff0c8" opacity="0.9" />
          <rect x="152" y="214" width="110" height="10" rx="5" fill="#dff0c8" opacity="0.55" />
          <rect x="152" y="232" width="72" height="8" rx="4" fill="#dff0c8" opacity="0.35" />
          <circle cx="292" cy="188" r="14" fill="#c8e6b0" opacity="0.85" />
          <circle cx="310" cy="188" r="14" fill="#a8c48a" opacity="0.7" />
          <text x="152" y="268" fill="#e8f5d9" fontSize="13" fontFamily="system-ui,sans-serif" fontWeight="600" letterSpacing="1.5">
            BELEMA PAY
          </text>
        </g>

        {/* Growth bars */}
        <g transform="translate(286 286)">
          <rect className="lfh-bar" x="0" y="28" width="12" height="36" rx="3" fill="#7a9e60" />
          <rect className="lfh-bar lfh-bar-2" x="18" y="16" width="12" height="48" rx="3" fill="#a8c48a" />
          <rect className="lfh-bar lfh-bar-3" x="36" y="8" width="12" height="56" rx="3" fill="#b0d995" />
          <rect className="lfh-bar lfh-bar-4" x="54" y="0" width="12" height="64" rx="3" fill="#dff0c8" />
        </g>

        {/* Coins */}
        <g className="lfh-coin">
          <circle cx="72" cy="168" r="22" fill="url(#lfh-mint)" />
          <circle cx="72" cy="168" r="16" fill="none" stroke="#548235" strokeWidth="2" opacity="0.55" />
          <text x="72" y="174" textAnchor="middle" fill="#2f3d2a" fontSize="16" fontFamily="system-ui,sans-serif" fontWeight="700">₦</text>
        </g>
        <g className="lfh-coin-2">
          <circle cx="348" cy="152" r="18" fill="#c8e6b0" />
          <text x="348" y="158" textAnchor="middle" fill="#3d6424" fontSize="14" fontFamily="system-ui,sans-serif" fontWeight="700">$</text>
        </g>
        <g className="lfh-coin-3">
          <circle cx="86" cy="292" r="16" fill="#a8c48a" />
          <text x="86" y="297" textAnchor="middle" fill="#2f3d2a" fontSize="12" fontFamily="system-ui,sans-serif" fontWeight="700">€</text>
        </g>

        {/* Secure shield */}
        <g transform="translate(178 292)" filter="url(#lfh-soft)">
          <ellipse className="lfh-shield-glow" cx="28" cy="34" rx="34" ry="18" fill="#548235" opacity="0.35" />
          <path
            d="M28 4 L48 14 V30 C48 42 38 50 28 54 C18 50 8 42 8 30 V14 Z"
            fill="#dff0c8"
            stroke="#548235"
            strokeWidth="2"
          />
          <path d="M20 30 L26 36 L38 22" fill="none" stroke="#548235" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  );
}
