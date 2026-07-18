import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Paperboat type roles (§3.3), authored as @apply clusters in globals.css.
 *
 * They must be registered in tailwind-merge's `font-size` group: without this,
 * `cn()` reads `text-nav` as a `text-{color}` utility and drops it whenever a
 * real color class is merged alongside it — silently rendering the wrong font.
 *
 * Add every new role to this list AND to the @layer utilities block (§11.1).
 */
const ROLE_CLASSES = [
  "h1",
  "h2",
  "h3",
  "h4",
  "lead",
  "body",
  "body-sm",
  "caption",
  "eyebrow",
  "nav",
  "metric",
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...ROLE_CLASSES] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
