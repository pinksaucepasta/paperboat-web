import { cn } from "@/lib/utils";

/**
 * The Paperboat mark — a sailed pixel boat on a 12-unit grid.
 *
 * The 27 squares of the source drawing are merged into their 7 horizontal runs;
 * coordinates are untouched, so the sail keeps its half-cell offset against the
 * hull. `crispEdges` stops the browser anti-aliasing the steps back into a blur.
 *
 * The mark carries no plate of its own and draws in `currentColor`, so it takes
 * the brand indigo on light chrome and goes white on the dark login art without
 * a second asset. It is 5:3, so callers size it by height and leave width auto.
 */
export function PaperboatMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 72"
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={cn("h-6 w-auto", className)}
    >
      <rect x="54" y="0" width="12" height="12" />
      <rect x="42" y="12" width="36" height="12" />
      <rect x="30" y="24" width="60" height="12" />
      <rect x="0" y="36" width="24" height="12" />
      <rect x="96" y="36" width="24" height="12" />
      <rect x="12" y="48" width="96" height="12" />
      <rect x="24" y="60" width="72" height="12" />
    </svg>
  );
}
