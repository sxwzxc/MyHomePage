'use client';

import { BackgroundConfig } from '@/lib/homepage-config';

const GRADIENT_PRESETS = {
  default: 'from-cyan-500/45 via-indigo-500/35 to-fuchsia-500/45',
  ocean: 'from-blue-500/45 via-cyan-400/35 to-teal-500/45',
  sunset: 'from-orange-500/45 via-pink-500/35 to-purple-600/45',
  forest: 'from-emerald-500/45 via-green-400/35 to-teal-600/45',
  aurora: 'from-indigo-500/45 via-violet-500/35 to-pink-500/45',
  fire: 'from-red-500/45 via-orange-500/35 to-amber-500/45',
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
        className={`fixed inset-0 -z-10 animate-gradient bg-gradient-to-r ${gradientClass}`}
        style={{
          backgroundSize: '240% 240%',
        }}
      />
      <div className="fixed inset-0 -z-10 bg-slate-950/25" />

      <div
        className="pointer-events-none fixed -left-36 top-[-5rem] -z-10 h-[26rem] w-[26rem] animate-blob rounded-full bg-cyan-500/35 blur-[120px]"
        style={{ animationDuration: '30s' }}
      />
      <div
        className="animation-delay-2000 pointer-events-none fixed right-[-7rem] top-[10%] -z-10 h-[22rem] w-[22rem] animate-blob rounded-full bg-indigo-500/30 blur-[120px]"
        style={{ animationDuration: '36s' }}
      />
      <div
        className="animation-delay-4000 pointer-events-none fixed left-[12%] bottom-[-8rem] -z-10 h-[25rem] w-[25rem] animate-blob rounded-full bg-fuchsia-500/30 blur-[120px]"
        style={{ animationDuration: '34s' }}
      />
      <div
        className="animation-delay-6000 pointer-events-none fixed bottom-[-10rem] right-[8%] -z-10 h-[24rem] w-[24rem] animate-blob rounded-full bg-teal-400/25 blur-[130px]"
        style={{ animationDuration: '40s' }}
      />
    </>
  );
}
