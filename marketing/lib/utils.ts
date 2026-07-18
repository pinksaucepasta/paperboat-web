import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// The DESIGN.md §3.3 type roles (`text-h1`, `text-nav`, …) are custom utilities.
// tailwind-merge doesn't know them, so it guesses from the shape — `text-nav`
// looks like a `text-{color}` class and gets dropped when another text color is
// present (e.g. nav links combine `text-nav` with `text-primary`). Registering
// them in the font-size group makes merge treat them as the size roles they are:
// kept alongside colors, and correctly superseding `text-xs`/`text-base`/etc.
const ROLE_CLASSES = [
  "text-h1",
  "text-h2",
  "text-h3",
  "text-h4",
  "text-lead",
  "text-body",
  "text-body-sm",
  "text-caption",
  "text-eyebrow",
  "text-nav",
]

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": ROLE_CLASSES,
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
