import React from 'react';
import { motion } from 'framer-motion';
import { SystemBuilderLogo } from './SystemBuilderLogo';

interface MobileBrandHeaderProps {
  isSyncing?: boolean;
}

export const MobileBrandHeader: React.FC<MobileBrandHeaderProps> = ({
  isSyncing = false,
}) => (
  <div className="md:hidden px-2 pt-[max(.625rem,env(safe-area-inset-top))] sm:px-3">
    <motion.div
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[18px] border border-blue-100/90 bg-white/90 px-3 py-2.5 shadow-[0_8px_24px_rgba(37,99,235,0.07)] backdrop-blur-xl max-[360px]:gap-2 max-[360px]:px-2.5 max-[360px]:py-2 dark:border-slate-800 dark:bg-slate-900/90"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
      aria-label="System Builder"
    >
      <div className="relative shrink-0">
        <SystemBuilderLogo className="size-10 text-sm sm:size-11" animated />
        {isSyncing && (
          <span
            className="absolute -right-0.5 -top-0.5 size-2.5 animate-pulse rounded-full border-2 border-white bg-amber-400 dark:border-slate-900"
            aria-label="Syncing"
            title="Syncing"
          />
        )}
      </div>

      <div className="min-w-0">
        <div className="truncate text-[15px] font-bold leading-tight tracking-[-0.015em] text-slate-950 max-[360px]:text-[14px] dark:text-white">
          System Builder
        </div>
        <div className="mt-0.5 truncate text-[9px] font-medium leading-tight tracking-[0.025em] text-slate-500 max-[340px]:hidden dark:text-slate-400">
          Build today. Compound tomorrow.
        </div>
      </div>

      <div className="min-w-0 shrink-0 border-l border-slate-200 pl-2.5 text-right leading-none max-[360px]:pl-2 dark:border-slate-700">
        <div className="whitespace-nowrap text-[7px] font-bold uppercase tracking-[0.14em] text-slate-400 max-[360px]:text-[6.5px] dark:text-slate-500">
          Developed by
        </div>
        <div className="mt-1 whitespace-nowrap text-[10px] font-extrabold tracking-[-0.01em] text-slate-800 max-[360px]:text-[9.5px] dark:text-slate-100">
          Rafiq Ahmed
        </div>
      </div>
    </motion.div>
  </div>
);
