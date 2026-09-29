import React, {useEffect, useState} from 'react';
import {motion, AnimatePresence} from 'framer-motion';
import { SystemBuilderLogo } from './SystemBuilderLogo';

const launchTasks = ['Plan the day', 'Focus on priorities', 'Build consistency'];

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
                className="mt-5 md:mt-6 w-full space-y-2.5 md:space-y-3"
                initial={{opacity: 0, y: 8}}
                animate={{opacity: 1, y: 0}}
                transition={{delay: 0.55, duration: 0.45}}
                aria-label="Completing launch tasks"
              >
                {launchTasks.map((task, index) => {
                  const delay = 0.72 + index * 0.92;
                  return (
                    <motion.div
                      key={task}
                      className="relative flex h-10 md:h-11 items-center gap-3 rounded-xl border px-3 md:px-3.5 text-left"
                      initial={{opacity: 0, x: -10, backgroundColor: 'rgba(255,255,255,0.9)', borderColor: '#e2e8f0', boxShadow: '0 8px 24px rgba(51,65,85,0.04)'}}
                      animate={{
                        opacity: [0, 1, 1, 0.82],
                        x: 0,
                        backgroundColor: ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.98)', 'rgba(238,242,255,0.98)', 'rgba(255,255,255,0.9)'],
                        borderColor: ['#e2e8f0', '#dbeafe', '#818cf8', '#e0e7ff']
                      }}
                      transition={{
                        opacity: {times: [0, 0.18, 0.78, 1], delay: 0.2 + index * 0.1, duration: delay + 0.62 - (0.2 + index * 0.1)},
                        x: {delay: 0.2 + index * 0.1, duration: 0.25},
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
                        className="min-w-0 truncate text-sm md:text-[15px]"
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
                          transition={{delay: delay + 0.38, duration: 0.48, ease: 'easeOut'}}
                          aria-hidden="true"
                        />
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>

            <motion.div className="mt-4 h-1 w-12 rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-amber-400" initial={{scaleX: 0}} animate={{scaleX: 1}} transition={{delay: 2.95, duration: 0.25}} />
            <motion.div
              className="relative mt-3 flex flex-col items-center justify-center text-center"
              initial={{opacity: 0, y: 10, scale: 0.975, filter: 'blur(2px)'}}
              animate={{opacity: [0, 1, 1], y: [10, 0, 0], scale: [0.975, 1, 1], filter: ['blur(2px)', 'blur(0px)', 'blur(0px)']}}
              transition={{delay: 3.2, duration: 0.75, times: [0, 0.72, 1], ease: [0.16, 1, 0.3, 1]}}
              aria-label="Developed by Rafiq Ahmed"
            >
              <motion.span
                className="text-[8px] md:text-[9px] font-semibold leading-none tracking-[0.22em] text-slate-400"
                initial={{opacity: 0, y: 2}}
                animate={{opacity: 1, y: 0}}
                transition={{delay: 3.3, duration: 0.42, ease: 'easeOut'}}
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
                transition={{delay: 3.45, duration: 2.75, times: [0, 0.28, 0.66, 1], ease: [0.16, 1, 0.3, 1]}}
              >
                RAFIQ AHMED
              </motion.span>
              <motion.span
                className="pointer-events-none absolute -bottom-2 h-px w-16 bg-gradient-to-r from-transparent via-indigo-400/70 to-transparent"
                initial={{opacity: 0, scaleX: 0.35}}
                animate={{opacity: [0, 0.7, 0], scaleX: [0.35, 1, 1.12]}}
                transition={{delay: 5.15, duration: 1.25, ease: 'easeInOut'}}
                aria-hidden="true"
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
