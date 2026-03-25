'use client';

import { BackgroundConfig } from '@/lib/homepage-config';

const GRADIENT_PRESETS = {
  default: 'from-cyan-400/68 via-indigo-400/56 to-fuchsia-400/68',
  ocean: 'from-blue-400/68 via-cyan-300/56 to-teal-400/68',
  sunset: 'from-orange-400/68 via-pink-400/56 to-purple-500/68',
  forest: 'from-emerald-400/68 via-green-300/56 to-teal-500/68',
  aurora: 'from-indigo-400/68 via-violet-400/56 to-pink-400/68',
  fire: 'from-red-400/68 via-orange-400/56 to-amber-400/68',
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
      <div className="fixed inset-0 -z-10 bg-slate-950/15" />

      <div
        className="pointer-events-none fixed -left-36 top-[-5rem] -z-10 h-[26rem] w-[26rem] animate-blob rounded-full bg-cyan-400/52 blur-[115px]"
        style={{ animationDuration: '30s' }}
      />
      <div
        className="animation-delay-2000 pointer-events-none fixed right-[-7rem] top-[10%] -z-10 h-[22rem] w-[22rem] animate-blob rounded-full bg-indigo-400/48 blur-[115px]"
        style={{ animationDuration: '36s' }}
      />
      <div
        className="animation-delay-4000 pointer-events-none fixed left-[12%] bottom-[-8rem] -z-10 h-[25rem] w-[25rem] animate-blob rounded-full bg-fuchsia-400/48 blur-[115px]"
        style={{ animationDuration: '34s' }}
      />
      <div
        className="animation-delay-6000 pointer-events-none fixed bottom-[-10rem] right-[8%] -z-10 h-[24rem] w-[24rem] animate-blob rounded-full bg-teal-300/44 blur-[120px]"
        style={{ animationDuration: '40s' }}
      />
    </>
  );
}
