"use client";

import { Badge, type BadgeProps } from "@/components/ui/badge";
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

/* §4: running/healthy green, deploying indigo, queued/attention amber, failed
   red, paused/stopped neutral — expressed through the semantic Badge variants
   so the operational palette stays in the tokens (§2). */
const STATUS_VARIANTS: Record<Status, BadgeProps["variant"]> = {
  running: "success",
  active: "success",
  healthy: "success",
  deploying: "info",
  queued: "warning",
  paused: "secondary",
  stopped: "secondary",
  failed: "error",
  degraded: "warning",
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
      variant={STATUS_VARIANTS[status]}
      role="status"
      aria-label={label}
      className="gap-1.5 capitalize"
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
