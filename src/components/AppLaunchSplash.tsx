import React, {useEffect, useState} from 'react';
import {AnimatePresence, motion, useReducedMotion} from 'framer-motion';
import {SystemBuilderLogo} from './SystemBuilderLogo';

export const AppLaunchSplash: React.FC = () => {
  const [visible, setVisible] = useState(true);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), reduceMotion ? 900 : 3600);
    return () => window.clearTimeout(timer);
  }, [reduceMotion]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_18%_18%,rgba(219,234,254,0.94),transparent_34%),radial-gradient(circle_at_82%_76%,rgba(237,233,254,0.9),transparent_38%),linear-gradient(145deg,#f8fbff_0%,#ffffff_48%,#faf7ff_100%)] text-slate-900"
          initial={{opacity:1}}
          exit={reduceMotion ? {opacity:0} : {opacity:0,scale:1.035,filter:'blur(5px)'}}
          transition={{duration:reduceMotion ? .18 : .52,ease:[.16,1,.3,1]}}
          aria-label="System Builder loading screen"
        >
          {!reduceMotion && (
            <>
              <motion.div className="absolute size-72 rounded-full bg-blue-400/10 blur-3xl md:size-96"
                animate={{scale:[.82,1.12,.94],opacity:[.25,.6,.32]}}
                transition={{duration:3.1,ease:'easeInOut'}} />
              <motion.div className="absolute size-52 rounded-full border border-indigo-300/25"
                initial={{scale:.55,opacity:0}} animate={{scale:[.55,1.35,1.6],opacity:[0,.5,0]}}
                transition={{duration:2.3,ease:'easeOut'}} />
            </>
          )}

          <motion.div className="relative flex flex-col items-center px-6 text-center"
            initial={reduceMotion ? {opacity:0} : {opacity:0,y:22,scale:.84,rotateX:18}}
            animate={{opacity:1,y:0,scale:1,rotateX:0}}
            transition={{duration:reduceMotion ? .2 : .72,ease:[.16,1,.3,1]}}>
            <motion.div className="relative"
              animate={reduceMotion ? undefined : {y:[0,-5,0],rotateY:[0,7,0,-5,0]}}
              transition={{delay:.72,duration:1.35,ease:'easeInOut'}}>
              <SystemBuilderLogo className="size-24 text-2xl md:size-28" animated={!reduceMotion} />
              {!reduceMotion && (
                <motion.span className="pointer-events-none absolute -inset-4 rounded-[32%] border border-indigo-300/35"
                  initial={{opacity:0,scale:.8}} animate={{opacity:[0,.8,0],scale:[.8,1.2,1.35]}}
                  transition={{delay:.55,duration:1.15,ease:'easeOut'}} />
              )}
            </motion.div>

            <motion.div className="mt-6 flex flex-col items-center"
              initial={{opacity:0,y:12,filter:reduceMotion ? 'none' : 'blur(5px)'}}
              animate={{opacity:1,y:0,filter:'blur(0px)'}}
              transition={{delay:reduceMotion ? .12 : 1.38,duration:reduceMotion ? .2 : .55,ease:[.16,1,.3,1]}}
              aria-label="Developed by Rafiq Ahmed">
              <motion.span className="text-[9px] font-bold uppercase leading-none tracking-[0.24em] text-slate-400 md:text-[10px]"
                initial={reduceMotion ? false : {letterSpacing:'.38em',opacity:0}}
                animate={{letterSpacing:'.24em',opacity:1}}
                transition={{delay:1.42,duration:.55}}>
                DEVELOPED BY
              </motion.span>
              <motion.span className="mt-1.5 bg-gradient-to-r from-blue-600 via-violet-600 to-indigo-600 bg-clip-text text-sm font-extrabold leading-none tracking-[0.08em] text-transparent md:text-[15px]"
                initial={reduceMotion ? false : {opacity:0,y:7,scale:.96}}
                animate={{opacity:1,y:0,scale:1}}
                transition={{delay:1.66,duration:.48,ease:[.16,1,.3,1]}}>
                RAFIQ AHMED
              </motion.span>
              {!reduceMotion && (
                <motion.span className="mt-4 h-[2px] w-16 overflow-hidden rounded-full bg-slate-200/80">
                  <motion.span className="block h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500"
                    initial={{scaleX:0,transformOrigin:'left'}} animate={{scaleX:1}}
                    transition={{delay:1.95,duration:1.05,ease:[.16,1,.3,1]}} />
                </motion.span>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
