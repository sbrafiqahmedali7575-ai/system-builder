import React from 'react';
import { motion } from 'framer-motion';

interface SystemBuilderLogoProps {
  className?: string;
  animated?: boolean;
}

export const SystemBuilderLogo: React.FC<SystemBuilderLogoProps> = ({
  className = 'size-10 rounded-xl text-sm',
  animated = false,
}) => (
  <motion.div
    className={`relative flex flex-none items-center justify-center overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 font-bold text-white shadow-lg shadow-indigo-200/60 dark:shadow-indigo-950/40 ring-1 ring-white/70 ${className}`}
    initial={animated ? {scale: 0.82, rotate: -7} : false}
    animate={animated ? {
      scale: [0.82, 1.06, 1],
      rotate: [-7, 2, 0],
      boxShadow: ['0 8px 18px rgba(79,70,229,0.12)', '0 8px 24px rgba(79,70,229,0.28)', '0 8px 18px rgba(79,70,229,0.16)']
    } : undefined}
    transition={animated ? {duration: 0.8, times: [0, 0.62, 1], ease: [0.16, 1, 0.3, 1]} : undefined}
    aria-hidden="true"
  >
    S
    {animated && (
      <motion.span
        className="absolute inset-y-0 -left-8 w-5 rotate-12 bg-white/35 blur-[1px]"
        animate={{x: [0, 70]}}
        transition={{delay: 0.45, duration: 0.55, ease: 'easeOut'}}
      />
    )}
  </motion.div>
);
