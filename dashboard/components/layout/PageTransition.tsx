"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  enter: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: [0, 0, 0.2, 1] }
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.15, ease: [0.4, 0, 1, 1] }
  }
} as const;

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div variants={pageVariants} initial="initial" animate="enter" exit="exit">
      {children}
    </motion.div>
  );
}
