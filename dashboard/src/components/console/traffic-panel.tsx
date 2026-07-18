"use client";

import * as React from "react";
import { motion } from "motion/react";

import { AreaChart } from "@/components/dither-kit/area-chart";
import { Area } from "@/components/dither-kit/area";
import { Grid } from "@/components/dither-kit/grid";
import { XAxis } from "@/components/dither-kit/x-axis";
import { YAxis } from "@/components/dither-kit/y-axis";
import { Tooltip } from "@/components/dither-kit/tooltip";
import { BlockLegend } from "@/components/dither-kit/block-legend";
import type { ChartConfig } from "@/components/dither-kit/chart-context";
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";
import { item } from "@/lib/motion";
import { latencySeries, requestSeries } from "@/lib/data";

const RANGES = ["24h", "7d", "30d"] as const;
type Range = (typeof RANGES)[number];

type Row = { label: string; requests: number; latency: number };

/** Config = series metadata. Colours are the dither palette steps nearest to
 *  Paperboat royal indigo: `purple` (blue-violet) for the hero series, `blue`
 *  for the secondary latency trace. */
const config: ChartConfig = {
  requests: { label: "Requests", color: "purple" },
  latency: { label: "p99 latency", color: "blue" },
};

/** Day labels ending today (2026-07-17), oldest first. */
function dayLabels(n: number) {
  const end = new Date("2026-07-17T00:00:00Z");
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - (n - 1 - i));
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  });
}

export function TrafficPanel() {
  const [range, setRange] = React.useState<Range>("30d");

  const points = range === "24h" ? 8 : range === "7d" ? 7 : 30;

  // Dither charts are row-driven (config keys → columns), not series-of-arrays.
  const rows = React.useMemo<Row[]>(() => {
    const reqs = requestSeries.slice(-points);
    const lat = latencySeries.slice(-points);
    const labels = dayLabels(points);
    return labels.map((label, i) => ({
      label,
      requests: reqs[i],
      // Latency scaled to share the axis with request volume.
      latency: Number((lat[i] / 6).toFixed(1)),
    }));
  }, [points]);

  return (
    <motion.section
      variants={item}
      aria-labelledby="traffic-heading"
      className="rounded-xl border border-border bg-card p-6 lg:p-8"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-eyebrow text-primary">Edge network</p>
          <h2 id="traffic-heading" className="mt-2 text-h3">
            Traffic &amp; latency
          </h2>
          <p className="mt-2 max-w-xl text-body-sm text-muted-foreground">
            Requests served at the edge against p99 response time. Latency is
            scaled to share the axis.
          </p>
        </div>

        <Tabs
          value={range}
          onValueChange={(v) => setRange(v as Range)}
          className="shrink-0"
        >
          <TabsList>
            {RANGES.map((r) => (
              <TabsTab key={r} value={r} className="font-mono text-xs">
                {r}
              </TabsTab>
            ))}
          </TabsList>
        </Tabs>
      </header>

      <BlockLegend config={config} className="mt-6" />

      {/* The dither root fills its container, so the height is set here. */}
      <div className="mt-4 h-64 w-full">
        <AreaChart
          data={rows}
          config={config}
          bloom="low"
          bloomOnHover
          margins={{ top: 12, right: 8, bottom: 26, left: 36 }}
        >
          <Grid />
          <YAxis tickFormatter={(v) => (v >= 1 ? `${v}` : v.toFixed(1))} />
          <XAxis dataKey="label" maxTicks={6} />
          <Area dataKey="requests" variant="gradient" isClickable />
          <Area dataKey="latency" variant="hatched" isClickable />
          <Tooltip
            labelKey="label"
            valueFormatter={(v, name) =>
              name === "latency" ? `${v}ms` : `${v}M`
            }
          />
        </AreaChart>
      </div>
    </motion.section>
  );
}
