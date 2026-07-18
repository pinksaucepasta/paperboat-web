import { motion } from "motion/react";

import { container, item, viewportOnce } from "@/components/site/motion";
import { SectionIntro } from "@/components/site/section-intro";

/**
 * The capability index as a quiet typographic grid — one hairline-divided
 * surface, six entries, no cards and no per-cell illustrations. Every entry
 * maps to a concrete behavior in USERSTORY.md; plan-specific numbers stay off
 * the page because they're config-driven and not final. The guarantees close
 * the section as a single line of plain text, not badges.
 */

const CAPABILITIES = [
  {
    title: "Machines in the right size",
    body: "Pick a shape per project: scale up for heavy builds, down for docs. Bigger shapes meter more, and only while running.",
  },
  {
    title: "One storage pool, your split",
    body: "Your plan gives you a pool of disk; you decide how much each project gets. Delete a project and its share returns instantly.",
  },
  {
    title: "Idle on your terms",
    body: "Set how long a machine waits before stopping itself. Per project, not one global setting.",
  },
  {
    title: "Tooling preinstalled",
    body: "Pick agents and tools from the preset catalog, or drop in your own setup script. New machines come up ready to work.",
  },
  {
    title: "A volume that remembers",
    body: "Project code lives on its own persistent volume. Stop for a week, resume, and the working tree is exactly as you left it.",
  },
  {
    title: "Every client, same session",
    body: "Every client attaches to the same workspace through the same tunnel. Start on one, finish on another.",
  },
];

const PRINCIPLES = [
  "no public ports",
  "your agent credentials, never resold",
  "config repo in your GitHub account",
  "one isolated VM per project",
];

export function PlatformGrid() {
  return (
    <section id="platform" className="border-t border-border bg-muted/40 px-6 py-[clamp(4rem,7vw,8rem)] lg:px-10">
      <div className="mx-auto w-full max-w-7xl">
        <SectionIntro
          title="Everything a workspace needs, per project"
          description="Machine shape, disk, idle behavior, tooling. Each project is tuned independently from one pool of plan resources."
        />

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          className="mt-14 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:mt-16 lg:grid-cols-3"
        >
          {CAPABILITIES.map((c) => (
            <motion.div key={c.title} variants={item} className="bg-background p-6 lg:p-8">
              <h3 className="text-h4 text-foreground">{c.title}</h3>
              <p className="text-body-sm mt-2.5 text-pretty text-muted-foreground">{c.body}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* the guarantees — one quiet line, plain words */}
        <motion.p
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          className="text-body-sm mt-10 text-center leading-relaxed text-muted-foreground"
        >
          {PRINCIPLES.map((p, i) => (
            <motion.span key={p} variants={item} className="inline-block whitespace-nowrap">
              {p}
              {i < PRINCIPLES.length - 1 ? <span className="mx-3 text-muted-foreground/40">·</span> : null}
            </motion.span>
          ))}
        </motion.p>
      </div>
    </section>
  );
}
