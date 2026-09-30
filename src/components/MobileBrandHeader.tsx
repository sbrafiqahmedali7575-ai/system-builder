import React from 'react';
import { motion } from 'framer-motion';
import { SystemBuilderLogo } from './SystemBuilderLogo';

interface MobileBrandHeaderProps {
  isSyncing?: boolean;
}

export const MobileBrandHeader: React.FC<MobileBrandHeaderProps> = ({
  isSyncing = false,
}) => (
  <div className="md:hidden px-2 pt-3 sm:px-3">
    <motion.div
      className="flex items-center gap-3.5 rounded-[20px] border border-blue-100/90 bg-white/90 px-3.5 py-3 shadow-[0_10px_30px_rgba(37,99,235,0.08)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
      aria-label="System Builder"
    >
      <SystemBuilderLogo className="size-11 text-sm" animated />

      <div className="min-w-0 flex-1">
        <div className="text-[16px] font-bold leading-tight tracking-[-0.015em] text-slate-950 dark:text-white">
          System Builder
        </div>
        <div className="mt-1 text-[10px] font-medium leading-none tracking-[0.035em] text-slate-500 dark:text-slate-400">
          Build today. Compound tomorrow.
        </div>
      </div>

      {isSyncing ? (
        <div className="flex flex-none items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] font-bold text-amber-700 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
          <span className="size-2 animate-pulse rounded-full bg-amber-400 ring-2 ring-white dark:ring-slate-900" />
          <span>Syncing</span>
        </div>
      ) : (
        <div className="flex flex-none items-center border-l border-slate-200 pl-3 dark:border-slate-700">
          <div className="text-right leading-none">
            <div className="text-[8px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Developed by
            </div>
            <div className="mt-1 text-[11px] font-extrabold tracking-[-0.01em] text-slate-800 dark:text-slate-100">
              Rafiq Ahmed
            </div>
          </div>
        </div>
      )}
    </motion.div>
  </div>
);
