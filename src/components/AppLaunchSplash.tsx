import React, {useEffect, useState} from 'react';
import {motion, AnimatePresence} from 'framer-motion';
import { SystemBuilderLogo } from './SystemBuilderLogo';

const BOOK_SUMMARY =
  'See clearly, act on what you control, endure what you cannot change, and turn every obstacle into a way forward.';

export const AppLaunchSplash: React.FC = () => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 10000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_18%_18%,rgba(219,234,254,0.9),transparent_34%),radial-gradient(circle_at_82%_76%,rgba(237,233,254,0.85),transparent_38%),linear-gradient(145deg,#f8fbff_0%,#ffffff_48%,#faf7ff_100%)] text-slate-900"
          initial={{opacity: 1}}
          exit={{opacity: 0, scale: 1.02}}
          transition={{duration: 0.42, ease: [0.16, 1, 0.3, 1]}}
          aria-label="System Builder launch screen"
        >
          <motion.div
            className="flex w-full max-w-xs flex-col items-center px-6 text-center md:max-w-sm md:px-8"
            initial={{opacity: 0, y: 12, scale: 0.98}}
            animate={{opacity: 1, y: 0, scale: 1}}
            transition={{duration: 0.45, ease: [0.16, 1, 0.3, 1]}}
          >
            <SystemBuilderLogo className="size-14 rounded-2xl text-xl md:size-16 md:text-2xl" animated />

            <motion.h1
              className="mt-3 text-2xl font-semibold tracking-tight md:text-[28px]"
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              transition={{delay: 0.12, duration: 0.3}}
            >
              System Builder
            </motion.h1>

            <motion.div
              className="mt-2 flex flex-col items-center"
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              transition={{duration: 0.3}}
              aria-label="Developed by Rafiq Ahmed"
            >
              <span className="text-[8px] font-bold uppercase leading-none tracking-[0.22em] text-slate-400 md:text-[9px]">
                DEVELOPED BY
              </span>
              <span className="mt-1 bg-gradient-to-r from-blue-600 via-violet-600 to-indigo-600 bg-clip-text text-[12px] font-extrabold leading-none tracking-[0.09em] text-transparent md:text-[13px]">
                RAFIQ AHMED
              </span>
            </motion.div>

            <motion.div
              className="mt-6 w-full"
              initial={{opacity: 0, y: 8}}
              animate={{opacity: 1, y: 0}}
              transition={{delay: 0.38, duration: 0.4}}
              aria-label="The Obstacle Is the Way one-line summary"
            >
              <div className="mb-2.5 text-[9px] font-black uppercase tracking-[0.18em] text-indigo-500/90 md:text-[10px]">
                The Obstacle Is the Way — in one line
              </div>

              <motion.div
                className="relative overflow-hidden rounded-2xl border border-indigo-100/90 bg-white/84 px-5 py-6 shadow-[0_16px_38px_rgba(79,70,229,0.10)] backdrop-blur-sm md:px-6 md:py-7"
                initial={{opacity: 0, y: 14, scale: 0.97, filter: 'blur(3px)'}}
                animate={{opacity: 1, y: 0, scale: [0.97, 1.015, 1], filter: 'blur(0px)'}}
                transition={{delay: 0.72, duration: 0.85, ease: [0.16, 1, 0.3, 1]}}
              >
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(99,102,241,0.14),transparent_60%)]"
                />

                <motion.div
                  aria-hidden="true"
                  className="relative mx-auto mb-3 h-px w-12 bg-gradient-to-r from-transparent via-indigo-400 to-transparent"
                  initial={{scaleX: 0, opacity: 0}}
                  animate={{scaleX: 1, opacity: 1}}
                  transition={{delay: 0.92, duration: 0.42}}
                />

                <motion.p
                  className="relative text-[17px] font-extrabold leading-relaxed tracking-[-0.018em] text-slate-900 md:text-[19px]"
                  initial={{opacity: 0, y: 8}}
                  animate={{opacity: 1, y: 0}}
                  transition={{delay: 1.0, duration: 0.5, ease: [0.16, 1, 0.3, 1]}}
                >
                  {BOOK_SUMMARY}
                </motion.p>

                <motion.div
                  aria-hidden="true"
                  className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500"
                  initial={{width: '0%'}}
                  animate={{width: '100%'}}
                  transition={{delay: 0.7, duration: 8.4, ease: 'linear'}}
                />
              </motion.div>

              <motion.p
                className="mt-2.5 text-[9px] font-semibold tracking-[0.025em] text-slate-400 md:text-[10px]"
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                transition={{delay: 0.5, duration: 0.3}}
              >
                Inspired by The Obstacle Is the Way
              </motion.p>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
