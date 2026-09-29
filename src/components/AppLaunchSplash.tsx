import React, {useEffect, useState} from 'react';
import {Check, motion, AnimatePresence} from 'framer-motion';

const launchTasks = ['Plan the day', 'Focus on priorities', 'Build consistency'];

export const AppLaunchSplash: React.FC = () => {
  const [visible, setVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 767px)').matches;
    setIsMobile(mobile);
    const timer = window.setTimeout(() => setVisible(false), mobile ? 3000 : 1500);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950 text-white"
          initial={{opacity: 1}}
          exit={{opacity: 0, scale: 1.025}}
          transition={{duration: 0.42, ease: [0.16, 1, 0.3, 1]}}
          aria-label="System Builder launch screen"
        >
          <motion.div
            className="flex w-full max-w-xs flex-col items-center px-6 text-center"
            initial={{opacity: 0, y: 14, scale: 0.97}}
            animate={{opacity: 1, y: 0, scale: 1}}
            transition={{duration: 0.5, ease: [0.16, 1, 0.3, 1]}}
          >
            <motion.div
              className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-xl font-bold shadow-2xl shadow-blue-500/25"
              initial={{rotate: -8, scale: 0.8}}
              animate={{rotate: 0, scale: 1}}
              transition={{type: 'spring', stiffness: 220, damping: 16}}
            >
              S
            </motion.div>
            <motion.h1 className="text-2xl font-semibold tracking-tight" initial={{opacity: 0}} animate={{opacity: 1}} transition={{delay: 0.15}}>
              System Builder
            </motion.h1>

            {isMobile && (
              <motion.div
                className="mt-5 w-full space-y-2"
                initial={{opacity: 0, y: 8}}
                animate={{opacity: 1, y: 0}}
                transition={{delay: 0.35, duration: 0.35}}
                aria-label="Completing launch tasks"
              >
                {launchTasks.map((task, index) => {
                  const delay = 0.65 + index * 0.48;
                  return (
                    <motion.div
                      key={task}
                      className="flex h-10 items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/80 px-3 text-left"
                      initial={{opacity: 0, x: -10}}
                      animate={{opacity: 1, x: 0}}
                      transition={{delay: 0.25 + index * 0.12, duration: 0.3}}
                    >
                      <motion.span
                        className="relative block size-5 flex-none rounded-[5px] border border-slate-600"
                        animate={{backgroundColor: ['#0f172a', '#2563eb'], borderColor: ['#475569', '#2563eb']}}
                        transition={{delay, duration: 0.22}}
                      >
                        <motion.span
                          className="absolute inset-0 flex items-center justify-center"
                          initial={{scale: 0, opacity: 0}}
                          animate={{scale: 1, opacity: 1}}
                          transition={{delay: delay + 0.1, type: 'spring', stiffness: 420, damping: 20}}
                        >
                          <Check className="size-3.5 stroke-[3] text-white" />
                        </motion.span>
                      </motion.span>
                      <motion.span
                        className="min-w-0 truncate text-sm text-slate-300"
                        animate={{color: ['#cbd5e1', '#94a3b8']}}
                        transition={{delay, duration: 0.22}}
                      >
                        {task}
                      </motion.span>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            <motion.div className={isMobile ? 'mt-4 h-px w-10 bg-blue-500' : 'mt-3 h-px w-10 bg-blue-500'} initial={{scaleX: 0}} animate={{scaleX: 1}} transition={{delay: isMobile ? 1.95 : 0.35, duration: 0.35}} />
            <motion.p className="mt-3 text-xs font-medium tracking-[0.18em] text-slate-400" initial={{opacity: 0, y: 6}} animate={{opacity: 1, y: 0}} transition={{delay: isMobile ? 2.08 : 0.45}}>
              DEVELOPED BY RAFIQ AHMED
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
