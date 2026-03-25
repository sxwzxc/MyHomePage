'use client';

import { CSSProperties } from 'react';

interface AnalogClockProps {
  time: Date;
  size?: number;
  className?: string;
}

export default function AnalogClock({ time, size = 40, className = '' }: AnalogClockProps) {
  const hours = time.getHours();
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();

  // Calculate rotation angles
  const secondAngle = (seconds / 60) * 360;
  const minuteAngle = (minutes / 60) * 360 + (seconds / 60) * 6;
  const hourAngle = ((hours % 12) / 12) * 360 + (minutes / 60) * 30;

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Clock face */}
      <div
        className="absolute rounded-full border-2 border-white/80 bg-white/5"
        style={{ width: size, height: size }}
      >
        {/* Hour markers */}
        {[...Array(12)].map((_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          const radius = size * 0.35;
          const x = size / 2 + radius * Math.sin(angle);
          const y = size / 2 - radius * Math.cos(angle);

          return (
            <div
              key={i}
              className="absolute bg-white/60"
              style={{
                width: i % 3 === 0 ? 2 : 1.5,
                height: i % 3 === 0 ? 6 : 4,
                left: x - (i % 3 === 0 ? 1 : 0.75),
                top: y - (i % 3 === 0 ? 3 : 2),
                transformOrigin: 'center',
                transform: `rotate(${i * 30}deg)`,
              }}
            />
          );
        })}
      </div>

      {/* Center dot */}
      <div
        className="absolute rounded-full bg-white/90"
        style={{
          width: size * 0.1,
          height: size * 0.1,
          left: size / 2 - (size * 0.1) / 2,
          top: size / 2 - (size * 0.1) / 2,
          zIndex: 10,
        }}
      />

      {/* Hour hand */}
      <div
        className="absolute origin-bottom rounded-full bg-white/90 transition-transform duration-500"
        style={{
          width: size * 0.05,
          height: size * 0.25,
          left: size / 2 - (size * 0.05) / 2,
          top: size / 2 - size * 0.25,
          transform: `rotate(${hourAngle}deg)`,
        } as CSSProperties}
      />

      {/* Minute hand */}
      <div
        className="absolute origin-bottom rounded-full bg-white/85 transition-transform duration-500"
        style={{
          width: size * 0.04,
          height: size * 0.35,
          left: size / 2 - (size * 0.04) / 2,
          top: size / 2 - size * 0.35,
          transform: `rotate(${minuteAngle}deg)`,
        } as CSSProperties}
      />

      {/* Second hand */}
      <div
        className="absolute origin-bottom rounded-full bg-red-400/80 transition-transform duration-200"
        style={{
          width: size * 0.02,
          height: size * 0.38,
          left: size / 2 - (size * 0.02) / 2,
          top: size / 2 - size * 0.38,
          transform: `rotate(${secondAngle}deg)`,
        } as CSSProperties}
      />
    </div>
  );
}
