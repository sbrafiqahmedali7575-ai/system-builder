import React, {useEffect, useState} from 'react';
import {motion, AnimatePresence} from 'framer-motion';
import { SystemBuilderLogo } from './SystemBuilderLogo';

const CONTROL_SECTIONS = [
  {
    eyebrow: 'Some things are under your control:',
    lines: [
      'your effort,',
      'preparation,',
      'attitude,',
      'response,',
      'habits,',
      'decisions,',
      'persistence.',
    ],
  },
  {
    eyebrow: 'Other things are not:',
    lines: [
      "other people's opinions,",
      'economic conditions,',
      'whether someone likes you,',
      'company decisions,',
      'competition,',
      'unexpected events,',
      'the past.',
    ],
  },
  {
    eyebrow: '',
    lines: [
      'You suffer unnecessarily when you try to control the second category.',
    ],
  },
  {
    eyebrow: 'Why it matters',
    lines: [
      'Your mental energy is limited.',
      'Every minute spent worrying about something uncontrollable is energy unavailable for something you can influence.',
    ],
  },
] as const;

const SECTION_TIMINGS = [
  { delay: 0.55, duration: 2.15 },
  { delay: 2.65, duration: 2.15 },
  { delay: 4.75, duration: 1.65 },
  { delay: 6.35, duration: 2.75 },
] as const;

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
          exit={{opacity: 0, scale: 1.018}}
          transition={{duration: 0.42, ease: [0.16, 1, 0.3, 1]}}
          aria-label="System Builder launch screen"
        >
          <motion.div
            className="flex h-full w-full max-w-sm flex-col items-center px-5 pb-6 pt-8 text-center md:max-w-md md:px-8 md:pb-8 md:pt-10"
            initial={{opacity: 0, y: 10, scale: 0.985}}
            animate={{opacity: 1, y: 0, scale: 1}}
            transition={{duration: 0.45, ease: [0.16, 1, 0.3, 1]}}
          >
            <div className="flex shrink-0 flex-col items-center">
              <SystemBuilderLogo className="size-12 rounded-2xl text-lg md:size-14 md:text-xl" animated />
              <motion.h1
                className="mt-2 text-xl font-semibold tracking-tight md:text-2xl"
                initial={{opacity: 0, y: 4}}
                animate={{opacity: 1, y: 0}}
                transition={{delay: 0.08, duration: 0.3}}
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
            </div>

            <div className="relative mt-5 min-h-0 w-full flex-1">
              <div className="absolute inset-0 overflow-hidden rounded-3xl border border-indigo-100/90 bg-white/86 shadow-[0_18px_48px_rgba(79,70,229,0.10)] backdrop-blur-sm">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(99,102,241,0.14),transparent_54%)]"
                />

                {CONTROL_SECTIONS.map((section, index) => {
                  const timing = SECTION_TIMINGS[index];
                  return (
                    <motion.div
                      key={index}
                      className="absolute inset-0 flex items-center justify-center px-5 py-5 md:px-7 md:py-6"
                      initial={{opacity: 0, y: 18, scale: 0.975, filter: 'blur(3px)'}}
                      animate={{
                        opacity: [0, 1, 1, 0],
                        y: [18, 0, 0, -14],
                        scale: [0.975, 1, 1, 0.99],
                        filter: ['blur(3px)', 'blur(0px)', 'blur(0px)', 'blur(2px)'],
                      }}
                      transition={{
                        delay: timing.delay,
                        duration: timing.duration,
                        times: [0, 0.16, 0.82, 1],
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >
                      <div className="w-full">
                        {section.eyebrow && (
                          <motion.div
                            className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-indigo-600 md:text-[11px]"
                            initial={{opacity: 0, y: 4}}
                            animate={{opacity: 1, y: 0}}
                            transition={{delay: timing.delay + 0.08, duration: 0.28}}
                          >
                            {section.eyebrow}
                          </motion.div>
                        )}

                        <div className="space-y-1.5 md:space-y-2">
                          {section.lines.map((line, lineIndex) => (
                            <motion.p
                              key={line}
                              className={
                                index <= 1
                                  ? 'text-[14px] font-extrabold leading-tight tracking-[-0.01em] text-slate-900 md:text-[16px]'
                                  : index === 2
                                  ? 'text-[16px] font-extrabold leading-relaxed tracking-[-0.015em] text-slate-900 md:text-[18px]'
                                  : lineIndex === 0
                                  ? 'text-[16px] font-extrabold leading-relaxed tracking-[-0.015em] text-slate-900 md:text-[18px]'
                                  : 'text-[13px] font-bold leading-relaxed text-slate-600 md:text-[15px]'
                              }
                              initial={{opacity: 0, x: -8}}
                              animate={{opacity: 1, x: 0}}
                              transition={{
                                delay: timing.delay + 0.12 + lineIndex * 0.07,
                                duration: 0.26,
                                ease: 'easeOut',
                              }}
                            >
                              {line}
                            </motion.p>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                <motion.div
                  aria-hidden="true"
                  className="absolute bottom-0 left-0 h-1 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500"
                  initial={{width: '0%'}}
                  animate={{width: '100%'}}
                  transition={{delay: 0.45, duration: 8.85, ease: 'linear'}}
                />
              </div>
            </div>

            <motion.div
              className="mt-4 text-[9px] font-semibold tracking-[0.02em] text-slate-400 md:text-[10px]"
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              transition={{delay: 0.2, duration: 0.3}}
            >
              Focus energy where action is possible.
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
