export function Logo({ size = 28 }: { size?: number }) {
  return (
    <div className="inline-flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="nops-grad" x1="10" y1="8" x2="56" y2="58" gradientUnits="userSpaceOnUse">
            <stop stopColor="#60a5fa" />
            <stop offset="0.55" stopColor="#a78bfa" />
            <stop offset="1" stopColor="#22c55e" />
          </linearGradient>
          <filter id="nops-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx="20" cy="22" r="4" fill="url(#nops-grad)" filter="url(#nops-glow)" />
        <circle cx="44" cy="16" r="4" fill="url(#nops-grad)" filter="url(#nops-glow)" />
        <circle cx="46" cy="40" r="4" fill="url(#nops-grad)" filter="url(#nops-glow)" />
        <circle cx="24" cy="46" r="4" fill="url(#nops-grad)" filter="url(#nops-glow)" />
        <path
          d="M23.2 24.4L40.6 18.6M46 20.2V36M43.6 39.2L27 44.6M22.2 43.2L20.6 26"
          stroke="url(#nops-grad)"
          strokeWidth="3.2"
          strokeLinecap="round"
          opacity="0.9"
        />
        <path
          d="M14 33c3.8-8.2 11.6-14 20.8-14 11.7 0 21.2 9.5 21.2 21.2 0 9.2-5.8 17-14 20.8"
          stroke="url(#nops-grad)"
          strokeWidth="2.6"
          strokeLinecap="round"
          opacity="0.35"
        />
      </svg>
      <div className="leading-tight">
        <div className="text-sm font-semibold tracking-tight text-slate-50">NeuralOps</div>
        <div className="text-[11px] tracking-widest text-slate-400">AI</div>
      </div>
    </div>
  )
}

