import React, {useEffect, useState} from 'react';
import {motion, AnimatePresence} from 'framer-motion';
import { SystemBuilderLogo } from './SystemBuilderLogo';

const CONTROL_LINES = [
  'Focus on what you can control.',
  'Choose your perception.',
  'Direct your effort.',
  'Own your response.',
  'Take the next useful action.',
] as const;

export const AppLaunchSplash: React.FC = () => {
  const [visible, setVisible] = useState(true);
  

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 6600);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_18%_18%,rgba(219,234,254,0.9),transparent_34%),radial-gradient(circle_at_82%_76%,rgba(237,233,254,0.85),transparent_38%),linear-gradient(145deg,#f8fbff_0%,#ffffff_48%,#faf7ff_100%)] text-slate-900`}
          initial={{opacity: 1}}
          exit={{opacity: 0, scale: 1.025}}
          transition={{duration: 0.42, ease: [0.16, 1, 0.3, 1]}}
          aria-label="System Builder launch screen"
        >
          <motion.div
            className="flex w-full max-w-xs md:max-w-sm flex-col items-center px-6 md:px-8 text-center"
            initial={{opacity: 0, y: 14, scale: 0.97}}
            animate={{opacity: 1, y: 0, scale: 1}}
            transition={{duration: 0.5, ease: [0.16, 1, 0.3, 1]}}
          >
            <SystemBuilderLogo className="mb-4 size-14 md:size-16 rounded-2xl md:rounded-[18px] text-xl md:text-2xl" animated />
            <motion.h1 className="text-2xl md:text-[28px] font-semibold tracking-tight" initial={{opacity: 0}} animate={{opacity: 1}} transition={{delay: 0.15}}>
              System Builder
            </motion.h1>

            <motion.div
              className="mt-5 md:mt-6 w-full"
              initial={{opacity: 0, y: 8}}
              animate={{opacity: 1, y: 0}}
              transition={{delay: 0.45, duration: 0.4}}
              aria-label="Control-focused launch guidance inspired by The Obstacle Is the Way"
            >
              <motion.div
                className="mb-2.5 text-[9px] md:text-[10px] font-black uppercase tracking-[0.18em] text-indigo-500/90"
                initial={{opacity: 0, y: 4}}
                animate={{opacity: 1, y: 0}}
                transition={{delay: 0.5, duration: 0.3}}
              >
                Within your control
              </motion.div>

              <div className="relative h-[92px] md:h-[98px] overflow-hidden rounded-2xl border border-indigo-100/90 bg-white/82 px-4 shadow-[0_14px_34px_rgba(79,70,229,0.08)] backdrop-blur-sm">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-[radial-gradient(circle_at_50%_16%,rgba(99,102,241,0.12),transparent_58%)]"
                />

                {CONTROL_LINES.map((line, index) => {
                  const delay = 0.72 + index * 0.5;
                  return (
                    <motion.div
                      key={line}
                      className="absolute inset-0 flex items-center justify-center px-5"
                      initial={{opacity: 0, y: 16, scale: 0.97, filter: 'blur(3px)'}}
                      animate={{
                        opacity: [0, 1, 1, 0],
                        y: [16, 0, 0, -12],
                        scale: [0.97, 1.015, 1, 0.99],
                        filter: ['blur(3px)', 'blur(0px)', 'blur(0px)', 'blur(2px)'],
                      }}
                      transition={{
                        delay,
                        duration: 0.86,
                        times: [0, 0.22, 0.72, 1],
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >
                      <div className="text-center">
                        <motion.div
                          aria-hidden="true"
                          className="mx-auto mb-2 h-px w-10 bg-gradient-to-r from-transparent via-indigo-400 to-transparent"
                          initial={{scaleX: 0}}
                          animate={{scaleX: 1}}
                          transition={{delay: delay + 0.06, duration: 0.28}}
                        />
                        <p className="text-[15px] md:text-[17px] font-extrabold leading-snug tracking-[-0.015em] text-slate-900">
                          {line}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}

                <motion.div
                  aria-hidden="true"
                  className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500"
                  initial={{width: '0%'}}
                  animate={{width: '100%'}}
                  transition={{delay: 0.68, duration: 2.62, ease: 'linear'}}
                />
              </div>

              <motion.p
                className="mt-2.5 text-[9px] md:text-[10px] font-semibold tracking-[0.025em] text-slate-400"
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                transition={{delay: 0.6, duration: 0.35}}
              >
                Inspired by The Obstacle Is the Way
              </motion.p>
            </motion.div>

            <motion.div className="mt-4 h-1 w-12 rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-amber-400" initial={{scaleX: 0}} animate={{scaleX: 1}} transition={{delay: 3.3, duration: 0.25}} />
            <motion.div
              className="relative mt-3 flex flex-col items-center justify-center text-center"
              initial={{opacity: 0, y: 10, scale: 0.975, filter: 'blur(2px)'}}
              animate={{opacity: [0, 1, 1], y: [10, 0, 0], scale: [0.975, 1, 1], filter: ['blur(2px)', 'blur(0px)', 'blur(0px)']}}
              transition={{delay: 3.48, duration: 0.75, times: [0, 0.72, 1], ease: [0.16, 1, 0.3, 1]}}
              aria-label="Developed by Rafiq Ahmed"
            >
              <motion.span
                className="text-[8px] md:text-[9px] font-semibold leading-none tracking-[0.22em] text-slate-400"
                initial={{opacity: 0, y: 2}}
                animate={{opacity: 1, y: 0}}
                transition={{delay: 3.6, duration: 0.42, ease: 'easeOut'}}
              >
                DEVELOPED BY
              </motion.span>
              <motion.span
                className="relative mt-0.5 bg-gradient-to-r from-blue-600 via-violet-600 to-indigo-600 bg-[length:190%_100%] bg-clip-text text-[13px] md:text-sm font-bold leading-none text-transparent"
                initial={{opacity: 0, y: 4, scale: 0.96, letterSpacing: '0.12em', backgroundPosition: '0% 50%', filter: 'drop-shadow(0 0 0 rgba(99,102,241,0))'}}
                animate={{
                  opacity: [0, 1, 1, 1],
                  y: [4, 0, 0, 0],
                  scale: [0.96, 1.045, 1, 1],
                  letterSpacing: ['0.12em', '0.19em', '0.16em', '0.16em'],
                  backgroundPosition: ['0% 50%', '0% 50%', '100% 50%', '100% 50%'],
                  filter: ['drop-shadow(0 0 0 rgba(99,102,241,0))', 'drop-shadow(0 3px 10px rgba(99,102,241,0.28))', 'drop-shadow(0 2px 6px rgba(99,102,241,0.14))', 'drop-shadow(0 0 0 rgba(99,102,241,0))']
                }}
                transition={{delay: 3.75, duration: 2.45, times: [0, 0.28, 0.66, 1], ease: [0.16, 1, 0.3, 1]}}
              >
                RAFIQ AHMED
              </motion.span>
              <motion.span
                className="pointer-events-none absolute -bottom-2 h-px w-16 bg-gradient-to-r from-transparent via-indigo-400/70 to-transparent"
                initial={{opacity: 0, scaleX: 0.35}}
                animate={{opacity: [0, 0.7, 0], scaleX: [0.35, 1, 1.12]}}
                transition={{delay: 5.35, duration: 1.05, ease: 'easeInOut'}}
                aria-hidden="true"
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
