import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";

import { container, item, viewportOnce, EASE } from "@/components/site/motion";
import { SectionIntro } from "@/components/site/section-intro";

/**
 * Client parity is the point: the same live session reached from the web app,
 * the desktop app, your phone, and the terminal (USERSTORY.md — every client
 * attaches through the same tunnel). Shown as one stage with four surfaces
 * that all carry the same session — auto-cycling until the visitor picks one.
 *
 * The terminal surface keeps the scripted transcript (typed with rAF, skipped
 * for reduced-motion users); the app surfaces share one skeleton language so
 * they read as the same product, not four illustrations.
 */

// ------------------------------------------------------------- terminal tape

type Line = {
  text: string;
  /** ms pause before this line starts */
  delay: number;
  /** typed char-by-char (commands) vs printed at once (output) */
  typed?: boolean;
  tone?: "cmd" | "dim" | "ok" | "accent";
};

const SCRIPT: Line[] = [
  { text: "$ paperboat connect my-app", delay: 300, typed: true, tone: "cmd" },
  { text: "  environment route ready", delay: 500, tone: "dim" },
  { text: "  machine was idle, resuming…", delay: 350, tone: "dim" },
  { text: "  ✓ attached to my-app", delay: 700, tone: "ok" },
  { text: "$ claude", delay: 800, typed: true, tone: "cmd" },
  { text: "  ✻ Claude Code · ~/my-app", delay: 500, tone: "dim" },
  { text: "  › continuing: add rate limiting to the API", delay: 450, tone: "dim" },
  { text: "  ✓ 3 files changed · tests passing", delay: 1200, tone: "ok" },
  { text: "  ✓ dev server up, preview:", delay: 600, tone: "ok" },
  { text: "  https://my-app.preview.paperboat.dev", delay: 250, tone: "accent" },
];

const TYPE_MS = 34; // per character
const toneClass: Record<NonNullable<Line["tone"]>, string> = {
  cmd: "text-foreground",
  dim: "text-muted-foreground",
  ok: "text-foreground/80",
  accent: "text-primary underline underline-offset-4 decoration-primary/40",
};

/** total ms from script start until line `i` begins */
function lineStart(i: number): number {
  let t = 0;
  for (let k = 0; k <= i; k++) {
    t += SCRIPT[k].delay;
    if (k < i && SCRIPT[k].typed) t += SCRIPT[k].text.length * TYPE_MS;
  }
  return t;
}

function useTranscript(play: boolean, skip: boolean) {
  const [now, setNow] = useState(0);
  const raf = useRef(0);
  const done = now >= lineStart(SCRIPT.length - 1) + SCRIPT[SCRIPT.length - 1].text.length * TYPE_MS + 400;

  useEffect(() => {
    if (!play || skip || done) return;
    const t0 = performance.now() - now;
    const loop = (t: number) => {
      setNow(t - t0);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [play, skip, done]);

  if (skip) return { lines: SCRIPT.map((l) => l.text), cursorLine: -1 };

  const lines: string[] = [];
  let cursorLine = -1;
  for (let i = 0; i < SCRIPT.length; i++) {
    const start = lineStart(i);
    if (now < start) break;
    const l = SCRIPT[i];
    if (l.typed) {
      const chars = Math.min(l.text.length, Math.floor((now - start) / TYPE_MS));
      lines.push(l.text.slice(0, chars));
      if (chars < l.text.length) {
        cursorLine = i;
        break;
      }
    } else {
      lines.push(l.text);
    }
  }
  if (cursorLine === -1 && !done && lines.length > 0) cursorLine = lines.length - 1;
  return { lines, cursorLine };
}

function TerminalFrame({ play }: { play: boolean }) {
  const reduce = useReducedMotion();
  const { lines, cursorLine } = useTranscript(play, !!reduce);

  return (
    <div className="flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-float)]">
      <div className="flex items-center gap-2 border-b border-border bg-muted px-4 py-3">
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="text-caption ml-3 font-mono text-muted-foreground">my-app · paperboat</span>
      </div>
      <div className="flex-1 p-4 font-mono text-[13px] leading-[1.85] sm:p-5 sm:text-sm sm:leading-[1.9]" aria-label="Example terminal session">
        {SCRIPT.map((l, i) => {
          const text = lines[i];
          if (text === undefined) return null;
          return (
            <div key={i} className={toneClass[l.tone ?? "dim"]}>
              {l.tone === "accent" ? <a href="#get-started">{text}</a> : text}
              {i === cursorLine ? (
                <span aria-hidden="true" className="ml-0.5 inline-block h-[1.1em] w-[0.55em] translate-y-[0.2em] animate-pulse bg-primary/80" />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------------------- app surfaces

/** the same session transcript, in the shared skeleton language */
function TranscriptSkeleton() {
  return (
    <div className="flex h-full flex-col gap-3 p-4" aria-hidden="true">
      <div className="space-y-1.5">
        <div className="h-2 w-full rounded-sm bg-border" />
        <div className="h-2 w-4/5 rounded-sm bg-border" />
      </div>
      <div className="rounded-lg border border-border bg-muted/40 p-2.5">
        <div className="flex items-center gap-2">
          <span className="size-3 rounded bg-primary/40" />
          <span className="h-1.5 w-24 rounded-sm bg-foreground/20" />
          <span className="ml-auto h-1.5 w-8 rounded-sm bg-emerald-500/40" />
        </div>
        <div className="mt-2 space-y-1.5">
          <div className="h-1.5 w-full rounded-sm bg-border" />
          <div className="h-1.5 w-3/4 rounded-sm bg-border" />
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="h-2 w-11/12 rounded-sm bg-border" />
        <div className="h-2 w-2/3 rounded-sm bg-border" />
      </div>
      <div className="text-caption max-w-[70%] self-end rounded-2xl rounded-br-md bg-primary px-3 py-1.5 text-primary-foreground">
        ship it
      </div>
      <div className="mt-auto flex items-center gap-1.5">
        <div className="h-2 w-2/5 rounded-sm bg-border" />
        <span className="inline-block h-3 w-px animate-pulse bg-primary" />
      </div>
    </div>
  );
}

function SessionBar() {
  return (
    <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
      <span className="size-1.5 animate-pulse rounded-full bg-primary" />
      <span className="text-caption font-mono text-foreground">my-app</span>
      <span className="text-caption ml-auto font-mono text-muted-foreground">live</span>
    </div>
  );
}

function MiniSidebar() {
  return (
    <div className="hidden w-36 shrink-0 flex-col gap-1 border-r border-border bg-muted/30 p-2.5 pt-3 sm:flex" aria-hidden="true">
      {["my-app", "api-server", "docs-site"].map((s, i) => (
        <div key={s} className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${i === 0 ? "bg-primary/[0.07]" : ""}`}>
          <span className={`size-1.5 rounded-full ${i < 2 ? "bg-primary" : "bg-border"}`} />
          <span className={`text-caption font-mono ${i === 0 ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
        </div>
      ))}
    </div>
  );
}

function DesktopFrame() {
  return (
    <div className="flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-[var(--shadow-float)]">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="text-caption ml-3 font-mono text-muted-foreground">paperboat</span>
      </div>
      <div className="flex min-h-0 flex-1">
        <MiniSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <SessionBar />
          <TranscriptSkeleton />
        </div>
      </div>
    </div>
  );
}

function MobileFrame() {
  return (
    <div className="flex h-full w-56 flex-col overflow-hidden rounded-[2rem] border border-border bg-background p-2 shadow-[var(--shadow-float)]">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.4rem] bg-muted/30">
        <div className="relative">
          <span className="absolute left-1/2 top-1.5 h-1 w-9 -translate-x-1/2 rounded-full bg-border" />
          <div className="pt-2.5">
            <SessionBar />
          </div>
        </div>
        <TranscriptSkeleton />
        <div className="flex items-center gap-2 border-t border-border bg-background px-2.5 py-2.5">
          <div className="text-caption flex flex-1 items-center rounded-full border border-border bg-muted/50 px-3 py-1.5 text-muted-foreground">
            Message…
          </div>
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <svg viewBox="0 0 16 16" className="size-3" aria-hidden="true">
              <path d="M8 13 V3 M4 7 L8 3 L12 7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------- section

const CLIENTS = [
  { key: "desktop", label: "Desktop" },
  { key: "mobile", label: "Mobile" },
  { key: "terminal", label: "Terminal" },
] as const;

const CYCLE_MS = 4500;

export function TerminalDemo() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const [active, setActive] = useState<(typeof CLIENTS)[number]["key"]>("desktop");
  const [pinned, setPinned] = useState(false); // visitor chose — stop cycling

  useEffect(() => {
    if (!inView || pinned || reduce) return;
    const t = setInterval(() => {
      setActive((cur) => {
        const i = CLIENTS.findIndex((c) => c.key === cur);
        return CLIENTS[(i + 1) % CLIENTS.length].key;
      });
    }, CYCLE_MS);
    return () => clearInterval(t);
  }, [inView, pinned, reduce]);

  return (
    <section id="clients" className="border-t border-border bg-background px-6 py-[clamp(4rem,7vw,8rem)] lg:px-10">
      <div className="mx-auto w-full max-w-7xl">
        <SectionIntro
          title="One session, on every screen"
          description="Every client attaches to the same live session through the same tunnel. Start at your desk, steer from your phone, finish in the terminal."
        />

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          className="mx-auto mt-12 max-w-3xl lg:mt-14"
        >
          {/* client switcher */}
          <motion.div variants={item} className="flex justify-center gap-1" role="tablist" aria-label="Clients">
            {CLIENTS.map((c) => {
              const selected = c.key === active;
              return (
                <button
                  key={c.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => {
                    setActive(c.key);
                    setPinned(true);
                  }}
                  className={`text-body-sm rounded-full px-4 py-1.5 font-medium transition-colors duration-200 ${
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </motion.div>

          {/* the stage — fixed height so switching never reflows the page */}
          <motion.div variants={item} ref={ref} className="mt-8 flex h-[420px] items-center justify-center">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="flex h-full w-full items-center justify-center"
              >
                {active === "terminal" ? (
                  <TerminalFrame play={inView} />
                ) : active === "desktop" ? (
                  <DesktopFrame />
                ) : (
                  <MobileFrame />
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>

          <motion.p variants={item} className="text-body-sm mx-auto mt-8 max-w-lg text-center text-pretty text-muted-foreground">
            Idle machines resume when a client connects. In the terminal, paste a screenshot and the agent gets a VM path.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
