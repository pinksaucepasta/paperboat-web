"use client";

import { useState } from "react";
import { motion, type Variants } from "motion/react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { Sparkline } from "@/components/dither-kit/sparkline";
import { Badge } from "@/components/ui/badge";
import { item } from "@/lib/motion";
import type { Kpi } from "@/lib/data";

export function StatCard({
  kpi,
  /** Scroll reveal by default; the overview passes the quicker on-mount atom. */
  variants = item,
}: {
  kpi: Kpi;
  variants?: Variants;
}) {
  const rising = kpi.deltaPct >= 0;
  // "Good" is directional: error rate falling is good, traffic falling is not.
  const isGood = rising === kpi.higherIsBetter;
  const Arrow = rising ? ArrowUpRight : ArrowDownRight;
  // Drives the dither sparkline's brightness lift + bloom on card hover.
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      variants={variants}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="group relative overflow-hidden rounded-xl border border-border bg-card p-6 transition-shadow duration-150 hover:shadow-raised"
    >
      {/* The label owns its own row: sharing one with the delta badge squeezed
          the wide mono eyebrow into an ellipsis at narrower columns. The delta
          now sits beside the number it actually qualifies. */}
      <p className="whitespace-nowrap text-eyebrow text-muted-foreground">
        {kpi.label}
      </p>

      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-metric text-foreground">{kpi.value}</span>
        {kpi.unit && (
          <span className="font-heading text-lg font-semibold text-muted-foreground">
            {kpi.unit}
          </span>
        )}
        <Badge
          variant={isGood ? "success" : "error"}
          className="ms-auto self-center gap-0.5 font-mono tabular-nums"
        >
          <Arrow aria-hidden="true" />
          {Math.abs(kpi.deltaPct).toFixed(1)}%
        </Badge>
      </div>

      <p className="mt-1 text-caption text-muted-foreground">{kpi.caption}</p>

      {/* Dither sparkline needs an explicitly sized box (it measures its parent
          via ResizeObserver). `purple` is the palette step closest to Paperboat
          royal indigo; a rising-bad metric goes `red`. */}
      <div className="mt-4 -mb-1 h-12">
        <Sparkline
          data={kpi.series}
          color={isGood ? "purple" : "red"}
          variant="gradient"
          bloom="low"
          bloomOnHover
          hovered={hovered}
        />
      </div>
    </motion.div>
  );
}
