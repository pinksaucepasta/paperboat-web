"use client";

import * as React from "react";

import { pbFetch } from "./client";
import { useApi } from "./use-api";
import type {
  ConfigAssignment,
  ConfigClassificationDecision,
  ConfigClassificationOverride,
  ConfigRecoveryKey,
  ConfigRepository,
  ConfigSyncStatus,
  ConfigWarningFacts,
} from "./types";

const TRANSITIONAL_SYNC_STATES = new Set(["restoring", "watching", "pending", "syncing"]);
export function getConfigSyncStatus(): Promise<ConfigSyncStatus> {
  return pbFetch<ConfigSyncStatus>("/v1/config-sync/status");
}

export interface ConfigRepositoryCandidate {
  provider: "github";
  external_id: string;
  display_name: string;
  default_branch: string;
}

export function listConfigRepositories(): Promise<{ items: ConfigRepository[] }> {
  return pbFetch("/v1/config-repositories");
}

export function listConfigRepositoryCandidates(): Promise<{ items: ConfigRepositoryCandidate[] }> {
  return pbFetch("/v1/config-repositories/candidates");
}

export function connectConfigRepository(candidate: ConfigRepositoryCandidate): Promise<ConfigRepository> {
  return pbFetch("/v1/config-repositories", {
    method: "POST",
    body: { provider: candidate.provider, external_ref: candidate.external_id, display_name: candidate.display_name },
  });
}

export function disconnectConfigRepository(repositoryId: string): Promise<void> {
  return pbFetch(`/v1/config-repositories/${encodeURIComponent(repositoryId)}`, { method: "DELETE" });
}

export function assignConfigRepository(environmentId: string, repositoryId: string, expectedVersion: number): Promise<ConfigAssignment> {
  return pbFetch(`/v1/environments/${encodeURIComponent(environmentId)}/config-assignment`, {
    method: "PUT",
    body: { repository_id: repositoryId, warning_revision: "", expected_version: expectedVersion },
  });
}

export function unassignConfigRepository(environmentId: string, expectedVersion: number): Promise<void> {
  return pbFetch(`/v1/environments/${encodeURIComponent(environmentId)}/config-assignment?expected_version=${expectedVersion}`, { method: "DELETE" });
}

export function getConfigWarning(environmentId: string): Promise<ConfigWarningFacts> {
  return pbFetch(`/v1/environments/${encodeURIComponent(environmentId)}/config-assignment/warning`);
}

export function acceptConfigConsent(environmentId: string, revision: string, expectedVersion: number): Promise<ConfigAssignment> {
  return pbFetch(`/v1/environments/${encodeURIComponent(environmentId)}/config-assignment/consent`, {
    method: "POST", body: { warning_revision: revision, expected_version: expectedVersion },
  });
}

export function removeConfigConsent(environmentId: string, expectedVersion: number): Promise<ConfigAssignment> {
  return pbFetch(`/v1/environments/${encodeURIComponent(environmentId)}/config-assignment/consent?expected_version=${expectedVersion}`, { method: "DELETE" });
}

export type ConfigConflictResolutionAction = "keep_local" | "keep_remote" | "externally_resolved";

export function resolveConfigConflict(
  environmentId: string,
  input: {
    path: string;
    conflict_revision: string;
    expected_remote_revision: string;
    expected_assignment_version: number;
    action: ConfigConflictResolutionAction;
  },
): Promise<{ id: string; action: ConfigConflictResolutionAction }> {
  return pbFetch(`/v1/config-sync/environments/${encodeURIComponent(environmentId)}/conflict-resolutions`, {
    method: "POST",
    body: input,
  });
}

export function listConfigSyncOverrides(): Promise<ConfigClassificationOverride[]> { return pbFetch("/v1/config-sync/overrides"); }
export function putConfigSyncOverride(path: string, decision: ConfigClassificationDecision): Promise<{path:string;decision:ConfigClassificationDecision}> { return pbFetch("/v1/config-sync/overrides",{method:"PUT",body:{path,decision}}); }
export function deleteConfigSyncOverride(path: string): Promise<{deleted:boolean}> { return pbFetch("/v1/config-sync/overrides",{method:"DELETE",body:{path}}); }
export function exportConfigRecoveryKey(): Promise<ConfigRecoveryKey> { return pbFetch("/v1/config-sync/recovery-key/export",{method:"POST"}); }
export function rotateConfigRecoveryKey(): Promise<{recipient:string;key_version:number;state:string}> { return pbFetch("/v1/config-sync/recovery-key/rotate",{method:"POST"}); }

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
  return status.environments.some(
    (environment) =>
      TRANSITIONAL_SYNC_STATES.has(environment.state) ||
      environment.classifier_pending.length > 0,
  );
}

export function configSyncPollInterval(status: ConfigSyncStatus | undefined): number | null {
  return status && configSyncNeedsPolling(status) ? 10_000 : null;
}
