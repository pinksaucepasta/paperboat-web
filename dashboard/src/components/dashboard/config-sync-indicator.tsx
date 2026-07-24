"use client";

import { StatusBadge } from "./status-badge";
import { configSyncBadge } from "./config-sync-state";
import { useConfigSyncStatus } from "@/lib/api/config-sync";
import type { ConfigSyncState } from "@/lib/api/types";

export function ConfigSyncIndicator({ projectId }: { projectId: string }) {
  const { data } = useConfigSyncStatus();
  if (!data) return null;
  const environment = data.environments.find((item) => item.environment_id === projectId);
  if (!environment) return null;
  return <ConfigSyncIndicatorView state={environment.state} />;
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
