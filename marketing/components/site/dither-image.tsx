import { useEffect, useState, useSyncExternalStore } from "react";
import { ImageDithering } from "@paper-design/shaders-react";

const DESKTOP_IMAGE = "https://shaders.paper.design/images/image-filters/0014.webp";
const MOBILE_IMAGE = "/paperboat-mobile.png";
const MOBILE_BREAKPOINT = 768;

const mql =
  typeof window !== "undefined"
    ? window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    : null;

function subscribeMobile(cb: () => void) {
  mql?.addEventListener("change", cb);
  return () => mql?.removeEventListener("change", cb);
}

function getIsMobile() {
  return mql?.matches ?? false;
}

/**
 * Resolve a CSS custom property (which may be defined in oklch) to an rgb()
 * string the shader color parser understands. Keeps the effect driven by the
 * blue/white tokens in global.css instead of hard-coded hex values.
 */
function resolveCssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  if (!raw) return fallback;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return fallback;
  ctx.fillStyle = raw;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r}, ${g}, ${b})`;
}

// Base offset of the dither relative to its frame.
const BASE_OFFSET_X = 0;
const BASE_OFFSET_Y = 0;
const BASE_SCALE = 1;

export function DitherImage() {
  const isMobile = useSyncExternalStore(subscribeMobile, getIsMobile, () => false);

  // client:only — document is available on first render.
  const [colors] = useState(() => ({
    blue: resolveCssVar("--primary", "rgb(50, 50, 230)"),
    white: resolveCssVar("--background", "rgb(255, 255, 255)"),
  }));

  // The ImageDithering shader has no time uniform, so we animate it ourselves
  // via requestAnimationFrame. Layering several waves at incommensurate
  // frequencies makes the drift effectively non-repeating, and a slow scale
  // "breath" gives the dither pattern subtle life beyond pure translation.
  const [motion, setMotion] = useState({
    x: BASE_OFFSET_X,
    y: BASE_OFFSET_Y,
    scale: BASE_SCALE,
  });

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      // Sum of waves whose periods don't share a common multiple — the eye
      // never catches the loop. Travel stays within a few pixels.
      setMotion({
        x:
          BASE_OFFSET_X +
          Math.sin(t * 0.21) * 0.003 +
          Math.sin(t * 0.37) * 0.0015,
        y:
          BASE_OFFSET_Y +
          Math.cos(t * 0.17) * 0.003 +
          Math.cos(t * 0.43) * 0.0015,
        // ±0.6% breathing zoom, very slow.
        scale: BASE_SCALE + Math.sin(t * 0.11) * 0.006,
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <ImageDithering
      width="100%"
      height="100%"
      image={isMobile ? MOBILE_IMAGE : DESKTOP_IMAGE}
      colorBack={colors.blue}
      colorFront={colors.white}
      colorHighlight={colors.white}
      originalColors={false}
      inverted={false}
      type="8x8"
      size={2}
      colorSteps={2}
      fit="cover"
      scale={motion.scale}
      offsetX={motion.x}
      offsetY={motion.y}
    />
  );
}
