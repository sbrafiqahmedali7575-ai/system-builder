import React, {useEffect, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {SystemBuilderLogo} from './SystemBuilderLogo';

export const AppLaunchSplash: React.FC = () => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 2800);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_18%_18%,rgba(219,234,254,0.9),transparent_34%),radial-gradient(circle_at_82%_76%,rgba(237,233,254,0.85),transparent_38%),linear-gradient(145deg,#f8fbff_0%,#ffffff_48%,#faf7ff_100%)] text-slate-900"
          initial={{opacity: 1}}
          exit={{opacity: 0, scale: 1.015}}
          transition={{duration: 0.4, ease: [0.16, 1, 0.3, 1]}}
          aria-label="System Builder launch screen"
        >
          <motion.div
            className="flex flex-col items-center px-6 text-center"
            initial={{opacity: 0, y: 10, scale: 0.97}}
            animate={{opacity: 1, y: 0, scale: 1}}
            transition={{duration: 0.5, ease: [0.16, 1, 0.3, 1]}}
          >
            <motion.div
              initial={{opacity: 0, scale: 0.88}}
              animate={{opacity: 1, scale: [0.88, 1.04, 1]}}
              transition={{duration: 0.58, ease: [0.16, 1, 0.3, 1]}}
            >
              <SystemBuilderLogo
                className="size-16 text-2xl md:size-[72px]"
                animated
              />
            </motion.div>

            <motion.div
              className="mt-5 flex flex-col items-center"
              initial={{opacity: 0, y: 8}}
              animate={{opacity: 1, y: 0}}
              transition={{delay: 0.42, duration: 0.38, ease: [0.16, 1, 0.3, 1]}}
              aria-label="Developed by Rafiq Ahmed"
            >
              <span className="text-[9px] font-bold uppercase leading-none tracking-[0.24em] text-slate-400 md:text-[10px]">
                DEVELOPED BY
              </span>
              <span className="mt-1.5 bg-gradient-to-r from-blue-600 via-violet-600 to-indigo-600 bg-clip-text text-sm font-extrabold leading-none tracking-[0.08em] text-transparent md:text-[15px]">
                RAFIQ AHMED
              </span>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
