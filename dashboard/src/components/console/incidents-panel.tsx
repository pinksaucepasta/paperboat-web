"use client";

import { motion } from "motion/react";
import { ArrowRight, CheckCircle2, CircleDot, Search } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { item } from "@/lib/motion";
import { incidents, relativeTime, type Incident } from "@/lib/data";

const STATUS_ICON: Record<Incident["status"], React.ComponentType<{ className?: string }>> = {
  investigating: Search,
  identified: CircleDot,
  monitoring: CircleDot,
  resolved: CheckCircle2,
};

const SEVERITY_VARIANT: Record<
  Incident["severity"],
  "error" | "warning" | "secondary"
> = {
  sev1: "error",
  sev2: "warning",
  sev3: "secondary",
};

export function IncidentsPanel() {
  return (
    <motion.section
      variants={item}
      aria-labelledby="incidents-heading"
      className="flex flex-col rounded-xl border border-border bg-card p-6"
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-eyebrow text-muted-foreground">Reliability</p>
          <h2 id="incidents-heading" className="mt-2 text-h4">
            Open incidents
          </h2>
        </div>
        <Link
          href="/incidents"
          className="inline-flex shrink-0 items-center gap-1 text-caption font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          All
          <ArrowRight className="size-3" />
        </Link>
      </header>

      <ul className="mt-6 flex-1 space-y-3">
        {incidents.map((inc) => {
          const Icon = STATUS_ICON[inc.status];
          const resolved = inc.status === "resolved";
          return (
            <li key={inc.id}>
              <Link
                href="/incidents"
                className="group flex gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon
                  className={`mt-0.5 size-4 shrink-0 ${
                    resolved ? "text-success" : "text-warning"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-medium text-foreground">
                    {inc.title}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge
                      variant={SEVERITY_VARIANT[inc.severity]}
                      size="sm"
                      className="font-mono uppercase"
                    >
                      {inc.severity}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      {inc.region}
                    </span>
                    <span className="text-caption text-muted-foreground">
                      · {inc.status} · {relativeTime(inc.openedAt)}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </motion.section>
  );
}
