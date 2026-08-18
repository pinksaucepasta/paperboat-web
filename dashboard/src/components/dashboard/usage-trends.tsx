"use client";

import * as React from "react";

import { AreaChart } from "@/components/dither-kit/area-chart";
import { Area } from "@/components/dither-kit/area";
import { Grid } from "@/components/dither-kit/grid";
import { XAxis } from "@/components/dither-kit/x-axis";
import { YAxis } from "@/components/dither-kit/y-axis";
import { Tooltip } from "@/components/dither-kit/tooltip";
import { BlockLegend } from "@/components/dither-kit/block-legend";
import type { ChartConfig } from "@/components/dither-kit/chart-context";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";

const RANGES = ["24h", "7d", "30d"] as const;
type Range = (typeof RANGES)[number];

type Row = { label: string; credits: number; storage: number };

/** Dither palette steps nearest Paperboat royal indigo. */
const config: ChartConfig = {
  credits: { label: "Credits used", color: "purple" },
  storage: { label: "Storage (GB)", color: "blue" },
};

/**
 * Sample series — the control plane currently exposes only point-in-time usage
 * (`/api/billing/usage`, `/api/dashboard/usage-summary`), not a metering
 * history. Once paperboat-server ships a usage-history endpoint, swap `rowsFor`
 * for that series; the chart is otherwise wired and ready.
 */
const CREDITS_30D = [
  6, 5, 8, 7, 9, 12, 10, 8, 11, 14, 13, 9, 7, 10, 12, 15, 13, 11, 9, 8, 12, 16,
  14, 12, 10, 13, 15, 12, 9, 11,
];
const STORAGE_30D = [
  10, 10, 11, 11, 12, 12, 12, 13, 14, 14, 15, 15, 16, 16, 17, 18, 18, 19, 19,
  20, 21, 22, 22, 23, 24, 24, 25, 26, 27, 28,
];

function dayLabels(n: number) {
  const end = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(end);
    d.setDate(end.getDate() - (n - 1 - i));
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });
}

function rowsFor(points: number): Row[] {
  const credits = CREDITS_30D.slice(-points);
  const storage = STORAGE_30D.slice(-points);
  const labels = dayLabels(points);
  return labels.map((label, i) => ({
    label,
    credits: credits[i] ?? 0,
    storage: storage[i] ?? 0,
  }));
}

export function UsageTrends() {
  const [range, setRange] = React.useState<Range>("30d");
  const points = range === "24h" ? 8 : range === "7d" ? 7 : 30;
  const rows = React.useMemo(() => rowsFor(points), [points]);

  return (
    <section
      aria-labelledby="usage-trends-heading"
      className="rounded-xl border border-border bg-card p-6 shadow-raised lg:p-8"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-eyebrow text-primary">Observability</p>
            <Badge variant="secondary" className="font-mono text-[0.625rem]">
              Sample data
            </Badge>
          </div>
          <h2 id="usage-trends-heading" className="mt-2 text-h4">
            Credits &amp; storage trend
          </h2>
          <p className="mt-2 max-w-xl text-body-sm text-muted-foreground">
            Daily credit consumption against allocated storage. Live history
            lands when the control plane exposes a metering series.
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

      <div className="mt-4 h-64 w-full">
        <AreaChart
          data={rows}
          config={config}
          margins={{ top: 12, right: 8, bottom: 26, left: 36 }}
        >
          <Grid />
          <YAxis tickFormatter={(v) => `${v}`} />
          <XAxis dataKey="label" maxTicks={6} />
          <Area dataKey="credits" variant="gradient" isClickable />
          <Area dataKey="storage" variant="hatched" isClickable />
          <Tooltip
            labelKey="label"
            valueFormatter={(v, name) =>
              name === "storage" ? `${v} GB` : `${v} credits`
            }
          />
        </AreaChart>
      </div>
    </section>
  );
}
