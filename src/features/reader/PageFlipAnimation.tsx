import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface PageFlipAnimationProps {
  children: ReactNode;
  pageKey: string | number;
  direction: 1 | -1;
}

export default function PageFlipAnimation({ children, pageKey, direction }: PageFlipAnimationProps) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pageKey}
        initial={{ opacity: 0, x: direction * 80, scale: 0.98 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: direction * -80, scale: 0.98 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
