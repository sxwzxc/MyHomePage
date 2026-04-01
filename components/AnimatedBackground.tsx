'use client';

import { BackgroundConfig } from '@/lib/homepage-config';

const ORB_LAYOUTS = [
  { size: 'min(26rem, 40vw)', x: '-8%', y: '-10%', blur: 80, opacity: 0.55, duration: 32, delay: 0, anim: 1 },
  { size: 'min(22rem, 35vw)', x: '70%', y: '5%', blur: 70, opacity: 0.45, duration: 38, delay: -4, anim: 2 },
  { size: 'min(25rem, 38vw)', x: '5%', y: '60%', blur: 75, opacity: 0.5, duration: 35, delay: -8, anim: 3 },
  { size: 'min(20rem, 32vw)', x: '65%', y: '70%', blur: 65, opacity: 0.4, duration: 42, delay: -12, anim: 4 },
  { size: 'min(18rem, 28vw)', x: '40%', y: '30%', blur: 60, opacity: 0.35, duration: 28, delay: -6, anim: 1 },
  { size: 'min(16rem, 25vw)', x: '20%', y: '80%', blur: 55, opacity: 0.3, duration: 36, delay: -15, anim: 2 },
] as const;

const THEMES: Record<
  string,
  { bg: string; mesh: [string, string, string, string]; colors: [string, string, string, string, string, string] }
> = {
  default: {
    bg: '#070b14',
    mesh: [
      'rgba(34,211,238,0.18)',
      'rgba(129,140,248,0.14)',
      'rgba(232,121,249,0.18)',
      'rgba(94,234,212,0.12)',
    ],
    colors: [
      'rgba(34,211,238,0.5)',
      'rgba(129,140,248,0.45)',
      'rgba(232,121,249,0.4)',
      'rgba(94,234,212,0.35)',
      'rgba(167,139,250,0.3)',
      'rgba(244,114,182,0.25)',
    ],
  },
  ocean: {
    bg: '#060d1a',
    mesh: [
      'rgba(56,189,248,0.18)',
      'rgba(103,232,249,0.14)',
      'rgba(45,212,191,0.18)',
      'rgba(34,211,238,0.12)',
    ],
    colors: [
      'rgba(56,189,248,0.5)',
      'rgba(103,232,249,0.45)',
      'rgba(45,212,191,0.4)',
      'rgba(34,211,238,0.35)',
      'rgba(96,165,250,0.3)',
      'rgba(125,211,252,0.25)',
    ],
  },
  sunset: {
    bg: '#140a07',
    mesh: [
      'rgba(251,146,60,0.18)',
      'rgba(244,114,182,0.14)',
      'rgba(168,85,247,0.18)',
      'rgba(251,191,36,0.12)',
    ],
    colors: [
      'rgba(251,146,60,0.5)',
      'rgba(244,114,182,0.45)',
      'rgba(168,85,247,0.4)',
      'rgba(251,191,36,0.35)',
      'rgba(248,113,113,0.3)',
      'rgba(217,70,239,0.25)',
    ],
  },
  forest: {
    bg: '#071410',
    mesh: [
      'rgba(52,211,153,0.18)',
      'rgba(134,239,172,0.14)',
      'rgba(45,212,191,0.18)',
      'rgba(74,222,128,0.12)',
    ],
    colors: [
      'rgba(52,211,153,0.5)',
      'rgba(134,239,172,0.45)',
      'rgba(45,212,191,0.4)',
      'rgba(74,222,128,0.35)',
      'rgba(110,231,183,0.3)',
      'rgba(94,234,212,0.25)',
    ],
  },
  aurora: {
    bg: '#0a0714',
    mesh: [
      'rgba(129,140,248,0.18)',
      'rgba(167,139,250,0.14)',
      'rgba(236,72,153,0.18)',
      'rgba(192,132,252,0.12)',
    ],
    colors: [
      'rgba(129,140,248,0.5)',
      'rgba(167,139,250,0.45)',
      'rgba(236,72,153,0.4)',
      'rgba(192,132,252,0.35)',
      'rgba(99,102,241,0.3)',
      'rgba(244,114,182,0.25)',
    ],
  },
  fire: {
    bg: '#140a07',
    mesh: [
      'rgba(248,113,113,0.18)',
      'rgba(251,146,60,0.14)',
      'rgba(250,204,21,0.18)',
      'rgba(253,186,116,0.12)',
    ],
    colors: [
      'rgba(248,113,113,0.5)',
      'rgba(251,146,60,0.45)',
      'rgba(250,204,21,0.4)',
      'rgba(253,186,116,0.35)',
      'rgba(252,165,165,0.3)',
      'rgba(253,224,71,0.25)',
    ],
  },
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
          }}
        />
        <div
          className="fixed inset-0 -z-10 bg-slate-950 transition-opacity duration-500"
          style={{ opacity: (config.imageOverlay ?? 50) / 100 }}
        />
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

  const preset = config.gradientPreset || 'default';
  const theme = THEMES[preset] || THEMES.default;

  return (
    <div
      className="fixed inset-0 -z-10 overflow-hidden"
      style={{ backgroundColor: theme.bg }}
    >
      {/* Rotating mesh gradient base */}
      <div
        className="aurora-mesh"
        style={{
          background: [
            `radial-gradient(ellipse 80% 60% at 20% 40%, ${theme.mesh[0]}, transparent)`,
            `radial-gradient(ellipse 60% 80% at 75% 20%, ${theme.mesh[1]}, transparent)`,
            `radial-gradient(ellipse 70% 50% at 50% 80%, ${theme.mesh[2]}, transparent)`,
            `radial-gradient(ellipse 50% 40% at 90% 90%, ${theme.mesh[3]}, transparent)`,
          ].join(','),
        }}
      />

      {/* Subtle center shimmer pulse */}
      <div className="aurora-shimmer" />

      {/* Floating light orbs */}
      {ORB_LAYOUTS.map((layout, i) => (
        <div
          key={i}
          className="aurora-orb"
          style={{
            left: layout.x,
            top: layout.y,
            width: layout.size,
            height: layout.size,
            backgroundColor: theme.colors[i],
            filter: `blur(${layout.blur}px)`,
            opacity: layout.opacity,
            animationDuration: `${layout.duration}s`,
            animationDelay: `${layout.delay}s`,
            animationName: `aurora-float-${layout.anim}`,
          }}
        />
      ))}
    </div>
  );
}
