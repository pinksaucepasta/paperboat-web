"use client";

import { motion } from "motion/react";

import { item } from "@/lib/motion";
import { regions } from "@/lib/data";

export function RegionsPanel() {
  const worst = Math.max(...regions.map((r) => r.p99Ms));

  return (
    <motion.section
      variants={item}
      aria-labelledby="regions-heading"
      className="rounded-xl border border-border bg-card p-6"
    >
      <header>
        <p className="text-eyebrow text-muted-foreground">By region</p>
        <h2 id="regions-heading" className="mt-2 text-h4">
          Edge latency
        </h2>
      </header>

      <ul className="mt-6 space-y-4">
        {regions.map((r) => (
          <li key={r.code}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="font-mono text-xs font-medium text-foreground">
                  {r.code}
                </span>
                <span className="truncate text-caption text-muted-foreground">
                  {r.city}
                </span>
              </span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                {r.p99Ms}ms
              </span>
            </div>
            {/* Bar length encodes p99 relative to the slowest region. */}
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500 ease-physical"
                style={{ width: `${(r.p99Ms / worst) * 100}%` }}
              />
            </div>
            <p className="mt-1.5 text-caption text-muted-foreground">
              {r.sharePct}% of traffic
            </p>
          </li>
        ))}
      </ul>
    </motion.section>
  );
}
