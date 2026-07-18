import { Badge } from "@/components/ui/badge";
import type { DeployState } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * State is carried by dot + label + variant — never color alone (§9).
 */
const STATE_META: Record<
  DeployState,
  {
    label: string;
    variant: "success" | "warning" | "error" | "secondary" | "info";
    dot: string;
    pulse?: boolean;
  }
> = {
  ready: { label: "Ready", variant: "success", dot: "bg-success" },
  building: {
    label: "Building",
    variant: "info",
    dot: "bg-info",
    pulse: true,
  },
  error: { label: "Error", variant: "error", dot: "bg-destructive" },
  queued: { label: "Queued", variant: "warning", dot: "bg-warning" },
  canceled: {
    label: "Canceled",
    variant: "secondary",
    dot: "bg-muted-foreground",
  },
};

export function DeployStateBadge({ state }: { state: DeployState }) {
  const meta = STATE_META[state];

  return (
    <Badge variant={meta.variant} className="gap-1.5 font-mono">
      <span className="relative flex size-1.5 shrink-0">
        {meta.pulse && (
          <span
            className={cn(
              "absolute inline-flex size-full animate-ping rounded-full opacity-60",
              meta.dot,
            )}
          />
        )}
        <span
          className={cn(
            "relative inline-flex size-1.5 rounded-full",
            meta.dot,
          )}
        />
      </span>
      {meta.label}
    </Badge>
  );
}
