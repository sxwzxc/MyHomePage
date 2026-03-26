'use client';

import { useEffect, useRef } from 'react';

interface AnalogClockProps {
  time: Date;
  size?: number;
  className?: string;
}

function toAngle(ratio: number): number {
  return ratio * Math.PI * 2;
}

function drawClock(ctx: CanvasRenderingContext2D, size: number, time: Date) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.47;

  const hour = time.getHours();
  const minute = time.getMinutes();
  const second = time.getSeconds();
  const ms = time.getMilliseconds();

  // background
  ctx.clearRect(0, 0, size, size);
  const bgGradient = ctx.createRadialGradient(cx - radius * 0.2, cy - radius * 0.3, 0, cx, cy, radius * 1.2);
  bgGradient.addColorStop(0, '#1e293b');
  bgGradient.addColorStop(0.6, '#0f172a');
  bgGradient.addColorStop(1, '#020617');
  ctx.fillStyle = bgGradient;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // bezel
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.75)';
  ctx.lineWidth = Math.max(1.2, size * 0.01);
  ctx.beginPath();
  ctx.arc(cx, cy, radius + size * 0.01, 0, Math.PI * 2);
  ctx.stroke();

  // second sub-ticks: 300
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
  ctx.lineWidth = Math.max(0.5, size * 0.0022);
  for (let i = 0; i < 300; i += 1) {
    ctx.rotate((Math.PI * 2) / 300);
    ctx.beginPath();
    ctx.moveTo(0, -radius + size * 0.02);
    ctx.lineTo(0, -radius + size * 0.06);
    ctx.stroke();
  }
  ctx.restore();

  // minute ticks: 60
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
  ctx.lineWidth = Math.max(0.8, size * 0.0045);
  for (let i = 0; i < 60; i += 1) {
    ctx.rotate((Math.PI * 2) / 60);
    ctx.beginPath();
    ctx.moveTo(0, -radius + size * 0.02);
    ctx.lineTo(0, -radius + size * 0.09);
    ctx.stroke();
  }
  ctx.restore();

  // hour ticks + numbers
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.95)';
  ctx.fillStyle = 'rgba(226, 232, 240, 0.95)';
  ctx.lineWidth = Math.max(1.2, size * 0.012);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.max(10, Math.round(size * 0.085))}px ui-sans-serif, system-ui`;
  for (let i = 1; i <= 12; i += 1) {
    ctx.rotate((Math.PI * 2) / 12);
    ctx.beginPath();
    ctx.moveTo(0, -radius + size * 0.02);
    ctx.lineTo(0, -radius + size * 0.13);
    ctx.stroke();

    ctx.save();
    ctx.translate(0, -radius + size * 0.22);
    ctx.rotate(-((Math.PI * 2) / 12) * i);
    ctx.fillText(String(i), 0, 0);
    ctx.restore();
  }
  ctx.restore();

  // 12 o'clock accent
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.arc(cx, cy - radius + size * 0.16, Math.max(1.8, size * 0.012), 0, Math.PI * 2);
  ctx.fill();

  const hourAngle = toAngle(((hour % 12) + minute / 60 + second / 3600) / 12);
  const minuteAngle = toAngle((minute + second / 60 + ms / 60000) / 60);
  const secondAngle = toAngle((second + ms / 1000) / 60);

  const drawHand = ({
    angle,
    length,
    tail,
    width,
    color,
    shadowBlur,
    shadowColor,
  }: {
    angle: number;
    length: number;
    tail: number;
    width: number;
    color: string;
    shadowBlur: number;
    shadowColor: string;
  }) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.shadowBlur = shadowBlur;
    ctx.shadowColor = shadowColor;
    ctx.moveTo(0, tail);
    ctx.lineTo(0, -length);
    ctx.stroke();
    ctx.restore();
  };

  drawHand({
    angle: hourAngle,
    length: size * 0.24,
    tail: size * 0.07,
    width: Math.max(4, size * 0.05),
    color: '#e2e8f0',
    shadowBlur: Math.max(2, size * 0.02),
    shadowColor: 'rgba(15, 23, 42, 0.8)',
  });

  drawHand({
    angle: minuteAngle,
    length: size * 0.34,
    tail: size * 0.08,
    width: Math.max(3, size * 0.036),
    color: '#cbd5e1',
    shadowBlur: Math.max(2, size * 0.02),
    shadowColor: 'rgba(15, 23, 42, 0.8)',
  });

  drawHand({
    angle: secondAngle,
    length: size * 0.39,
    tail: size * 0.12,
    width: Math.max(1.4, size * 0.012),
    color: '#ef4444',
    shadowBlur: Math.max(3, size * 0.03),
    shadowColor: 'rgba(239, 68, 68, 0.5)',
  });

  // center connector
  ctx.fillStyle = '#94a3b8';
  ctx.beginPath();
  ctx.roundRect(
    cx - size * 0.025,
    cy - size * 0.014,
    size * 0.05,
    size * 0.028,
    size * 0.008
  );
  ctx.fill();

  // center cap
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(4, size * 0.038), 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(2.5, size * 0.022), 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(1.6, size * 0.014), 0, Math.PI * 2);
  ctx.fill();
}

export default function AnalogClock({ time, size = 40, className = '' }: AnalogClockProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ratio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.round(size * ratio);
    canvas.height = Math.round(size * ratio);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawClock(ctx, size, time);
  }, [size, time]);

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <canvas ref={canvasRef} width={size} height={size} aria-label="Analog clock" />
    </div>
  );
}
