"use client";

import * as React from "react";

import { pbFetch } from "./client";
import { useApi } from "./use-api";
import type { ConfigClassificationDecision, ConfigClassificationOverride, ConfigRecoveryKey, ConfigSyncStatus } from "./types";

const TRANSITIONAL_SYNC_STATES = new Set(["restoring", "watching", "pending", "syncing"]);
const ACTIVE_PROJECT_STATES = new Set([
  "creating",
  "provisioning_storage",
  "provisioning_machine",
  "starting",
  "running",
  "stopping",
  "restarting",
]);

export function getConfigSyncStatus(): Promise<ConfigSyncStatus> {
  return pbFetch<ConfigSyncStatus>("/api/config-sync/status");
}

export function listConfigSyncOverrides(): Promise<ConfigClassificationOverride[]> { return pbFetch("/api/config-sync/overrides"); }
export function putConfigSyncOverride(path: string, decision: ConfigClassificationDecision): Promise<{path:string;decision:ConfigClassificationDecision}> { return pbFetch("/api/config-sync/overrides",{method:"PUT",body:{path,decision}}); }
export function deleteConfigSyncOverride(path: string): Promise<{deleted:boolean}> { return pbFetch("/api/config-sync/overrides",{method:"DELETE",body:{path}}); }
export function exportConfigRecoveryKey(): Promise<ConfigRecoveryKey> { return pbFetch("/api/config-sync/recovery-key/export",{method:"POST"}); }
export function rotateConfigRecoveryKey(): Promise<{recipient:string;key_version:number;state:string}> { return pbFetch("/api/config-sync/recovery-key/rotate",{method:"POST"}); }

export function useConfigSyncOverrides() { const request=React.useCallback(()=>listConfigSyncOverrides(),[]); return useApi(request); }

export function useConfigSyncStatus() {
  const request = React.useCallback(() => getConfigSyncStatus(), []);
  const state = useApi(request);
  const pollInterval = configSyncPollInterval(state.data);

  React.useEffect(() => {
    if (pollInterval === null) return;
    const interval = window.setInterval(state.refresh, pollInterval);
    return () => window.clearInterval(interval);
  }, [pollInterval, state.refresh]);

  return state;
}

export function configSyncNeedsPolling(status: ConfigSyncStatus): boolean {
  return status.projects.some(
    (project) =>
      ACTIVE_PROJECT_STATES.has(project.project_state) ||
      TRANSITIONAL_SYNC_STATES.has(project.state) ||
      (project.classifier_pending?.length ?? 0) > 0,
  );
}

export function configSyncPollInterval(status: ConfigSyncStatus | undefined): number | null {
  return status && configSyncNeedsPolling(status) ? 10_000 : null;
}
