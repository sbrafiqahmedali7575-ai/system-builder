import React, {useEffect, useState} from 'react';
import {motion, AnimatePresence} from 'framer-motion';

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
                      className="relative flex h-10 items-center gap-3 rounded-xl border px-3 text-left"
                      initial={{opacity: 0, x: -10, backgroundColor: 'rgba(15,23,42,0.8)', borderColor: '#1e293b'}}
                      animate={{
                        opacity: [0, 1, 1, 0.72],
                        x: 0,
                        backgroundColor: ['rgba(15,23,42,0.8)', 'rgba(15,23,42,0.8)', 'rgba(37,99,235,0.16)', 'rgba(15,23,42,0.72)'],
                        borderColor: ['#1e293b', '#1e293b', '#2563eb', '#1e293b']
                      }}
                      transition={{
                        opacity: {times: [0, 0.18, 0.78, 1], delay: 0.25 + index * 0.12, duration: delay + 0.45 - (0.25 + index * 0.12)},
                        x: {delay: 0.25 + index * 0.12, duration: 0.28},
                        backgroundColor: {delay, duration: 0.4, times: [0, 0.15, 0.48, 1]},
                        borderColor: {delay, duration: 0.4, times: [0, 0.15, 0.48, 1]}
                      }}
                    >
                      <motion.span
                        className="relative block size-5 flex-none rounded-[5px] border"
                        initial={{backgroundColor: '#0f172a', borderColor: '#475569'}}
                        animate={{backgroundColor: '#2563eb', borderColor: '#2563eb'}}
                        transition={{delay, duration: 0.14}}
                      >
                        <svg viewBox="0 0 20 20" className="absolute inset-0 size-full p-[3px]" aria-hidden="true">
                          <motion.path
                            d="M4.5 10.2 8.2 14 15.7 6.4"
                            fill="none"
                            stroke="white"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            initial={{pathLength: 0, opacity: 0}}
                            animate={{pathLength: 1, opacity: 1}}
                            transition={{delay: delay + 0.05, duration: 0.16, ease: 'easeOut'}}
                          />
                        </svg>
                      </motion.span>
                      <motion.span
                        className="min-w-0 truncate text-sm"
                        initial={{color: '#cbd5e1'}}
                        animate={{color: '#94a3b8', opacity: [1, 1, 0.78]}}
                        transition={{delay, duration: 0.4, times: [0, 0.55, 1]}}
                      >
                        {task}
                      </motion.span>
                      {index === launchTasks.length - 1 && (
                        <motion.span
                          className="pointer-events-none absolute left-[10px] size-7 rounded-lg border border-blue-400/50"
                          initial={{opacity: 0, scale: 0.7, boxShadow: '0 0 0px rgba(59,130,246,0)'}}
                          animate={{
                            opacity: [0, 0.8, 0],
                            scale: [0.75, 1.25, 1.45],
                            boxShadow: ['0 0 0px rgba(59,130,246,0)', '0 0 18px rgba(59,130,246,0.5)', '0 0 0px rgba(59,130,246,0)']
                          }}
                          transition={{delay: delay + 0.27, duration: 0.38, ease: 'easeOut'}}
                          aria-hidden="true"
                        />
                      )}
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
