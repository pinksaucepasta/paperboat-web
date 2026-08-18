"use client";

import { useEffect, useRef } from "react";

import { PaperboatMark } from "@/components/paperboat-mark";

/**
 * The brand panel's signature, built with the product's own dither engine
 * (see components/dither-kit/dither-paint.ts): a 4×4 Bayer ordered-dither
 * scatter of a single colour, varying only its alpha — the "colour vs opacity"
 * rule that keeps the look coherent on any backdrop. Shaped as a rising area
 * beneath a crisp value line with plotted nodes, it is the exact motif the
 * console renders for a live metric, so the sign-in screen previews what's
 * inside.
 *
 * Rendered to a low-resolution backing canvas and upscaled with
 * `image-rendering: pixelated`, so the cells stay chunky and crisp. It draws
 * itself in once on load, left to right, like a chart arriving — then rests.
 * Reduced-motion shows the finished plot immediately.
 */

// The exact 4×4 Bayer matrix the charts dither with, normalized to 0–1.
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => (v + 0.5) / 16));

const CELL = 3; // css px per dither cell — chunky enough to read as pixels

// The dither-kit "blue" seed (palette.ts): the area fill, the bright series
// line, and the star sparkle for plotted points.
const FILL = "53,143,243";
const LINE = "150,200,255";
const STAR = "205,228,255";

const BORDER_ALPHA = 0.72; // the value-line stroke, just under solid
// Node positions along the series (fractions of the width). The last is the
// "current value" — the live tip.
const NODES = [0.17, 0.41, 0.64, 0.92];
const LIVE = NODES[NODES.length - 1];

// The value line: fraction-from-top where the dithered area begins, climbing
// toward the right (value growing) with a soft curve so it reads as a plot.
const valueLine = (fx: number) =>
  0.66 - 0.24 * fx + 0.05 * Math.sin(fx * Math.PI * 1.6);

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

export function LoginDither() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cols = 0;
    let rows = 0;

    const size = () => {
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (!w || !h) return false;
      cols = Math.max(8, Math.round(w / CELL));
      rows = Math.max(8, Math.round(h / CELL));
      canvas.width = cols;
      canvas.height = rows;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      return true;
    };

    // Paint the plot up to horizontal progress `p` (0–1) — the reveal wipes the
    // series in from the left, the value line drawing across as it goes.
    const paint = (p: number) => {
      ctx.clearRect(0, 0, cols, rows);

      for (let x = 0; x < cols; x++) {
        const fx = x / (cols - 1);
        if (fx > p) break;
        const lineRow = valueLine(fx) * (rows - 1);

        for (let y = 0; y < rows; y++) {
          const fy = y / (rows - 1);
          const lf = valueLine(fx);
          const threshold = BAYER[y & 3][x & 3];

          if (fy < lf) {
            // Above the line — faint ambient specks thinning toward the top.
            const amb = 0.05 * (1 - fy / lf);
            if (amb > threshold) {
              ctx.fillStyle = `rgba(${FILL},0.16)`;
              ctx.fillRect(x, y, 1, 1);
            }
            continue;
          }
          // Within the area — dense at the floor, thinning up to the line.
          const density = (fy - lf) / (1 - lf);
          const lit = density > threshold;
          const alpha = lit
            ? 0.3 + 0.5 * density
            : (0.3 + 0.5 * density) * 0.32;
          ctx.fillStyle = `rgba(${FILL},${alpha})`;
          ctx.fillRect(x, y, 1, 1);
        }

        // The value line itself — a crisp bright stroke with a faint feather
        // below, so the area reads as a plotted series, not just a gradient.
        const ly = Math.round(lineRow);
        ctx.fillStyle = `rgba(${LINE},${BORDER_ALPHA})`;
        ctx.fillRect(x, ly, 1, 1);
        ctx.fillStyle = `rgba(${LINE},${BORDER_ALPHA * 0.4})`;
        ctx.fillRect(x, ly + 1, 1, 1);
      }

      // Plotted nodes riding the line — a bright star with a haloed base.
      for (const nx of NODES) {
        if (nx > p) continue;
        const cx = Math.round(nx * (cols - 1));
        const cy = Math.round(valueLine(nx) * (rows - 1));
        ctx.fillStyle = `rgba(${LINE},0.5)`;
        ctx.fillRect(cx - 1, cy - 1, 3, 3); // halo
        ctx.fillStyle = `rgba(${STAR},0.95)`;
        ctx.fillRect(cx, cy, 1, 1); // core
      }
    };

    let raf = 0;
    const reduce =
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

    const run = () => {
      if (!size()) return;
      if (reduce) {
        paint(1);
        return;
      }
      const start = performance.now();
      const DURATION = 1100;
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / DURATION);
        paint(easeOutCubic(t));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    };

    run();
    // On resize, snap to the finished plot — don't replay the entrance.
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      if (size()) paint(1);
    });
    ro.observe(parent);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <canvas
        ref={ref}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ imageRendering: "pixelated" }}
      />
      {/* The live tip — the paper boat riding the crest of the series line at
          the current value: brand mark, chart, and "running now" signal as one
          image. A soft aura pulses beneath it as a wake; stilled under reduced
          motion. Positioned on the last node. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          left: `${LIVE * 100}%`,
          top: `${valueLine(LIVE) * 100}%`,
          transform: "translate(-50%, -62%)",
        }}
      >
        <span
          className="absolute left-1/2 top-full size-10 -translate-x-1/2 -translate-y-1/2 rounded-full animate-ping [animation-duration:3s] motion-reduce:hidden"
          style={{
            background:
              "radial-gradient(circle, rgba(150,200,255,0.45), transparent 65%)",
          }}
        />
        <PaperboatMark className="relative h-6 w-auto text-white drop-shadow-[0_2px_10px_rgba(53,143,243,0.65)]" />
      </span>
    </>
  );
}
