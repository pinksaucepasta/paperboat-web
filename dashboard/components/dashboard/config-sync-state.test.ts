import { describe, expect, it } from "vitest";

import { configSyncBadge, formatBytes, formatTimestamp } from "./config-sync-state";
import { configSyncNeedsPolling, configSyncPollInterval } from "@/lib/api/config-sync";
import type { ConfigSyncStatus } from "@/lib/api/types";

describe("config sync presentation", () => {
  it.each([
    ["healthy", "Healthy"], ["syncing", "Syncing"], ["warning", "Warning"],
    ["conflict", "Conflict"], ["error", "Error"], ["offline", "Offline"], ["idle", "Idle"],
  ] as const)("maps %s to an accessible label", (state, label) => {
    expect(configSyncBadge(state).label).toBe(label);
  });

  it("formats configured limits and absent timestamps", () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatTimestamp()).toBe("Never");
  });

  it("polls transitional or active status but stops for inactive terminal results", () => {
    const status = baseStatus();
    expect(configSyncNeedsPolling(status)).toBe(false);
    for (const state of ["warning", "conflict", "error", "offline"] as const) {
      expect(configSyncNeedsPolling({ ...status, state })).toBe(false);
    }
    expect(configSyncNeedsPolling({ ...status, state: "syncing" })).toBe(false);
    expect(configSyncNeedsPolling({ ...status, projects: [{ ...status.projects[0], state: "syncing" }] })).toBe(true);
    expect(configSyncNeedsPolling({ ...status, projects: [{ ...status.projects[0], project_state: "running" }] })).toBe(true);
    expect(configSyncPollInterval(status)).toBeNull();
    expect(configSyncPollInterval({ ...status, projects: [{ ...status.projects[0], state: "syncing" }] })).toBe(10_000);
    expect(configSyncPollInterval(undefined)).toBeNull();
  });
});

function baseStatus(): ConfigSyncStatus {
  return {
    repository: { owner: "paperboat", name: "config", branch: "main", web_url: "https://example.test/config" },
    policy: { revision: "1", max_file_bytes: 5, max_batch_bytes: 25, format: "paperboat-chezmoi-age-v1", mandatory_exclusions: [".ssh"] },
    state: "idle",
    projects: [{ project_id: "p1", project_name: "Project", project_state: "stopped", machine_id: "m1", state: "idle", pending_path_count: 0, skipped: [], conflicts: [], max_file_bytes: 5, max_batch_bytes: 25, policy_revision: "1" }],
  };
}
