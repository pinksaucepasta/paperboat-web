import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Moon02Icon,
  SmartPhone01Icon,
  Layers01Icon,
  Link04Icon,
} from "@hugeicons/core-free-icons";

import { EASE } from "@/components/site/motion";
import { SectionIntro } from "@/components/site/section-intro";

/**
 * Use cases as a scroll-driven story: on desktop the illustrated panel pins to
 * the viewport while the scenarios scroll past it, and the panel swaps to match
 * whichever scenario is centered (the Vercel/Linear "sticky scrollytelling"
 * pattern). On mobile — where a pinned panel reads poorly — each scenario just
 * carries its own illustration inline. Every scenario is real platform behavior
 * (overnight runs, mobile access, parallel VMs, preview URLs — USERSTORY.md).
 */

// ------------------------------------------------------------- panel visuals

function OvernightViz() {
  // A night as a causal sequence: the agent works, the task finishes, the
  // machine sits idle, and once it crosses the (user-set) idle timeout it stops
  // itself — a fallback, since you can also end the session by hand. The idle
  // timeout is a per-project setting (USERSTORY: not hardcoded), shown here at
  // an example 5 min in a config-style chip.
  const rail = ["work", "idle", "sleep"] as const; // segment between each row
  const rows = [
    {
      time: "18:40",
      label: "You sign off",
      note: "the agent keeps working in the cloud",
    },
    {
      time: "02:10",
      label: "Task done",
      note: "nothing left to run, the machine falls idle",
    },
    {
      time: "+ idle",
      label: "Machine sleeps itself",
      note: "no activity from you or the agent, so it stops and metering ends",
      config: true,
      sleep: true,
    },
    {
      time: "07:15",
      label: "You're back",
      note: "reconnect and it resumes where it left off",
    },
  ];

  return (
    <div className="flex h-full flex-col justify-center gap-6 p-6 sm:p-10">
      <ol className="relative">
        {rows.map((r, i) => {
          const last = i === rows.length - 1;
          const seg = rail[i];
          return (
            <li key={r.label} className="grid grid-cols-[3.25rem_auto_1fr] gap-x-3">
              <span className="text-caption pt-0.5 text-right font-mono text-muted-foreground">{r.time}</span>

              {/* rail: dot + the segment that follows it */}
              <div className="flex flex-col items-center">
                <span
                  className={`relative mt-1 flex size-3 shrink-0 items-center justify-center rounded-full ring-2 ring-background ${
                    r.sleep ? "border border-border bg-background" : "bg-primary"
                  }`}
                >
                  {r.sleep ? (
                    <span className="size-1 rounded-full bg-muted-foreground" />
                  ) : (
                    i === 0 && <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" />
                  )}
                </span>
                {!last &&
                  (seg === "work" ? (
                    <span className="mt-1 w-0.5 flex-1 rounded-full bg-primary/70" />
                  ) : seg === "idle" ? (
                    <span className="mt-1 flex-1 border-l-2 border-dashed border-border" />
                  ) : (
                    <span className="mt-1 w-0.5 flex-1 rounded-full bg-border" />
                  ))}
              </div>

              {/* content */}
              <div className={last ? "" : "pb-6"}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  <span className="text-nav text-foreground">{r.label}</span>
                  {r.config && (
                    <span className="text-caption inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-0.5 font-mono text-muted-foreground">
                      idle timeout
                      <span className="text-foreground">5 min</span>
                      <svg viewBox="0 0 10 10" className="size-2.5 text-muted-foreground" aria-hidden="true">
                        <path d="M2 3.5 L5 6.5 L8 3.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  )}
                </div>
                <p className="text-body-sm mt-1 text-pretty text-muted-foreground">{r.note}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {/* the fallback is auto — but you can always end it yourself */}
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-border px-4 py-3">
        <span className="text-body-sm text-pretty text-muted-foreground">
          Don't want to wait for the timeout? End the session yourself.
        </span>
        <span className="text-caption ml-auto flex h-7 shrink-0 items-center rounded-md border border-border px-3 font-medium text-foreground">
          End session
        </span>
      </div>
    </div>
  );
}

// One turn in the phone transcript. The script loops; a sliding window keeps the
// newest few on screen so it reads like a live agent session you can steer.
type Turn = { type: "agentText" | "tool" | "diff" | "user" | "typing"; text?: string };

const MOBILE_SCRIPT: { turn: Turn; hold: number }[] = [
  { turn: { type: "agentText" }, hold: 1500 },
  { turn: { type: "tool" }, hold: 1200 },
  { turn: { type: "diff" }, hold: 1400 },
  { turn: { type: "user", text: "ship it" }, hold: 1500 },
  { turn: { type: "typing" }, hold: 900 },
  { turn: { type: "agentText" }, hold: 1400 },
  { turn: { type: "user", text: "now add rate limiting" }, hold: 1700 },
  { turn: { type: "tool" }, hold: 1200 },
  { turn: { type: "typing" }, hold: 900 },
  { turn: { type: "agentText" }, hold: 1400 },
];

function TurnBody({ turn }: { turn: Turn }) {
  switch (turn.type) {
    case "user":
      return <>{turn.text}</>;
    case "typing":
      return (
        <>
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.2s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.1s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50" />
        </>
      );
    case "tool":
      return (
        <>
          <div className="flex items-center gap-2">
            <span className="size-3 rounded bg-primary/40" />
            <span className="h-1.5 w-20 rounded-sm bg-foreground/20" />
            <span className="ml-auto h-1.5 w-6 rounded-sm bg-border" />
          </div>
          <div className="mt-2 space-y-1.5">
            <div className="h-1.5 w-full rounded-sm bg-border" />
            <div className="h-1.5 w-4/5 rounded-sm bg-border" />
          </div>
        </>
      );
    case "diff":
      return (
        <>
          <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-2.5 py-1.5">
            <span className="size-2.5 rounded-sm bg-border" />
            <span className="h-1.5 w-16 rounded-sm bg-foreground/15" />
          </div>
          <div className="space-y-1 p-2">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 text-center text-[9px] leading-none text-rose-500/70">−</span>
              <span className="h-1.5 w-3/5 rounded-sm bg-rose-500/25" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 text-center text-[9px] leading-none text-emerald-600/70">+</span>
              <span className="h-1.5 w-4/5 rounded-sm bg-emerald-500/25" />
            </div>
          </div>
        </>
      );
    default: // agentText
      return (
        <>
          <div className="h-1.5 w-full rounded-sm bg-border" />
          <div className="h-1.5 w-3/4 rounded-sm bg-border" />
        </>
      );
  }
}

const TURN_CLASS: Record<Turn["type"], string> = {
  agentText: "w-[85%] space-y-1.5 self-start py-0.5",
  tool: "w-[88%] self-start rounded-xl border border-border bg-background p-2.5 shadow-[var(--shadow-sm)]",
  diff: "w-[88%] self-start overflow-hidden rounded-xl border border-border shadow-[var(--shadow-sm)]",
  user: "text-caption max-w-[80%] self-end rounded-2xl rounded-br-md bg-primary px-3 py-2 leading-relaxed text-primary-foreground",
  typing: "flex items-center gap-1 self-start rounded-2xl rounded-bl-md bg-background px-3 py-2.5 shadow-[var(--shadow-sm)]",
};

function MobileViz() {
  // The agentic coding app on a phone — same language as the fleet view. The
  // transcript plays as a loop: work streams in, you send a message, it keeps
  // going; a sliding window scrolls older turns up off the top.
  const WINDOW = 5;
  const uid = useRef(WINDOW);
  const [items, setItems] = useState(() =>
    MOBILE_SCRIPT.slice(0, WINDOW).map((s, i) => ({ id: i, turn: s.turn })),
  );

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let i = WINDOW % MOBILE_SCRIPT.length;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      timer = setTimeout(() => {
        const { turn } = MOBILE_SCRIPT[i];
        setItems((prev) => {
          const next = [...prev, { id: uid.current++, turn }];
          while (next.length > WINDOW) next.shift();
          return next;
        });
        i = (i + 1) % MOBILE_SCRIPT.length;
        step();
      }, MOBILE_SCRIPT[i].hold);
    };
    step();
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex h-full items-center justify-center p-6 sm:p-10">
      {/* a phone with fixed dimensions — the frame never changes size or shape */}
      <div className="flex h-[480px] w-64 shrink-0 flex-col overflow-hidden rounded-[2.25rem] border border-border bg-background p-2.5 shadow-[var(--shadow-float)] sm:h-[540px] sm:w-72">
        <div className="flex h-full flex-col overflow-hidden rounded-[1.6rem] bg-muted/30">
          {/* session header */}
          <div className="relative flex items-center justify-between border-b border-border bg-background px-4 pb-3 pt-3.5">
            <span className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-border" />
            <span className="mt-1 flex items-center gap-2">
              <AgentMark kind="claude" className="size-3.5 text-muted-foreground" />
              <span className="text-nav text-foreground">acme-store</span>
            </span>
            <span className="text-caption mt-1 flex items-center gap-1.5 font-mono text-muted-foreground">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" /> live
            </span>
          </div>

          {/* transcript — plays as a loop, newest at the bottom */}
          <div className="flex flex-1 flex-col justify-end gap-2.5 overflow-hidden px-3 py-4" aria-hidden="true">
            <AnimatePresence initial={false}>
              {items.map(({ id, turn }) => (
                <motion.div
                  key={id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className={TURN_CLASS[turn.type]}
                >
                  <TurnBody turn={turn} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* input bar — steer from your phone */}
          <div className="flex items-center gap-2 border-t border-border bg-background px-3 py-3">
            <div className="text-caption flex flex-1 items-center rounded-full border border-border bg-muted/50 px-3.5 py-2 text-muted-foreground">
              Message acme-store…
            </div>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
                <path d="M8 13 V3 M4 7 L8 3 L12 7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Reveals `steps` transcript blocks one by one on a loop, so the session reads
 * as an agent streaming out work. Shows everything at once under reduced motion.
 */
function useStreamLoop(steps: number) {
  const [shown, setShown] = useState(steps);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(steps);
      return;
    }
    let i = 1;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setShown(i);
      const atEnd = i >= steps;
      timer = setTimeout(() => {
        i = atEnd ? 1 : i + 1;
        tick();
      }, atEnd ? 1600 : 620);
    };
    tick();
    return () => clearTimeout(timer);
  }, [steps]);
  return shown;
}

/** Stylized marks for the coding agent driving each session. */
function AgentMark({ kind, className }: { kind: "claude" | "codex" | "gemini"; className?: string }) {
  if (kind === "gemini") {
    return (
      <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
        <path d="M8 0 L9.7 6.3 L16 8 L9.7 9.7 L8 16 L6.3 9.7 L0 8 L6.3 6.3 Z" fill="currentColor" />
      </svg>
    );
  }
  if (kind === "codex") {
    return (
      <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
        <path d="M8 1 L14 4.5 V11.5 L8 15 L2 11.5 V4.5 Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        <circle cx="8" cy="8" r="1.7" fill="currentColor" />
      </svg>
    );
  }
  // claude — sunburst
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M8 1.5 V14.5 M1.5 8 H14.5 M3.4 3.4 L12.6 12.6 M12.6 3.4 L3.4 12.6" />
      </g>
    </svg>
  );
}

function ParallelViz() {
  // A zoomed top-left corner of the agentic coding app: the sidebar's session
  // list — several agents live at once (the fleet), each tagged with its coding
  // agent and elapsed runtime. The window overflows the bottom and right, so
  // only the corner is visible (list continues off-frame).
  const sessions = [
    { name: "api-server", agent: "claude" as const, running: true, dur: "1h 32m", active: true },
    { name: "my-app", agent: "codex" as const, running: true, dur: "47m" },
    { name: "ml-experiments", agent: "gemini" as const, running: true, dur: "2h 08m" },
    { name: "web-dashboard", agent: "claude" as const, running: true, dur: "18m" },
    { name: "data-pipeline", agent: "codex" as const, running: true, dur: "3h 04m" },
    { name: "auth-service", agent: "gemini" as const, running: true, dur: "52m" },
    { name: "mobile-app", agent: "claude" as const, running: true, dur: "1h 11m" },
    { name: "infra-scripts", agent: "codex" as const, running: true, dur: "26m" },
    { name: "analytics", agent: "gemini" as const, running: true, dur: "4h 20m" },
    { name: "docs-site", agent: "claude" as const, running: false, dur: "asleep" },
  ];
  const running = sessions.filter((s) => s.running).length;
  const shown = useStreamLoop(10);
  const rev = (i: number) =>
    `transition-all duration-500 ${i < shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1.5"}`;

  return (
    <div className="flex h-full min-h-[480px] w-full overflow-hidden rounded-xl border border-border bg-background shadow-[var(--shadow-float)]">
      {/* sidebar — the fleet itself; always fully visible, at any width */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-border bg-muted/30 sm:max-w-72 sm:shrink-0 sm:border-r">
          <div className="flex items-center gap-2 px-5 py-4">
            <span className="size-3 rounded-full bg-border" />
            <span className="size-3 rounded-full bg-border" />
            <span className="size-3 rounded-full bg-border" />
          </div>

          <div className="mx-3 mt-1 flex items-center gap-3 rounded-lg px-3 py-2.5">
            <svg viewBox="0 0 16 16" className="size-4 text-muted-foreground" aria-hidden="true">
              <path d="M8 2.5 V13.5 M2.5 8 H13.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-nav text-foreground">New session</span>
          </div>

          <span className="text-eyebrow px-5 pb-2 pt-5 text-muted-foreground">Sessions · {running} live</span>
          <div className="flex flex-col gap-1 px-3">
            {sessions.map((s) => (
              <div
                key={s.name}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 ${s.active ? "bg-primary/[0.07]" : ""}`}
              >
                <span
                  className={`size-2 shrink-0 rounded-full ${s.running ? "animate-pulse bg-primary" : "bg-border"}`}
                />
                <span
                  className={`text-nav shrink-0 font-mono ${s.running ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {s.name}
                </span>
                <AgentMark
                  kind={s.agent}
                  className={`size-4 shrink-0 ${s.running ? "text-muted-foreground" : "text-muted-foreground/40"}`}
                />
                {/* leader dots to the runtime at the end */}
                <span className="h-0 flex-1 border-t border-dotted border-border" />
                <span
                  className={`text-caption shrink-0 font-mono tabular-nums ${
                    s.running ? "text-muted-foreground" : "text-muted-foreground/50"
                  }`}
                >
                  {s.dur}
                </span>
              </div>
            ))}
          </div>
        </div>

      {/* main pane — the focused session streaming out work; hidden when narrow */}
      <div className="hidden min-w-0 flex-1 flex-col gap-4 overflow-hidden p-6 sm:flex" aria-hidden="true">
          {/* header */}
          <div className="flex items-center gap-2.5 border-b border-border pb-3">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" />
            <span className="h-2.5 w-24 rounded-sm bg-foreground/15" />
            <span className="ml-auto h-4 w-14 rounded-full bg-primary/10" />
          </div>

          {/* assistant text blob */}
          <div className={`space-y-2 ${rev(1)}`}>
            <div className="h-2 w-full rounded-sm bg-border" />
            <div className="h-2 w-11/12 rounded-sm bg-border" />
            <div className="h-2 w-3/4 rounded-sm bg-border" />
          </div>

          {/* tool call block */}
          <div className={`rounded-lg border border-border bg-muted/40 p-3 ${rev(2)}`}>
            <div className="flex items-center gap-2">
              <span className="size-3.5 rounded bg-primary/40" />
              <span className="h-2 w-28 rounded-sm bg-foreground/20" />
              <span className="ml-auto h-2 w-10 rounded-sm bg-border" />
            </div>
            <div className="mt-2.5 space-y-1.5">
              <div className="h-2 w-full rounded-sm bg-border" />
              <div className="h-2 w-5/6 rounded-sm bg-border" />
            </div>
          </div>

          {/* diff block */}
          <div className={`overflow-hidden rounded-lg border border-border ${rev(3)}`}>
            <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
              <span className="size-3 rounded-sm bg-border" />
              <span className="h-2 w-32 rounded-sm bg-foreground/15" />
            </div>
            <div className="space-y-1 p-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 text-center text-[10px] leading-none text-rose-500/70">−</span>
                <span className="h-2 w-3/5 rounded-sm bg-rose-500/25" />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 text-center text-[10px] leading-none text-emerald-600/70">+</span>
                <span className="h-2 w-4/5 rounded-sm bg-emerald-500/25" />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 text-center text-[10px] leading-none text-emerald-600/70">+</span>
                <span className="h-2 w-2/3 rounded-sm bg-emerald-500/25" />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2" />
                <span className="h-2 w-1/2 rounded-sm bg-border" />
              </div>
            </div>
          </div>

          {/* second tool call — a terminal run */}
          <div className={`rounded-lg border border-border bg-muted/40 p-3 ${rev(4)}`}>
            <div className="flex items-center gap-2">
              <span className="size-3.5 rounded bg-primary/40" />
              <span className="h-2 w-20 rounded-sm bg-foreground/20" />
              <span className="ml-auto h-2 w-8 rounded-sm bg-emerald-500/40" />
            </div>
            <div className="mt-2.5 space-y-1.5">
              <div className="h-2 w-4/5 rounded-sm bg-border" />
              <div className="h-2 w-2/3 rounded-sm bg-border" />
            </div>
          </div>

          {/* another assistant blob */}
          <div className={`space-y-2 ${rev(5)}`}>
            <div className="h-2 w-full rounded-sm bg-border" />
            <div className="h-2 w-10/12 rounded-sm bg-border" />
          </div>

          {/* second diff */}
          <div className={`overflow-hidden rounded-lg border border-border ${rev(6)}`}>
            <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
              <span className="size-3 rounded-sm bg-border" />
              <span className="h-2 w-24 rounded-sm bg-foreground/15" />
            </div>
            <div className="space-y-1 p-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 text-center text-[10px] leading-none text-emerald-600/70">+</span>
                <span className="h-2 w-3/4 rounded-sm bg-emerald-500/25" />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 text-center text-[10px] leading-none text-rose-500/70">−</span>
                <span className="h-2 w-1/2 rounded-sm bg-rose-500/25" />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2" />
                <span className="h-2 w-2/3 rounded-sm bg-border" />
              </div>
            </div>
          </div>

          {/* third tool call */}
          <div className={`rounded-lg border border-border bg-muted/40 p-3 ${rev(7)}`}>
            <div className="flex items-center gap-2">
              <span className="size-3.5 rounded bg-primary/40" />
              <span className="h-2 w-24 rounded-sm bg-foreground/20" />
              <span className="ml-auto h-2 w-10 rounded-sm bg-border" />
            </div>
            <div className="mt-2.5 space-y-1.5">
              <div className="h-2 w-full rounded-sm bg-border" />
              <div className="h-2 w-3/4 rounded-sm bg-border" />
            </div>
          </div>

          {/* trailing assistant blob */}
          <div className={`space-y-2 ${rev(8)}`}>
            <div className="h-2 w-11/12 rounded-sm bg-border" />
            <div className="h-2 w-2/3 rounded-sm bg-border" />
          </div>

        {/* the line being generated right now — caret keeps blinking */}
        <div className={`flex items-center gap-1.5 ${rev(9)}`}>
          <span className="h-2 w-2/5 rounded-sm bg-border" />
          <span className="inline-block h-3 w-px animate-pulse bg-primary" />
        </div>
      </div>
    </div>
  );
}

/**
 * Drives the review-flow loop: a cursor clicks the page, a pin drops, a note
 * fills in, submit lands, the pin resolves — then it resets and repeats. Halts
 * on a resting frame under prefers-reduced-motion.
 */
function useReviewLoop() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase(4); // resting: note open, comment written
      return;
    }
    // phase: 0 idle · 1 aim · 2 pin · 3 note · 4 typed · 5 submit · 6 resolved
    const durations = [900, 750, 500, 600, 1000, 750, 950];
    let p = 0;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      setPhase(p);
      timer = setTimeout(() => {
        p = (p + 1) % durations.length;
        step();
      }, durations[p]);
    };
    step();
    return () => clearTimeout(timer);
  }, []);
  return phase;
}

function PreviewViz() {
  // a floating pill on any preview, a pin dropped on the page, a note popover to
  // add a comment, and a submit that hands the review back — shown as a loop.
  const phase = useReviewLoop();

  const pinShown = phase >= 2 && phase <= 6;
  const resolved = phase === 6;
  const noteOpen = phase >= 3 && phase <= 5;
  const typed = phase >= 4;
  const pressed = phase === 5;
  const cursorShown = phase >= 1 && phase <= 5;
  // The Submit click site is anchored to the note popover's geometry (left-[19%]
  // top-[38%], w-52, right-aligned button), not to the page. Percentages alone
  // drift off the fixed-width popover on narrow screens.
  const submitPos = { left: "calc(19% + 10rem)", top: "calc(38% + 6.25rem)" };
  const cursorPos = pressed ? submitPos : { left: "16%", top: "44%" };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-7 p-6 sm:p-10">
      <div className="relative w-full">
        {/* the running preview — fills the panel */}
        <div className="overflow-hidden rounded-xl border border-border bg-background shadow-[var(--shadow-float)]">
          <div className="flex items-center gap-2.5 border-b border-border bg-muted px-3.5 py-3">
            <span className="size-2.5 shrink-0 rounded-full bg-border" />
            <span className="size-2.5 shrink-0 rounded-full bg-border" />
            <span className="text-caption ml-1.5 flex min-w-0 flex-1 items-center rounded-md border border-border bg-background px-3 py-1 font-mono text-muted-foreground">
              <span className="truncate">
                <span className="text-primary">https://</span>my-app.preview.paperboat.dev
              </span>
            </span>
          </div>

          {/* skeleton page — just shapes; the review layer sits on top */}
          <div className="relative min-h-72 space-y-3.5 p-6" aria-hidden="true">
            <div className="h-3.5 w-2/5 rounded-sm bg-foreground/15" />
            <div className="h-2.5 w-4/5 rounded-sm bg-border" />
            <div className="h-2.5 w-3/5 rounded-sm bg-border" />
            <div className="mt-5 flex gap-2.5">
              <div className="h-8 w-24 rounded-md bg-primary/80" />
              <div className="h-8 w-24 rounded-md border border-border" />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="h-16 rounded-md border border-border" />
              <div className="h-16 rounded-md border border-border" />
              <div className="h-16 rounded-md border border-border" />
            </div>

            {/* the pin dropped on the page */}
            <span
              className={`absolute left-[15%] top-[41%] flex size-5 items-center justify-center rounded-full text-[10px] font-semibold text-primary-foreground shadow-[var(--shadow-float)] ring-2 ring-background transition-all duration-300 ${
                pinShown ? "scale-100 opacity-100" : "scale-0 opacity-0"
              } ${resolved ? "bg-primary/50" : "bg-primary"}`}
            >
              1
            </span>

            {/* the note popover — add a comment, then submit */}
            <div
              className={`absolute left-[19%] top-[38%] w-52 origin-top-left rounded-lg border border-border bg-background p-3 shadow-[var(--shadow-float)] transition-all duration-300 ${
                noteOpen ? "scale-100 opacity-100" : "pointer-events-none scale-90 opacity-0"
              }`}
            >
              <div className="mb-2.5 flex items-center justify-between">
                <span className="h-2 w-14 rounded-sm bg-foreground/15" />
                <span className="size-1.5 rounded-full bg-primary" />
              </div>
              <div className="space-y-2 rounded-md border border-border bg-muted/50 p-2.5">
                <div className={`h-2 rounded-sm bg-border transition-all duration-500 ${typed ? "w-full" : "w-0"}`} />
                <div className={`h-2 rounded-sm bg-border transition-all delay-100 duration-500 ${typed ? "w-3/5" : "w-0"}`} />
              </div>
              <div className="mt-2.5 flex justify-end">
                <span
                  className={`text-caption flex h-7 items-center rounded-md bg-primary px-3 font-medium text-primary-foreground transition-transform duration-150 ${
                    pressed ? "scale-90" : "scale-100"
                  }`}
                >
                  Submit
                </span>
              </div>
            </div>

            {/* click ripples — fixed at each click site so they never travel */}
            <span
              className={`absolute left-[16%] top-[44%] z-10 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary ${
                phase === 2 ? "scale-100 opacity-60 transition-all duration-500" : "scale-0 opacity-0"
              }`}
              aria-hidden="true"
            />
            <span
              className={`absolute z-10 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary ${
                pressed ? "scale-100 opacity-60 transition-all duration-500" : "scale-0 opacity-0"
              }`}
              style={submitPos}
              aria-hidden="true"
            />

            {/* the cursor driving it all */}
            <svg
              viewBox="0 0 12 12"
              className={`absolute z-10 size-4 text-foreground drop-shadow transition-all duration-[650ms] ease-in-out ${
                cursorShown ? "opacity-100" : "opacity-0"
              } ${pressed ? "scale-90" : "scale-100"}`}
              style={cursorPos}
              aria-hidden="true"
            >
              <path d="M1 1 L1 10 L3.5 7.5 L5.5 11 L7 10 L5 6.7 L8.5 6.5 Z" fill="currentColor" stroke="var(--background)" strokeWidth="0.6" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* the review pill — compact, tucked in the corner */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full border border-border bg-background/95 px-1.5 py-1 shadow-[var(--shadow-float)] backdrop-blur">
          <span className="flex size-5 items-center justify-center rounded-full bg-primary">
            <span className="size-2 rounded-[2px] bg-primary-foreground" />
          </span>
          <span className="flex size-5 items-center justify-center rounded-full">
            <span className="size-2 rounded-full border border-muted-foreground/40" />
          </span>
          <span className="mx-0.5 h-3.5 w-px bg-border" />
          <span
            className={`text-caption flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-mono transition-colors duration-300 ${
              noteOpen ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {resolved ? 2 : 1}
          </span>
        </div>
      </div>

      <p className="text-body-sm max-w-md text-center text-muted-foreground">
        Every preview has a review layer. Anyone with the link can comment on the running app, and the agent gets the notes back.
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ the data

const CASES = [
  {
    icon: Moon02Icon,
    title: "Let it run overnight",
    body: "Hand an agent a long task and close the laptop. It keeps working in the cloud; the machine stops itself when the work is done.",
    viz: <OvernightViz />,
  },
  {
    icon: SmartPhone01Icon,
    title: "Steer from your phone",
    body: "Check on a run from the couch, the train, another country. Review, redirect, and approve from the full session on your phone.",
    viz: <MobileViz />,
  },
  {
    icon: Layers01Icon,
    title: "Run a fleet in parallel",
    body: "Every project gets its own machine, so agents never trip over each other. Run three refactors at once; sleeping projects cost nothing.",
    viz: <ParallelViz />,
  },
  {
    icon: Link04Icon,
    title: "Share work in one link",
    body: "When an agent stands up a dev server, it hands back a preview URL you can open on any device or send to anyone.",
    viz: <PreviewViz />,
  },
];

export function UseCases() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    // Whichever scenario sits closest to the vertical center of the viewport is
    // the active one. Computed straight from scroll position (rAF-throttled) so
    // the panel tracks deterministically instead of relying on observer timing.
    let raf = 0;
    const update = () => {
      raf = 0;
      const center = window.innerHeight / 2;
      let best = 0;
      let bestDist = Infinity;
      refs.current.forEach((el, i) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        const dist = Math.abs((r.top + r.bottom) / 2 - center);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      });
      setActive(best);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section id="use-cases" className="border-t border-border bg-background px-6 py-[clamp(4rem,7vw,8rem)] lg:px-10">
      <div className="mx-auto w-full max-w-7xl">
        <SectionIntro
          title="Built for how agents get used"
          description="Long runs, odd hours, many projects at once. Work that doesn't fit a laptop with the lid closed."
        />

        <div className="mt-12 grid gap-10 lg:mt-16 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16">
          {/* narrative — scrolls past the pinned panel. min-w-0 so wide inline
              content (e.g. the preview URL) can't stretch the implicit track */}
          <div className="min-w-0">
            {CASES.map((c, i) => {
              const selected = i === active;
              return (
                <div
                  key={c.title}
                  data-index={i}
                  ref={(el) => {
                    refs.current[i] = el;
                  }}
                  className="border-b border-border py-9 last:border-b-0 lg:flex lg:min-h-[70vh] lg:items-center lg:border-none lg:py-0"
                >
                  <div
                    className={`transition-opacity duration-500 ${
                      selected ? "lg:opacity-100" : "lg:opacity-30"
                    }`}
                  >
                    <span
                      className={`flex items-center gap-2.5 ${
                        selected ? "text-primary" : "text-primary lg:text-muted-foreground"
                      }`}
                    >
                      <HugeiconsIcon icon={c.icon} className="size-4 shrink-0" />
                      <span className="text-nav">{c.title}</span>
                    </span>
                    <p className="text-body mt-3 max-w-md text-pretty text-muted-foreground">{c.body}</p>

                    {/* inline illustration — mobile only */}
                    <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-muted/40 lg:hidden">
                      {c.viz}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* pinned panel — desktop only */}
          <div className="hidden lg:block">
            <div className="sticky top-28 h-[70vh] overflow-hidden rounded-2xl border border-border bg-muted/40">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={active}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="h-full"
                >
                  {CASES[active].viz}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
