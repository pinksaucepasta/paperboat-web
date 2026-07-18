import { cn } from "@/lib/utils";

/** The Paperboat glyph — a paper boat on water, drawn to sit optically centered. */
export function PaperboatMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-6", className)} aria-hidden="true">
      <path
        d="M12 4.5 20.5 9 12 12.5 3.5 9 12 4.5Z"
        fill="currentColor"
        opacity="0.55"
      />
      <path
        d="M3.5 12.5c0 3.6 3.8 6.5 8.5 6.5s8.5-2.9 8.5-6.5L12 16 3.5 12.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
