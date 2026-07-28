import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon } from "@hugeicons/core-free-icons";

import { container, item, viewportOnce } from "@/components/site/motion";

/**
 * Two alternating split sections — copy on one side, a living illustration on
 * the other — covering the platform's two most load-bearing behaviors from
 * USERSTORY.md: runtime metering (credits only burn while a machine runs) and
 * the GitHub-backed config sync that makes machines
 * disposable without losing your setup. Illustrations are real state machines,
 * not decorations: each one steps through the actual lifecycle it describes.
 */

// ---------------------------------------------------------------- lifecycle

/**
 * A day in the life of one machine, drawn as a chart instead of a UI mock.
 * The top band is 24 hours of machine state (running / stopped); the
 * line below is cumulative spend. A playhead sweeps the day once and the
 * spend line climbs only while the machine is up and goes flat after the user
 * stops it. The flat stretches are the argument.
 */

type DayKind = "run" | "sleep";
const DAY: { from: number; to: number; kind: DayKind }[] = [
  { from: 0, to: 8.5, kind: "sleep" },
  { from: 8.5, to: 12, kind: "run" },
  { from: 12, to: 12.5, kind: "run" },
  { from: 12.5, to: 14, kind: "sleep" },
  { from: 14, to: 19, kind: "run" },
  { from: 19, to: 19.5, kind: "run" },
  { from: 19.5, to: 24, kind: "sleep" },
];
const METERED = DAY.filter((s) => s.kind !== "sleep").reduce((a, s) => a + (s.to - s.from), 0);

/** cumulative metered hours at time t */
function spendAt(t: number) {
  let sum = 0;
  for (const s of DAY) {
    if (s.kind === "sleep") continue;
    sum += Math.max(0, Math.min(s.to, t) - s.from);
  }
  return sum;
}

function kindAt(t: number): DayKind {
  return DAY.find((s) => t >= s.from && t < s.to)?.kind ?? "sleep";
}

const DAY_STATUS: Record<DayKind, string> = {
  run: "metering · agent working",
  sleep: "zero spend · machine stopped",
};

// chart geometry (SVG user units)
const CX0 = 8;
const CX1 = 552;
const TRACK_Y = 18;
const TRACK_H = 12;
const CHART_TOP = 78;
const CHART_BASE = 168;
const x = (t: number) => CX0 + ((CX1 - CX0) * t) / 24;
const y = (spend: number) => CHART_BASE - ((CHART_BASE - CHART_TOP) * spend) / METERED;

function spendPath(upTo: number) {
  const pts: string[] = [`M${x(0)} ${y(0)}`];
  // spend is piecewise-linear: one point per segment boundary is exact
  for (const s of DAY) {
    if (s.from >= upTo) break;
    const end = Math.min(s.to, upTo);
    pts.push(`L${x(end).toFixed(1)} ${y(spendAt(end)).toFixed(1)}`);
  }
  return pts.join(" ");
}

function LifecycleIllustration() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const [t, setT] = useState(0);

  useEffect(() => {
    if (reduce) {
      setT(24);
      return;
    }
    if (!inView) return;
    const SWEEP = 16000; // one day
    const HOLD = 3000; // rest on the finished chart before looping
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const el = (now - start) % (SWEEP + HOLD);
      setT(Math.min(24, (el / SWEEP) * 24));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduce]);

  const kind = kindAt(Math.min(t, 23.99));
  const hh = String(Math.floor(t) % 24).padStart(2, "0");
  const mm = String(Math.floor((t % 1) * 60)).padStart(2, "0");
  const done = t >= 24;
  const firstStop = DAY.find((s) => s.kind === "run")!.to;

  return (
    <div ref={ref}>
      {/* live readout — the clock and what the meter is doing right now */}
      <div className="text-caption flex items-baseline justify-between font-mono text-muted-foreground">
        <span>my-app · one day</span>
        <span aria-live="off">
          <span className="text-foreground tabular-nums">{done ? "24:00" : `${hh}:${mm}`}</span>
          <span className="mx-2 text-muted-foreground/40">·</span>
          <span className={kind === "sleep" ? "text-primary" : ""}>
            {done ? `${METERED} h metered of 24` : DAY_STATUS[kind]}
          </span>
        </span>
      </div>

      <svg viewBox="0 0 560 196" className="mt-4 w-full" aria-hidden="true">
        <defs>
          <clipPath id="pb-day-track">
            <rect x={CX0} y={TRACK_Y} width={CX1 - CX0} height={TRACK_H} rx={TRACK_H / 2} />
          </clipPath>
        </defs>

        {/* ---- the day, as machine state ---- */}
        <g clipPath="url(#pb-day-track)">
          <rect x={CX0} y={TRACK_Y} width={CX1 - CX0} height={TRACK_H} fill="var(--border)" opacity="0.55" />
          {DAY.filter((s) => s.kind !== "sleep").map((s) => (
            <rect
              key={s.from}
              x={x(s.from)}
              y={TRACK_Y}
              width={x(s.to) - x(s.from)}
              height={TRACK_H}
              fill="var(--primary)"
              opacity={0.9}
            />
          ))}
        </g>

        {/* hour ticks */}
        {[0, 6, 12, 18, 24].map((h) => (
          <text
            key={h}
            x={x(h)}
            y={TRACK_Y + TRACK_H + 18}
            textAnchor={h === 0 ? "start" : h === 24 ? "end" : "middle"}
            fontSize="10"
            fontFamily="var(--font-mono)"
            fill="var(--muted-foreground)"
            opacity="0.7"
          >
            {String(h).padStart(2, "0")}:00
          </text>
        ))}

        {/* First deliberate stop, where spend goes flat. */}
        <g opacity={t >= firstStop ? 1 : 0.25} style={{ transition: "opacity 0.4s" }}>
          <line
            x1={x(firstStop)}
            y1={TRACK_Y + TRACK_H + 26}
            x2={x(firstStop)}
            y2={CHART_BASE}
            stroke="var(--muted-foreground)"
            strokeWidth="1"
            strokeDasharray="2 4"
            opacity="0.5"
          />
          <text
            x={x(firstStop) + 6}
            y={TRACK_Y + TRACK_H + 38}
            fontSize="10"
            fontFamily="var(--font-mono)"
            fill="var(--muted-foreground)"
          >
            stopped
          </text>
        </g>

        {/* ---- cumulative spend ---- */}
        <line x1={CX0} y1={CHART_BASE} x2={CX1} y2={CHART_BASE} stroke="var(--border)" strokeWidth="1" />
        <path d={spendPath(24)} fill="none" stroke="var(--border)" strokeWidth="1.5" />
        <path
          d={spendPath(t)}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* playhead */}
        {!done && (
          <line
            x1={x(t)}
            y1={TRACK_Y - 6}
            x2={x(t)}
            y2={CHART_BASE}
            stroke="var(--foreground)"
            strokeWidth="1"
            opacity="0.25"
          />
        )}
        <circle cx={x(Math.min(t, 24))} cy={y(spendAt(t))} r="3.5" fill="var(--primary)" />

        {/* axis label */}
        <text
          x={CX0}
          y={CHART_TOP - 8}
          fontSize="10"
          fontFamily="var(--font-mono)"
          fill="var(--muted-foreground)"
          opacity="0.7"
        >
          cumulative spend
        </text>
      </svg>

      {/* legend — the three states, told straight */}
      <div className="text-caption mt-3 flex flex-wrap gap-x-6 gap-y-1.5 font-mono text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="h-2 w-4 rounded-full bg-primary/90" /> working · meters
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-4 rounded-full bg-border" /> asleep · free
        </span>
      </div>
    </div>
  );
}

// --------------------------------------------------------------- config sync

const SYNC_STEPS = [
  { label: "machine stopping", detail: "config diffed automatically", ms: 2400 },
  { label: "pushed to your config repo", detail: "dotfiles · agent settings · private", ms: 2600 },
  { label: "new machine starting", detail: "latest config cloned on boot", ms: 2400 },
  { label: "everything where you left it", detail: "no setup, no agent involved", ms: 2800 },
] as const;

function ConfigSyncIllustration() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!inView || reduce) return;
    const t = setTimeout(() => setStep((v) => (v + 1) % SYNC_STEPS.length), SYNC_STEPS[step].ms);
    return () => clearTimeout(t);
  }, [inView, reduce, step]);

  const shown = reduce ? SYNC_STEPS.length - 1 : step;

  return (
    <div ref={ref}>
      <ol className="flex flex-col gap-0">
          {SYNC_STEPS.map((s, k) => {
            const state = k < shown ? "done" : k === shown ? "active" : "pending";
            return (
              <li key={s.label} className="flex gap-4">
                {/* rail */}
                <div className="flex flex-col items-center">
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-300 ${
                      state === "done"
                        ? "border-primary bg-primary text-primary-foreground"
                        : state === "active"
                          ? "border-primary bg-background text-primary"
                          : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    {state === "done" ? (
                      <HugeiconsIcon icon={Tick02Icon} className="size-3.5" />
                    ) : (
                      <span className={`size-1.5 rounded-full ${state === "active" ? "animate-pulse bg-primary" : "bg-border"}`} />
                    )}
                  </span>
                  {k < SYNC_STEPS.length - 1 ? (
                    <span
                      className={`w-px grow transition-colors duration-500 ${k < shown ? "bg-primary/50" : "bg-border"}`}
                    />
                  ) : null}
                </div>
                <div className="pb-6">
                  <p
                    className={`text-body-sm font-medium transition-colors duration-300 ${
                      state === "pending" ? "text-muted-foreground" : "text-foreground"
                    }`}
                  >
                    {s.label}
                  </p>
                  <p className="text-body-sm mt-0.5 text-muted-foreground">{s.detail}</p>
                </div>
              </li>
            );
          })}
        </ol>

      {/* the artifact this actually produces: a commit in the user's own repo */}
      <div className="flex min-w-0 flex-col gap-1 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <span className="truncate font-mono text-sm text-muted-foreground">
          <span className="text-primary">3af912c</span> sync: dotfiles, agent settings
        </span>
        <span className="shrink-0 font-mono text-sm text-muted-foreground">you/config · private</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ sections

function Split({
  id,
  title,
  body,
  points,
  flip,
  children,
}: {
  id: string;
  title: string;
  body: string;
  points: string[];
  flip?: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      id={id}
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={viewportOnce}
      className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
    >
      <motion.div variants={item} className={flip ? "min-w-0 lg:order-2" : "min-w-0"}>
        <h2 className="text-h2 max-w-xl text-balance text-foreground">{title}</h2>
        <p className="text-lead mt-4 max-w-xl text-pretty text-muted-foreground">{body}</p>
        <ul className="mt-8 flex flex-col gap-3">
          {points.map((pt) => (
            <li key={pt} className="text-body-sm flex items-start gap-3 text-foreground/80">
              <HugeiconsIcon icon={Tick02Icon} className="mt-0.5 size-4 shrink-0 text-primary" />
              {pt}
            </li>
          ))}
        </ul>
      </motion.div>
      <motion.div variants={item} className={flip ? "min-w-0 lg:order-1" : "min-w-0"}>
        {children}
      </motion.div>
    </motion.div>
  );
}

export function FeatureSplits() {
  return (
    <section className="border-t border-border bg-background px-6 py-[clamp(4rem,7vw,8rem)] lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-[clamp(4rem,7vw,8rem)]">
        <Split
          id="lifecycle"
          title="Pay for runtime, not uptime"
          body="You control when each machine runs. Credits meter only while a machine is running, and its project volume persists while stopped."
          points={[
            "Explicit stop and resume from the dashboard or CLI",
            "Persistent code, git state, and build caches",
            "Run several projects in parallel; stopped ones cost nothing",
          ]}
        >
          <LifecycleIllustration />
        </Split>

        <Split
          id="config-sync"
          title="Machines are disposable. Your setup isn't."
          body="Before a machine is torn down, Paperboat diffs your tracked config and pushes it to a private GitHub repo it manages for you. Every new machine boots with your dotfiles, agent settings, and tools already in place."
          points={[
            "Fully automated, no agent involvement, no manual step",
            "Your config, in your GitHub account, as a normal repo",
            "Project code lives on its own persistent volume, untouched",
          ]}
          flip
        >
          <ConfigSyncIllustration />
        </Split>
      </div>
    </section>
  );
}
