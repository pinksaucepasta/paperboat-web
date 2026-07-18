"use client";

import { StatusBadge } from "./status-badge";
import { configSyncBadge } from "./config-sync-state";
import { useConfigSyncStatus } from "@/lib/api/config-sync";
import type { ConfigSyncState } from "@/lib/api/types";

export function ConfigSyncIndicator({ projectId }: { projectId: string }) {
  const { data } = useConfigSyncStatus();
  if (!data) return null;
  const machine = data.projects.find((item) => item.project_id === projectId);
  if (!machine) return null;
  return <ConfigSyncIndicatorView state={machine.state} />;
}

export function ConfigSyncIndicatorView({ state }: { state: ConfigSyncState }) {
  const badge = configSyncBadge(state);
  return (
    <span className="flex items-center gap-2 text-xs text-muted-foreground">
      Config
      <StatusBadge status={badge.status} label={badge.label} />
    </span>
  );
}
