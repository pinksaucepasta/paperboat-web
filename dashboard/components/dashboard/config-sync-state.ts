import type { Status } from "./status-badge";
import type { ConfigSyncState } from "@/lib/api/types";

export function configSyncBadge(state: ConfigSyncState): { status: Status; label: string } {
  switch (state) {
    case "healthy": return { status: "healthy", label: "Healthy" };
    case "watching": return { status: "running", label: "Watching" };
    case "restoring": return { status: "deploying", label: "Restoring" };
    case "syncing": return { status: "deploying", label: "Syncing" };
    case "pending": return { status: "queued", label: "Pending" };
    case "warning": return { status: "degraded", label: "Warning" };
    case "conflict": return { status: "failed", label: "Conflict" };
    case "error": return { status: "failed", label: "Error" };
    case "offline": return { status: "failed", label: "Offline" };
    case "idle": return { status: "stopped", label: "Idle" };
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatTimestamp(value?: string): string {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}
