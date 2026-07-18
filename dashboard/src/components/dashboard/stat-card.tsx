import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  delta,
  trend = "up",
  icon,
}: {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down" | "flat";
  icon: IconSvgElement;
}) {
  const trendColor =
    trend === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : trend === "down"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </span>
          <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <HugeiconsIcon icon={icon} className="size-4" />
          </span>
        </div>
        <div className="flex items-end justify-between gap-2">
          <span className="font-heading text-3xl font-semibold tracking-tight tabular-nums">
            {value}
          </span>
          {delta ? (
            <span className={cn("flex items-center gap-0.5 text-xs font-medium", trendColor)}>
              <HugeiconsIcon
                icon={trend === "flat" ? ArrowRight01Icon : ArrowUpRight01Icon}
                className={cn("size-3.5", trend === "down" && "rotate-90")}
              />
              {delta}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
