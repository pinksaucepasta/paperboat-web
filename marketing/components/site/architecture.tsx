import { motion } from "motion/react";

import { container, item, viewportOnce } from "@/components/site/motion";
import { SectionIntro } from "@/components/site/section-intro";

/**
 * The platform, drawn honestly: clients on one side, the Paperboat edge in
 * the middle, per-project VMs (machine + volume) on the other — exactly the
 * topology in USERSTORY.md.
 *
 * Two orientations of the same diagram: landscape (clients left → projects
 * right) from `md` up, and a portrait re-composition (clients top → projects
 * stacked below) under `md`, where the landscape version would either need
 * horizontal scrolling or shrink past legibility.
 *
 * Traffic is animated as flowing dashes along the tunnel paths (CSS
 * stroke-dashoffset, GPU-cheap, halted under prefers-reduced-motion). Each
 * diagram is a single responsive SVG so it stays crisp at any size.
 */

const NODE = "fill-[var(--card)] stroke-[var(--border)]";
const LABEL = { fontFamily: "var(--font-mono)", letterSpacing: "0.08em" } as const;

function Flow({ d, dur = 3.2, reverse = false }: { d: string; dur?: number; reverse?: boolean }) {
  return (
    <g fill="none">
      <path d={d} stroke="var(--border)" strokeWidth="1.25" />
      <path
        d={d}
        stroke="var(--primary)"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeDasharray="2 16"
        className="pb-flow motion-reduce:animate-none"
        style={{ animationDuration: `${dur}s`, animationDirection: reverse ? "reverse" : "normal" }}
        opacity="0.5"
      />
    </g>
  );
}

function Client({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width="46" height="46" rx="12" className={NODE} strokeWidth="1" filter="url(#pb-soft)" />
      <g transform="translate(13 13)" className="stroke-[var(--foreground)]" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.75">
        {children}
      </g>
    </g>
  );
}

// The four client glyphs (web, laptop, phone, terminal) — shared by both
// orientations so the set can't drift apart.
const CLIENT_GLYPHS = [
  <>
    <circle cx="8" cy="10" r="8" />
    <path d="M0 10 H16 M8 2 C4.7 6 4.7 14 8 18 C11.3 14 11.3 6 8 2" />
  </>,
  <>
    <rect x="0" y="1" width="16" height="11" rx="1.5" />
    <path d="M5 17.5 H11 M8 12 V17" />
  </>,
  <>
    <rect x="3" y="0" width="10" height="19" rx="2.5" />
    <path d="M6.5 15.5 H9.5" />
  </>,
  <>
    <rect x="0" y="1" width="16" height="16" rx="2" />
    <path d="M4 6 L7.5 9 L4 12 M9 12 H12.5" />
  </>,
];

const PROJECTS = [
  { name: "acme-store", running: true },
  { name: "billing-api", running: true },
  { name: "docs-site", running: false },
] as const;

function ProjectCard({
  x,
  y,
  width,
  name,
  running,
}: {
  x: number;
  y: number;
  width: number;
  name: string;
  running: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={width} height="48" rx="12" className={NODE} strokeWidth="1" filter="url(#pb-soft)" />
      {/* repo/folder mark */}
      <g transform="translate(16 16)" fill="none" stroke={running ? "var(--foreground)" : "var(--muted-foreground)"} strokeWidth="1.4" strokeLinejoin="round" opacity="0.7">
        <path d="M0 2 A2 2 0 0 1 2 0 H5.5 L7.5 2 H14 A2 2 0 0 1 16 4 V13 A2 2 0 0 1 14 15 H2 A2 2 0 0 1 0 13 Z" />
      </g>
      <text x="42" y="29" fontSize="12.5" fill={running ? "var(--foreground)" : "var(--muted-foreground)"} style={LABEL}>{name}</text>
      <circle cx={width - 18} cy="24" r="4" fill={running ? "var(--primary)" : "var(--border)"}>
        {running ? <animate attributeName="opacity" values="1;0.35;1" dur="2.4s" repeatCount="indefinite" /> : null}
      </circle>
    </g>
  );
}

function TunnelNode({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width="150" height="64" rx="14" fill="var(--primary)" fillOpacity="0.06" stroke="var(--primary)" strokeOpacity="0.4" strokeWidth="1" filter="url(#pb-soft)" />
      <g transform="translate(61 13)" fill="none" stroke="var(--primary)" strokeWidth="1.6" strokeLinecap="round">
        <path d="M0 14 C0 6 6 0 14 0 C22 0 28 6 28 14" />
        <path d="M6 14 C6 9 9 6 14 6 C19 6 22 9 22 14" opacity="0.55" />
        <path d="M11 14 C11 12 12 11 14 11 C16 11 17 12 17 14" opacity="0.3" />
      </g>
      <text x="75" y="50" textAnchor="middle" fontSize="12.5" fill="var(--foreground)" style={LABEL}>Paperboat edge</text>
    </g>
  );
}

const A11Y_LABEL =
  "Diagram: every client connects through the Paperboat edge to project environments, with the control plane authorizing connections outside the data path";

/** Landscape (md and up): clients left, tunnel center, projects right. */
function DiagramWide() {
  return (
    <svg viewBox="0 0 800 340" role="img" aria-label={A11Y_LABEL} className="mx-auto hidden w-full max-w-4xl md:block">
      {/* ---- column labels ---- */}
      <text x="83" y="26" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)" style={LABEL}>your devices</text>
      <text x="650" y="26" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)" style={LABEL}>your projects</text>

      {/* ---- data paths (behind nodes) ---- */}
      <Flow d="M106 83 C215 83 245 158 325 166" />
      <Flow d="M106 149 C235 149 255 176 325 178" />
      <Flow d="M106 215 C235 215 255 190 325 190" />
      <Flow d="M106 281 C215 281 250 206 325 200" />
      <Flow d="M475 176 C515 168 535 112 560 104" dur={2.6} />
      <Flow d="M475 182 C525 182 540 182 560 182" dur={2.6} />
      <Flow d="M475 190 C515 198 535 252 560 260" dur={2.6} />

      {/* ---- clients (icon only) ---- */}
      {CLIENT_GLYPHS.map((glyph, i) => (
        <Client key={i} x={60} y={60 + i * 66}>
          {glyph}
        </Client>
      ))}

      {/* Paperboat edge */}
      <TunnelNode x={325} y={150} />

      {/* ---- projects (repo icon + name + status) ---- */}
      {PROJECTS.map((p, i) => (
        <ProjectCard key={p.name} x={560} y={80 + i * 78} width={180} {...p} />
      ))}
    </svg>
  );
}

/** Portrait (below md): clients across the top, tunnel mid, projects stacked. */
function DiagramTall() {
  return (
    <svg viewBox="0 0 360 496" role="img" aria-label={A11Y_LABEL} className="mx-auto w-full max-w-sm md:hidden">
      <text x="180" y="20" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)" style={LABEL}>your devices</text>

      {/* clients row → tunnel */}
      <Flow d="M45 84 C45 140 150 138 153 188" />
      <Flow d="M128 84 C128 132 168 136 171 188" />
      <Flow d="M212 84 C212 132 192 136 189 188" />
      <Flow d="M295 84 C295 140 210 138 207 188" />

      {/* tunnel → the project rail and its stubs */}
      <Flow d="M180 254 C180 286 40 282 40 320 V452" dur={2.6} />
      <Flow d="M40 324 H64" dur={2.6} />
      <Flow d="M40 388 H64" dur={2.6} />
      <Flow d="M40 452 H64" dur={2.6} />

      {CLIENT_GLYPHS.map((glyph, i) => (
        <Client key={i} x={22 + i * 83.3} y={36}>
          {glyph}
        </Client>
      ))}

      <TunnelNode x={105} y={190} />

      <text x="64" y="292" fontSize="11" fill="var(--muted-foreground)" style={LABEL}>your projects</text>

      {PROJECTS.map((p, i) => (
        <ProjectCard key={p.name} x={64} y={300 + i * 64} width={252} {...p} />
      ))}
    </svg>
  );
}

export function Architecture() {
  return (
    <section id="architecture" className="border-t border-border bg-muted/40 px-6 py-[clamp(4rem,7vw,8rem)] lg:px-10">
      <style>{`
        @keyframes pb-flow { to { stroke-dashoffset: -40; } }
        .pb-flow { animation: pb-flow 2.6s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .pb-flow { animation: none; } }
      `}</style>

      <div className="mx-auto w-full max-w-7xl">
        <SectionIntro
          title="One tunnel between you and your agents"
          description="Every client reaches your environments through the authenticated Paperboat edge. Nothing on your machine is exposed as a public port."
        />

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          className="mt-14 lg:mt-20"
        >
          {/* no frame — the diagram sits directly on the section, like a schematic */}
          <motion.div variants={item}>
            {/* the soft node shadow, defined once where it's never display:none,
                so both orientations can reference it */}
            <svg width="0" height="0" className="absolute" aria-hidden="true">
              <defs>
                <filter id="pb-soft" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.06" />
                </filter>
              </defs>
            </svg>
            <DiagramWide />
            <DiagramTall />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
