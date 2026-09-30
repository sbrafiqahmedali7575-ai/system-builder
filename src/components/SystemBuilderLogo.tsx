import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface SystemBuilderLogoProps {
  className?: string;
  animated?: boolean;
}

export const SystemBuilderLogo: React.FC<SystemBuilderLogoProps> = ({
  className = 'size-10',
  animated = true,
}) => {
  const reduceMotion = useReducedMotion();
  const shouldAnimate = animated && !reduceMotion;

  return (
    <motion.div
      whileHover={shouldAnimate ? {scale:1.08, rotateX:-7, rotateY:9, y:-2} : undefined}
      whileTap={shouldAnimate ? {scale:.94, rotateX:2, rotateY:-2} : undefined}
      style={{transformPerspective: 700}}
      className={`relative flex flex-none items-center justify-center overflow-hidden rounded-[28%] ring-1 ring-white/75 shadow-[0_10px_26px_rgba(79,70,229,0.18)] dark:ring-white/15 dark:shadow-[0_10px_26px_rgba(49,46,129,0.34)] ${className}`}
      initial={shouldAnimate ? {scale: 0.78, rotate: -8, rotateX: 10, rotateY: -12} : false}
      animate={
        shouldAnimate
          ? {
              scale: [0.82, 1.06, 1],
              rotate: [-8, 2, 0],
              rotateX: [10, -4, 0],
              rotateY: [-12, 5, 0],
              boxShadow: [
                '0 10px 26px rgba(79,70,229,0.16)',
                '0 14px 32px rgba(79,70,229,0.30)',
                '0 10px 26px rgba(79,70,229,0.18)',
              ],
            }
          : undefined
      }
      transition={
        shouldAnimate
          ? {duration: 0.8, times: [0, 0.62, 1], ease: [0.16, 1, 0.3, 1]}
          : undefined
      }
      aria-hidden="true"
    >
      <img
        src="/system-builder-logo.svg"
        alt=""
        draggable={false}
        className="absolute inset-0 size-full select-none object-cover"
      />
      {shouldAnimate && (
        <motion.span
          className="absolute inset-y-0 -left-8 w-5 rotate-12 bg-white/25 blur-[1px]"
          animate={{x: [0, 70]}}
          transition={{delay: 0.45, duration: 0.55, ease: 'easeOut'}}
        />
      )}
    </motion.div>
  );
};
