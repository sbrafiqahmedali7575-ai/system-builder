import React, {useEffect, useState} from 'react';
import {motion, AnimatePresence} from 'framer-motion';

export const AppLaunchSplash: React.FC = () => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 1500);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950 text-white"
          initial={{opacity: 1}}
          exit={{opacity: 0, scale: 1.03}}
          transition={{duration: 0.45, ease: [0.16, 1, 0.3, 1]}}
          aria-label="System Builder launch screen"
        >
          <motion.div
            className="flex flex-col items-center px-6 text-center"
            initial={{opacity: 0, y: 16, scale: 0.96}}
            animate={{opacity: 1, y: 0, scale: 1}}
            transition={{duration: 0.55, ease: [0.16, 1, 0.3, 1]}}
          >
            <motion.div
              className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-bold shadow-2xl shadow-blue-500/25"
              initial={{rotate: -8, scale: 0.8}}
              animate={{rotate: 0, scale: 1}}
              transition={{type: 'spring', stiffness: 220, damping: 16}}
            >
              S
            </motion.div>
            <motion.h1 className="text-2xl font-semibold tracking-tight" initial={{opacity: 0}} animate={{opacity: 1}} transition={{delay: 0.2}}>
              System Builder
            </motion.h1>
            <motion.div className="mt-3 h-px w-10 bg-blue-500" initial={{scaleX: 0}} animate={{scaleX: 1}} transition={{delay: 0.35, duration: 0.4}} />
            <motion.p className="mt-3 text-xs font-medium tracking-[0.18em] text-slate-400" initial={{opacity: 0, y: 6}} animate={{opacity: 1, y: 0}} transition={{delay: 0.45}}>
              DEVELOPED BY RAFIQ AHMED
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
