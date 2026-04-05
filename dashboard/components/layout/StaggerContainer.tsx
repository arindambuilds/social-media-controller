"use client";

import type { HTMLMotionProps } from "framer-motion";
import { motion } from "framer-motion";

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } }
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 400, damping: 28 }
  }
} as const;

export function StaggerContainer({ children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" {...props}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div variants={itemVariants} {...props}>
      {children}
    </motion.div>
  );
}
