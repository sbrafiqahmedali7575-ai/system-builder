import React, {useEffect, useState} from 'react';
import {motion, AnimatePresence} from 'framer-motion';

const launchTasks = ['Plan the day', 'Focus on priorities', 'Build consistency'];

export const AppLaunchSplash: React.FC = () => {
  const [visible, setVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 767px)').matches;
    setIsMobile(mobile);
    const timer = window.setTimeout(() => setVisible(false), mobile ? 8000 : 1500);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden ${isMobile ? "bg-[radial-gradient(circle_at_18%_18%,rgba(219,234,254,0.9),transparent_34%),radial-gradient(circle_at_82%_76%,rgba(237,233,254,0.85),transparent_38%),linear-gradient(145deg,#f8fbff_0%,#ffffff_48%,#faf7ff_100%)] text-slate-900" : "bg-slate-950 text-white"}`}
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
              className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-xl font-bold text-white shadow-xl ring-1 ring-white/70 ${isMobile ? "shadow-indigo-200/70" : "shadow-blue-500/25"}`}
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
                className="mt-5 w-full space-y-2.5"
                initial={{opacity: 0, y: 8}}
                animate={{opacity: 1, y: 0}}
                transition={{delay: 0.55, duration: 0.45}}
                aria-label="Completing launch tasks"
              >
                {launchTasks.map((task, index) => {
                  const delay = 1.25 + index * 1.15;
                  return (
                    <motion.div
                      key={task}
                      className="relative flex h-10 items-center gap-3 rounded-xl border px-3 text-left"
                      initial={{opacity: 0, x: -10, backgroundColor: 'rgba(255,255,255,0.9)', borderColor: '#e2e8f0', boxShadow: '0 8px 24px rgba(51,65,85,0.04)'}}
                      animate={{
                        opacity: [0, 1, 1, 0.82],
                        x: 0,
                        backgroundColor: ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.98)', 'rgba(238,242,255,0.98)', 'rgba(255,255,255,0.9)'],
                        borderColor: ['#e2e8f0', '#dbeafe', '#818cf8', '#e0e7ff']
                      }}
                      transition={{
                        opacity: {times: [0, 0.18, 0.78, 1], delay: 0.25 + index * 0.12, duration: delay + 0.7 - (0.25 + index * 0.12)},
                        x: {delay: 0.25 + index * 0.12, duration: 0.28},
                        backgroundColor: {delay, duration: 0.65, times: [0, 0.15, 0.48, 1]},
                        borderColor: {delay, duration: 0.65, times: [0, 0.15, 0.48, 1]}
                      }}
                    >
                      <motion.span
                        className="relative block size-5 flex-none rounded-[5px] border"
                        initial={{backgroundColor: '#ffffff', borderColor: '#94a3b8'}}
                        animate={{backgroundColor: index === 1 ? '#4f46e5' : index === 2 ? '#7c3aed' : '#2563eb', borderColor: index === 1 ? '#4f46e5' : index === 2 ? '#7c3aed' : '#2563eb'}}
                        transition={{delay, duration: 0.2}}
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
                            transition={{delay: delay + 0.08, duration: 0.24, ease: 'easeOut'}}
                          />
                        </svg>
                      </motion.span>
                      <motion.span
                        className="min-w-0 truncate text-sm"
                        initial={{color: '#334155'}}
                        animate={{color: '#64748b', opacity: [1, 1, 0.82]}}
                        transition={{delay, duration: 0.65, times: [0, 0.6, 1]}}
                      >
                        {task}
                      </motion.span>
                      {index === launchTasks.length - 1 && (
                        <motion.span
                          className="pointer-events-none absolute left-[10px] size-7 rounded-lg border border-violet-400/50"
                          initial={{opacity: 0, scale: 0.7, boxShadow: '0 0 0px rgba(124,58,237,0)'}}
                          animate={{
                            opacity: [0, 0.8, 0],
                            scale: [0.75, 1.25, 1.45],
                            boxShadow: ['0 0 0px rgba(124,58,237,0)', '0 0 20px rgba(124,58,237,0.38)', '0 0 0px rgba(124,58,237,0)']
                          }}
                          transition={{delay: delay + 0.48, duration: 0.55, ease: 'easeOut'}}
                          aria-hidden="true"
                        />
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            <motion.div className={isMobile ? 'mt-4 h-1 w-12 rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-amber-400' : 'mt-3 h-px w-10 bg-blue-500'} initial={{scaleX: 0}} animate={{scaleX: 1}} transition={{delay: isMobile ? 4.95 : 0.35, duration: 0.4}} />
            <motion.p
              className={`mt-3 text-xs font-semibold ${isMobile ? "bg-gradient-to-r from-blue-600 via-violet-600 to-indigo-600 bg-[length:220%_100%] bg-clip-text text-transparent" : "tracking-[0.18em] text-slate-400"}`}
              initial={{opacity: 0, y: 7, letterSpacing: '0.11em', filter: 'blur(2px)'}}
              animate={isMobile ? {
                opacity: [0, 1, 1, 1],
                y: [7, 0, 0, 0],
                letterSpacing: ['0.11em', '0.18em', '0.205em', '0.18em'],
                filter: ['blur(2px)', 'blur(0px)', 'blur(0px)', 'blur(0px)'],
                backgroundPosition: ['0% 50%', '0% 50%', '100% 50%', '100% 50%']
              } : {opacity: 1, y: 0, letterSpacing: '0.18em', filter: 'blur(0px)'}}
              transition={isMobile ? {
                delay: 5.12,
                duration: 2.15,
                times: [0, 0.28, 0.72, 1],
                ease: [0.16, 1, 0.3, 1]
              } : {delay: 0.45}}
            >
              DEVELOPED BY RAFIQ AHMED
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
