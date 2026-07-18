"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type Status =
  | "running"
  | "active"
  | "healthy"
  | "deploying"
  | "queued"
  | "paused"
  | "stopped"
  | "failed"
  | "degraded";

const STATUS_STYLES: Record<Status, string> = {
  running: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  healthy: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  deploying: "bg-primary/10 text-primary",
  queued: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  paused: "bg-muted text-muted-foreground",
  stopped: "bg-muted text-muted-foreground",
  failed: "bg-destructive/10 text-destructive",
  degraded: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

const PULSE: Status[] = ["running", "active", "healthy", "deploying"];

export function StatusBadge({
  status,
  label = status,
}: {
  status: Status;
  label?: string;
}) {
  return (
    <Badge
      variant="secondary"
      role="status"
      aria-label={label}
      className={cn("gap-1.5 capitalize", STATUS_STYLES[status])}
    >
      <span
        className={cn(
          "size-1.5 rounded-full bg-current",
          PULSE.includes(status) && "animate-pulse motion-reduce:animate-none",
        )}
      />
      {label}
    </Badge>
  );
}
