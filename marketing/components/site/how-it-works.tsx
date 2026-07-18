import { motion } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  GitBranchIcon,
  HardDriveIcon,
  GlobalIcon,
} from "@hugeicons/core-free-icons";

import { container, item, viewportOnce } from "@/components/site/motion";
import { SectionIntro } from "@/components/site/section-intro";

/**
 * The three-step story from USERSTORY.md's happy path, drawn as three distinct
 * geometric families that share one voice (thin indigo strokes, slow ambient
 * motion) but nothing else — so the row reads as a progression, not a pattern:
 *
 *   01 · THE WEAVE  — lines.  Loose strands gather into one continuous thread:
 *                     a repository becoming a project.
 *   02 · THE STACK  — planes. Three levitating isometric layers — volume,
 *                     machine, workspace — the environment as architecture.
 *   03 · THE ORBITS — curves. Clients circling the workspace nucleus on
 *                     inclined elliptical paths: reachable from any direction.
 *
 * Lines → planes → curves. All animation is transform/dash only and halts
 * under prefers-reduced-motion.
 */

function GeometryStyles() {
  return (
    <style>{`
      @keyframes pb-geo-flow { to { stroke-dashoffset: -44; } }
      @keyframes pb-geo-bob {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-5px); }
      }
      @keyframes pb-geo-orbit { to { transform: rotate(360deg); } }
      @keyframes pb-geo-breathe {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.08); }
      }
      @keyframes pb-geo-ripple {
        0%, 100% { opacity: 0.28; }
        50% { opacity: 0.75; }
      }
      .pb-geo-flow, .pb-geo-bob, .pb-geo-orbit, .pb-geo-breathe {
        transform-origin: 100px 100px;
        transform-box: view-box;
      }
      .pb-geo-flow { animation: pb-geo-flow 3.2s linear infinite; }
      .pb-geo-bob { animation: pb-geo-bob 6s ease-in-out infinite; }
      .pb-geo-orbit { animation: pb-geo-orbit 16s linear infinite; }
      .pb-geo-breathe { animation: pb-geo-breathe 8s ease-in-out infinite; }
      .pb-geo-ripple { animation: pb-geo-ripple 3.6s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) {
        .pb-geo-flow, .pb-geo-bob, .pb-geo-orbit, .pb-geo-breathe, .pb-geo-ripple { animation: none !important; }
      }
    `}</style>
  );
}

const FIGURE = "w-full max-w-52 text-primary lg:max-w-60";

/** 01 — The weave: five strands become one thread. */
function StepWeave() {
  // Strands enter scattered on the left, cross once (the braid), and leave as
  // a single line. The dash animation makes the whole figure flow rightward.
  const strands = [
    "M8 40 C 60 40, 88 96, 128 100",
    "M8 70 C 56 70, 84 92, 128 100",
    "M8 100 H 128",
    "M8 130 C 56 130, 84 108, 128 100",
    "M8 160 C 60 160, 88 104, 128 100",
  ];
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" className={FIGURE}>
      <g fill="none" stroke="currentColor">
        {strands.map((d, i) => (
          <path
            key={i}
            d={d}
            strokeWidth="1.3"
            strokeDasharray="4 7"
            strokeLinecap="round"
            className="pb-geo-flow"
            opacity={i === 2 ? 0.6 : 0.4}
          />
        ))}
        {/* the origins */}
        {[40, 70, 100, 130, 160].map((y) => (
          <circle key={y} cx="8" cy={y} r="3" fill="var(--background)" strokeWidth="1.3" />
        ))}
        {/* the knot — where strands become one */}
        <circle cx="128" cy="100" r="6.5" fill="currentColor" stroke="none" className="pb-geo-breathe" />
        {/* the single thread out */}
        <path d="M136 100 H 189" strokeWidth="2" strokeLinecap="round" />
        <path d="M180 93.5 L 190 100 L 180 106.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** 02 — The stack: three levitating planes — volume, machine, workspace. */
function StepStack() {
  // One isometric rhombus, reused at three heights. Corners tethered by
  // dashed verticals; each plane bobs on its own phase, like held in a field.
  const plane = (y: number) => `M100 ${y - 30} L 162 ${y} L 100 ${y + 30} L 38 ${y} Z`;
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" className={FIGURE}>
      <g fill="none" stroke="currentColor">
        {/* tethers */}
        {[38, 100, 162].map((x) => (
          <path key={x} d={`M${x} 52 V 148`} strokeWidth="1" strokeDasharray="1 6" strokeLinecap="round" opacity="0.35" />
        ))}

        {/* bottom — the volume: hatched, it holds the data */}
        <g className="pb-geo-bob" style={{ animationDelay: "0s" }}>
          <path d={plane(152)} strokeWidth="1.2" fill="var(--background)" opacity="0.9" />
          <path d="M 68 152 L 99 137 M 84 160 L 115 145 M 100 168 L 131 153" strokeWidth="1" opacity="0.25" />
        </g>

        {/* middle — the machine: the solid core lives here */}
        <g className="pb-geo-bob" style={{ animationDelay: "-2s" }}>
          <path d={plane(100)} strokeWidth="1.2" fill="var(--background)" opacity="0.95" />
          <path d="M100 86 L 129 100 L 100 114 L 71 100 Z" fill="currentColor" stroke="none" className="pb-geo-breathe" />
        </g>

        {/* top — the workspace: open, where the agents work */}
        <g className="pb-geo-bob" style={{ animationDelay: "-4s" }}>
          <path d={plane(48)} strokeWidth="1.2" fill="var(--background)" opacity="0.9" />
          <path d="M69 48 L 100 63 L 131 48 M100 33 V 63" strokeWidth="1" opacity="0.3" />
        </g>
      </g>
    </svg>
  );
}

/** 03 — The wormhole: eleven rings pinching to a throat. */
function StepOrbits() {
  const count = 11;
  const yStart = 30;
  const yEnd = 170;
  const maxRx = 78;
  const minRx = 16;

  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" className={FIGURE}>
      <g fill="none" stroke="currentColor">
        {Array.from({ length: count }, (_, i) => {
          const t = (i - (count - 1) / 2) / ((count - 1) / 2); // -1 to 1
          const cy = yStart + (yEnd - yStart) * (i / (count - 1));
          const rx = minRx + (maxRx - minRx) * t * t;
          const ry = rx * 0.3;
          // Ripple runs out from the throat (t=0) to both mouths, so the pulse
          // reads as energy travelling down the tunnel — staggered by distance.
          const delay = (1 - Math.abs(t)) * -1.8;
          return (
            <ellipse
              key={i}
              cx="100"
              cy={cy}
              rx={rx}
              ry={ry}
              strokeWidth="1.3"
              className="pb-geo-ripple"
              style={{ animationDelay: `${delay}s` }}
            />
          );
        })}
      </g>
    </svg>
  );
}

const steps = [
  {
    icon: GitBranchIcon,
    illustration: <StepWeave />,
    label: "01 · Create",
    title: "Start from any repo",
    body: "Point Paperboat at a git repository. It becomes a project: cloned, configured, and ready for your agents.",
  },
  {
    icon: HardDriveIcon,
    illustration: <StepStack />,
    label: "02 · Provision",
    title: "Get a dedicated machine",
    body: "Every project runs on its own isolated VM with its own persistent volume. Pick the machine size and disk that fit the job.",
  },
  {
    icon: GlobalIcon,
    illustration: <StepOrbits />,
    label: "03 · Connect",
    title: "Reach it from anywhere",
    body: "Attach from the desktop app, your phone, or the terminal. Agents keep working in the cloud while your laptop sleeps.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-border bg-background px-6 py-[clamp(4rem,7vw,8rem)] lg:px-10">
      <GeometryStyles />
      <div className="mx-auto w-full max-w-7xl">
        <SectionIntro
          title="Repo to running agent in three steps"
          description="No servers to babysit, no dotfiles to re-create. Paperboat turns a git URL into a persistent agent workspace."
        />

        <motion.ol
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          className="mt-16 grid gap-16 lg:mt-20 lg:grid-cols-3 lg:gap-10"
        >
          {steps.map((step) => (
            <motion.li key={step.label} variants={item} className="flex flex-col items-center text-center">
              <div className="flex w-full items-center justify-center px-6 lg:px-4">
                {step.illustration}
              </div>
              <span className="text-eyebrow mt-10 flex items-center gap-2 text-primary">
                <HugeiconsIcon icon={step.icon} className="size-3.5 shrink-0" />
                {step.label}
              </span>
              <h3 className="text-h4 mt-3 text-foreground">{step.title}</h3>
              <p className="text-body-sm mt-3 max-w-xs text-pretty text-muted-foreground">{step.body}</p>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </section>
  );
}
