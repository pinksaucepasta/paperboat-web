import type { Variants } from "motion/react";

/**
 * Paperboat §8.2 reveal vocabulary. These are the shared atoms — import them,
 * never re-derive per component. Expo-out: fast, then gentle.
 */
export const EASE = [0.16, 1, 0.3, 1] as const;

/** Parent of a staggered group. Children cascade in document order. */
export const container: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

/** The atom: fade-up. Default reveal for any block. */
export const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE },
  },
};

/** On-mount entrance (§8.2 pattern 5) — quicker than a scroll reveal. */
export const entranceContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
};

export const entranceItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASE },
  },
};

/** Reveals fire once, as the user reaches the section — they never replay. */
export const viewportOnce = { once: true, amount: 0.25 } as const;
