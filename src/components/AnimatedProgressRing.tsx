import React from 'react';
import { motion } from 'framer-motion';

interface AnimatedProgressRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  trackClassName?: string;
  progressClassName?: string;
  label?: string;
  sublabel?: string;
  className?: string;
  delay?: number;
}

export const AnimatedProgressRing: React.FC<AnimatedProgressRingProps> = ({
  value,
  size = 64,
  strokeWidth = 6,
  trackClassName = 'text-slate-200 dark:text-slate-800',
  progressClassName = 'text-blue-500',
  label,
  sublabel,
  className = '',
  delay = 0,
}) => {
  const safeValue = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - safeValue / 100);

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${sublabel ? `${sublabel}: ` : ''}${Math.round(safeValue)}%`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className={trackClassName}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
          className={progressClassName}
        />
      </svg>
      {(label || sublabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none pointer-events-none">
          {label && <span className="text-[11px] font-black text-slate-800 dark:text-slate-100">{label}</span>}
          {sublabel && <span className="mt-0.5 text-[7px] uppercase tracking-[0.08em] font-extrabold text-slate-400">{sublabel}</span>}
        </div>
      )}
    </div>
  );
};
