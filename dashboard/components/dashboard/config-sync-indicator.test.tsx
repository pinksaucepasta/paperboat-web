import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ useConfigSyncStatus: vi.fn() }));

vi.mock("@/lib/api/config-sync", () => ({
  useConfigSyncStatus: api.useConfigSyncStatus,
}));

import { ConfigSyncIndicator } from "./config-sync-indicator";

describe("ConfigSyncIndicator", () => {
  it("keeps cached status visible during a background refresh", () => {
    api.useConfigSyncStatus.mockReturnValue({
      data: {
        repository: { owner: "paperboat", name: "config", branch: "main", web_url: "" },
        policy: { revision: "1", max_file_bytes: 5, max_batch_bytes: 25 },
        state: "healthy",
        projects: [
          {
            project_id: "project-1",
            project_name: "Project",
            project_state: "running",
            machine_id: "machine-1",
            state: "healthy",
            pending_path_count: 0,
            skipped: [],
            conflicts: [],
            max_file_bytes: 5,
            max_batch_bytes: 25,
            policy_revision: "1",
          },
        ],
      },
      loading: true,
      error: undefined,
      refresh: vi.fn(),
    });

    const markup = renderToStaticMarkup(<ConfigSyncIndicator projectId="project-1" />);
    expect(markup).toContain("Config");
    expect(markup).toContain('aria-label="Healthy"');
  });
});
