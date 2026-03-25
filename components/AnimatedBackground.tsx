'use client';

import { BackgroundConfig } from '@/lib/homepage-config';

const GRADIENT_PRESETS = {
  default: 'from-cyan-500/30 via-purple-500/30 to-fuchsia-500/30',
  ocean: 'from-blue-500/30 via-cyan-400/30 to-teal-500/30',
  sunset: 'from-orange-500/30 via-pink-500/30 to-purple-600/30',
  forest: 'from-green-500/30 via-emerald-400/30 to-teal-600/30',
  aurora: 'from-indigo-500/30 via-purple-500/30 to-pink-500/30',
  fire: 'from-red-500/30 via-orange-500/30 to-yellow-500/30',
};

interface AnimatedBackgroundProps {
  config: BackgroundConfig;
}

export default function AnimatedBackground({ config }: AnimatedBackgroundProps) {
  if (config.type === 'image' && config.imageUrl) {
    return (
      <>
        <div
          className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat transition-opacity duration-500"
          style={{
            backgroundImage: `url(${config.imageUrl})`,
            filter: `blur(${config.imageBlur || 0}px)`,
            opacity: (config.imageOpacity || 100) / 100,
          }}
        />
        <div className="fixed inset-0 -z-10 bg-slate-950/50" />
      </>
    );
  }

  if (config.type === 'solid') {
    return (
      <div
        className="fixed inset-0 -z-10"
        style={{ backgroundColor: config.solidColor || '#0f172a' }}
      />
    );
  }

  // Animated gradient (default)
  const preset = config.gradientPreset || 'default';
  const gradientClass =
    GRADIENT_PRESETS[preset as keyof typeof GRADIENT_PRESETS] ||
    GRADIENT_PRESETS.default;

  return (
    <>
      <div className="fixed inset-0 -z-10 bg-slate-950" />
      <div
        className={`fixed inset-0 -z-10 animate-gradient bg-gradient-to-br ${gradientClass}`}
      />
      <div className="pointer-events-none fixed -left-32 top-0 -z-10 h-80 w-80 animate-blob rounded-full bg-cyan-500/30 blur-3xl" />
      <div className="animation-delay-2000 pointer-events-none fixed -right-32 bottom-0 -z-10 h-80 w-80 animate-blob rounded-full bg-fuchsia-500/30 blur-3xl" />
    </>
  );
}
