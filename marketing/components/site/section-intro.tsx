import { motion } from "motion/react";

import { container, item, viewportOnce } from "@/components/site/motion";

/**
 * Centered section header (eyebrow? · title · description) that settles up as it
 * scrolls into view — the staggered-group reveal from DESIGN.md §8.2. Reusable
 * across content sections so every intro breathes with the same rhythm.
 */
export function SectionIntro({
  eyebrow,
  title,
  description,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={viewportOnce}
      className={`mx-auto max-w-2xl text-center ${className}`}
    >
      {eyebrow ? (
        <motion.span
          variants={item}
          className="text-eyebrow mb-4 block text-primary"
        >
          {eyebrow}
        </motion.span>
      ) : null}
      <motion.h2 variants={item} className="text-h2 text-balance text-foreground">
        {title}
      </motion.h2>
      {description ? (
        <motion.p
          variants={item}
          className="text-lead text-pretty mt-4 text-muted-foreground"
        >
          {description}
        </motion.p>
      ) : null}
    </motion.div>
  );
}
