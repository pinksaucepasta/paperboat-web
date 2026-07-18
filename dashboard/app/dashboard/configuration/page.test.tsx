import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ useConfigSyncStatus: vi.fn(), useConfigSyncOverrides: vi.fn(() => ({ data: [], error: undefined, loading: false, refresh: vi.fn() })) }));

vi.mock("@/lib/api/config-sync", () => ({
  useConfigSyncStatus: api.useConfigSyncStatus,
  useConfigSyncOverrides: api.useConfigSyncOverrides,
  putConfigSyncOverride: vi.fn(),
  deleteConfigSyncOverride: vi.fn(),
  exportConfigRecoveryKey: vi.fn(),
  rotateConfigRecoveryKey: vi.fn(),
}));

import {
  default as ConfigurationPage,
  ConfigurationError,
  ConfigurationLoading,
  ConfigurationStatusView,
} from "./page";
import { ConfigSyncIndicatorView } from "@/components/dashboard/config-sync-indicator";
import type {
  ConfigSyncMachineStatus,
  ConfigSyncState,
  ConfigSyncStatus,
} from "@/lib/api/types";

const states: ConfigSyncState[] = [
  "restoring",
  "watching",
  "pending",
  "syncing",
  "healthy",
  "warning",
  "conflict",
  "error",
  "offline",
  "idle",
];

describe("configuration status surface", () => {
  it("renders a semantic loading and actionable error state", () => {
    const loading = renderToStaticMarkup(<ConfigurationLoading />);
    expect(loading).toContain('aria-busy="true"');
    expect(loading).toContain("Loading configuration synchronization status");

    const error = renderToStaticMarkup(
      <ConfigurationError message="Authentication expired." />,
    );
    expect(error).toContain('role="alert"');
    expect(error).toContain("Authentication expired.");
  });

  it("keeps cached status visible when a background refresh fails", () => {
    api.useConfigSyncStatus.mockReturnValue({
      data: fixtureStatus([machine("healthy", 1)]),
      error: { message: "The control plane is temporarily unavailable." },
      loading: false,
      refresh: vi.fn(),
    });

    const markup = renderToStaticMarkup(<ConfigurationPage />);
    expect(markup).toContain("Configuration status could not be refreshed");
    expect(markup).toContain("Showing the most recently received status.");
    expect(markup).toContain("Project 1");
    expect(markup).toContain("Repository sync");
    expect(markup).not.toContain("Configuration status is unavailable");
  });

  it("renders every sync state, pending work, retained issues, and repository links", () => {
    const longPath = `.config/${"deep/".repeat(20)}settings.json`;
    const status = fixtureStatus(
      states.map((state, index) =>
        machine(state, index, {
          skipped:
            state === "warning"
              ? [{ path: longPath, bytes: 7 * 1024 * 1024, reason: "max_file_bytes" }]
              : [],
          conflicts:
            state === "conflict"
              ? [{ path: ".config/tool.json", reason: "concurrent_update" }]
              : [],
          error_code: state === "error" ? "authentication_failed" : undefined,
          error_message:
            state === "error" ? "Reconnect GitHub to resume synchronization." : undefined,
        }),
      ),
    );
    const markup = renderToStaticMarkup(<ConfigurationStatusView data={status} />);

    for (const state of states) {
      const label = state[0].toUpperCase() + state.slice(1);
      expect(markup).toContain(`aria-label="${label}"`);
    }
    expect(markup).toContain("7.0 MB");
    expect(markup).toContain(longPath);
    expect(markup).toContain("concurrent update");
    expect(markup).toContain("Reconnect GitHub to resume synchronization.");
    expect(markup).toContain('href="https://github.com/paperboat/config"');
    expect(markup).toContain("Configuration synchronization status by project machine");
    expect(markup).toContain("Last successful sync");
    expect(markup).toContain("Last sync");
    expect(markup).not.toContain("Last successful push");
    expect(markup).not.toContain("Last push");
    expect(markup).not.toContain("Sync now");
  });

  it("renders empty repository and project states without inventing controls", () => {
    const status = fixtureStatus([]);
    status.repository = { owner: "", name: "", branch: "", web_url: "" };
    status.state = "idle";
    const markup = renderToStaticMarkup(<ConfigurationStatusView data={status} />);
    expect(markup).toContain("No configuration repository has been provisioned.");
    expect(markup).toContain("No project machines yet");
    expect(markup).not.toContain("Repository</");
  });

  it("renders the compact project indicator with semantic status text", () => {
    const markup = renderToStaticMarkup(<ConfigSyncIndicatorView state="offline" />);
    expect(markup).toContain("Config");
    expect(markup).toContain('aria-label="Offline"');
  });

  it("shows the last sync result while a stopped machine remains idle", () => {
    const stopped = machine("idle", 1, { last_result_state: "conflict" });
    const markup = renderToStaticMarkup(<ConfigurationStatusView data={fixtureStatus([stopped])} />);
    expect(markup).toContain("Last result: Conflict");
  });
});

function fixtureStatus(projects: ConfigSyncMachineStatus[]): ConfigSyncStatus {
  return {
    repository: {
      owner: "paperboat",
      name: "config",
      branch: "main",
      web_url: "https://github.com/paperboat/config",
    },
    policy: {
      revision: "policy-7",
      max_file_bytes: 5 * 1024 * 1024,
      max_batch_bytes: 25 * 1024 * 1024,
	  format: "paperboat-chezmoi-age-v1",
	  mandatory_exclusions: [".ssh"],
    },
    state: "conflict",
    projects,
  };
}

function machine(
  state: ConfigSyncState,
  index: number,
  overrides: Partial<ConfigSyncMachineStatus> = {},
): ConfigSyncMachineStatus {
  return {
    project_id: `project-${index}`,
    project_name: `Project ${index}`,
    project_state: state === "idle" ? "stopped" : "running",
    machine_id: `machine-${index}`,
    state,
    pending_path_count: state === "pending" ? 4 : 0,
    skipped: [],
    conflicts: [],
    max_file_bytes: 5 * 1024 * 1024,
    max_batch_bytes: 25 * 1024 * 1024,
    policy_revision: "policy-7",
    ...overrides,
  };
}
