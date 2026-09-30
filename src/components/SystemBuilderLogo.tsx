import React from 'react';
import { motion } from 'framer-motion';

interface SystemBuilderLogoProps {
  className?: string;
  animated?: boolean;
}

export const SystemBuilderLogo: React.FC<SystemBuilderLogoProps> = ({
  className = 'size-10 text-sm',
  animated = false,
}) => (
  <motion.div
    className={`relative flex flex-none items-center justify-center overflow-hidden rounded-[28%] bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 font-bold text-white ring-1 ring-white/75 shadow-[0_10px_26px_rgba(79,70,229,0.18)] dark:ring-white/15 dark:shadow-[0_10px_26px_rgba(49,46,129,0.34)] ${className}`}
    initial={animated ? {scale: 0.82, rotate: -7} : false}
    animate={animated ? {
      scale: [0.82, 1.06, 1],
      rotate: [-7, 2, 0],
      boxShadow: ['0 10px 26px rgba(79,70,229,0.16)', '0 14px 32px rgba(79,70,229,0.30)', '0 10px 26px rgba(79,70,229,0.18)']
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
