'use client';

import { useId } from 'react';

interface AnalogClockProps {
  time: Date;
  size?: number;
  className?: string;
}

export default function AnalogClock({ time, size = 40, className = '' }: AnalogClockProps) {
  // Unique prefix so multiple clock instances on the same page don't share SVG IDs
  const uid = useId().replace(/:/g, '-');

  const hours = time.getHours();
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();
  const ms = time.getMilliseconds();

  // Smooth angle calculations (continuous movement)
  const secondAngle = ((seconds + ms / 1000) / 60) * 360;
  const minuteAngle = ((minutes + (seconds + ms / 1000) / 60) / 60) * 360;
  const hourAngle = (((hours % 12) + minutes / 60 + seconds / 3600) / 12) * 360;

  // SVG uses a 100×100 viewBox with centre at (50,50)
  const cx = 50;
  const cy = 50;
  const r = 47; // outer face radius

  // Helper: polar → cartesian from centre
  const polar = (angleDeg: number, radius: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  };

  // Upright hand path (pointing to 12), rotated via transform="rotate(angle, cx, cy)"
  // This lets CSS transition: transform work properly.
  // Shape: diamond-tapered from tail (below centre) to tip (above centre).
  const handPath = (length: number, width: number, tail: number) =>
    `M ${cx} ${cy + tail} L ${cx - width / 2} ${cy} L ${cx} ${cy - length} L ${cx + width / 2} ${cy} Z`;

  const id = (name: string) => `${uid}-${name}`;

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Face gradient – dark glass */}
          <radialGradient id={id('fg')} cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="100%" stopColor="rgba(15,20,40,0.75)" />
          </radialGradient>

          {/* Outer bezel gradient */}
          <linearGradient id={id('bz')} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.45)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.15)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.35)" />
          </linearGradient>

          {/* Hour-hand gradient */}
          <linearGradient id={id('hh')} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.7)" />
            <stop offset="50%" stopColor="rgba(255,255,255,1)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.7)" />
          </linearGradient>

          {/* Minute-hand gradient */}
          <linearGradient id={id('mh')} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(220,235,255,0.7)" />
            <stop offset="50%" stopColor="rgba(220,235,255,1)" />
            <stop offset="100%" stopColor="rgba(220,235,255,0.7)" />
          </linearGradient>

          {/* Glow filter for second hand */}
          <filter id={id('sg')} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Drop shadow for hands */}
          <filter id={id('hs')} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="1" floodColor="rgba(0,0,0,0.5)" />
          </filter>

          {/* Glow for bezel */}
          <filter id={id('bg')} x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur stdDeviation="0.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── Outer bezel ring ── */}
        <circle
          cx={cx} cy={cy} r={r + 1.5}
          fill="none"
          stroke={`url(#${id('bz')})`}
          strokeWidth="1.5"
          filter={`url(#${id('bg')})`}
        />

        {/* ── Clock face ── */}
        <circle cx={cx} cy={cy} r={r} fill={`url(#${id('fg')})`} />

        {/* Subtle inner shine arc at top */}
        <path
          d={`M ${cx - r * 0.55} ${cy - r * 0.72} A ${r * 0.65} ${r * 0.5} 0 0 1 ${cx + r * 0.55} ${cy - r * 0.72}`}
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* ── Tick marks (60 minutes) ── */}
        {[...Array(60)].map((_, i) => {
          const isHour = i % 5 === 0;
          const isQuarter = i % 15 === 0;
          const outer = r - 0.5;
          const inner = isQuarter ? outer - 7 : isHour ? outer - 5 : outer - 2.5;
          const strokeW = isQuarter ? 1.8 : isHour ? 1.2 : 0.6;
          const opacity = isQuarter ? 0.95 : isHour ? 0.75 : 0.4;
          const p1 = polar(i * 6, outer);
          const p2 = polar(i * 6, inner);
          return (
            <line
              key={i}
              x1={p1.x} y1={p1.y}
              x2={p2.x} y2={p2.y}
              stroke="rgba(255,255,255,1)"
              strokeOpacity={opacity}
              strokeWidth={strokeW}
              strokeLinecap="round"
            />
          );
        })}

        {/* ── 12 o'clock dot accent ── */}
        <circle cx={cx} cy={cy - r + 10} r="1.8" fill="rgba(255,255,255,0.9)" />

        {/* ── Hour hand (rotates around centre) ── */}
        <path
          d={handPath(28, 3.2, 7)}
          fill={`url(#${id('hh')})`}
          filter={`url(#${id('hs')})`}
          transform={`rotate(${hourAngle}, ${cx}, ${cy})`}
          style={{ transition: 'transform 0.5s cubic-bezier(0.4,2.2,0.3,0.9)' }}
        />

        {/* ── Minute hand (rotates around centre) ── */}
        <path
          d={handPath(37, 2.2, 8)}
          fill={`url(#${id('mh')})`}
          filter={`url(#${id('hs')})`}
          transform={`rotate(${minuteAngle}, ${cx}, ${cy})`}
          style={{ transition: 'transform 0.5s cubic-bezier(0.4,2.2,0.3,0.9)' }}
        />

        {/* ── Second hand (rotates around centre via transform) ── */}
        <g
          filter={`url(#${id('sg')})`}
          transform={`rotate(${secondAngle}, ${cx}, ${cy})`}
          style={{ transition: 'transform 0.2s linear' }}
        >
          {/* counterweight tail */}
          <line
            x1={cx} y1={cy}
            x2={cx} y2={cy + 12}
            stroke="rgba(251,146,60,0.9)"
            strokeWidth="1"
            strokeLinecap="round"
          />
          {/* main shaft */}
          <line
            x1={cx} y1={cy}
            x2={cx} y2={cy - 40}
            stroke="rgba(251,146,60,0.95)"
            strokeWidth="0.8"
            strokeLinecap="round"
          />
        </g>

        {/* ── Centre cap layers ── */}
        <circle cx={cx} cy={cy} r="4.5" fill="rgba(0,0,0,0.4)" />
        <circle cx={cx} cy={cy} r="3.5" fill="rgba(255,255,255,0.95)" />
        <circle cx={cx} cy={cy} r="1.8" fill="rgba(251,146,60,0.85)" />
        <circle cx={cx - 0.8} cy={cy - 0.8} r="0.8" fill="rgba(255,255,255,0.9)" />
      </svg>
    </div>
  );
}
