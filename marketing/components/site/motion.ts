import type { Variants } from "motion/react";

/**
 * Shared entrance-motion vocabulary (DESIGN.md §8.2). Every scroll reveal on the
 * site imports these so sections breathe with one rhythm — don't re-derive fade
 * values per component.
 */

// Expo-out: fast then gentle. JS twin of --ease-physical, without the overshoot.
export const EASE = [0.16, 1, 0.3, 1] as const;

// Parent of a staggered group (link columns, card grids, an intro's title+copy).
export const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

// The atom: a small settling fade-up. Pair as a child of `container`.
export const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

// Shared viewport trigger: reveal once as the section arrives, never replay.
export const viewportOnce = { once: true, amount: 0.25 } as const;

/**
 * On-load hero entrance (DESIGN.md §8.2, pattern 5) — the staggered group, but
 * fired on mount and quicker, so the hero reads as *arriving*, not withholding.
 * Hero only; trigger with initial="hidden" animate="show" (not whileInView).
 */
export const heroContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};

export const heroItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};
