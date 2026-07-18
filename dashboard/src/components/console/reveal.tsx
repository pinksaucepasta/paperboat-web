"use client";

import { motion } from "motion/react";

import { container, viewportOnce } from "@/lib/motion";

/**
 * Wraps a group of `item`-variant children in the §8.2 scroll reveal.
 * One reveal per section — not per element.
 */
export function Reveal({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={viewportOnce}
      className={className}
    >
      {children}
    </motion.div>
  );
}
