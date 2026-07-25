import { createServer } from "node:http";

const repository = {
  id: "cfgrepo_test",
  provider: "github",
  external_ref: "repo_external_test",
  display_name: "paperboat/config-private",
  state: "active",
};

const warning = {
  revision: "config-sync-warning-v1",
  machine_name: "Personal Linux",
  repository_name: repository.display_name,
  canonical_scope: "/home/sailor",
  file_categories: ["agent settings", "developer tool settings", "shell configuration"],
  encrypted: true,
  automatic_pull_and_push: true,
  conflict_behavior:
    "Conflicting local and remote versions are both preserved and automatic writes stop until you resolve them.",
  disable_action: "Remove consent or unassign the repository to stop synchronization immediately.",
  offline_behavior:
    "Offline changes remain local; synchronization requires fresh server authorization after reconnecting.",
  recovery_consequence:
    "Keep the recovery identity offline. Losing it can make encrypted repository contents unrecoverable.",
  classifier_metadata_disclosure:
    "Normalized relative paths and bounded file metadata may be sent to the configured classifier; file contents are never sent.",
};

let staleConsentMutation = false;
let byod;
let hosted;

function reset() {
  staleConsentMutation = false;
  byod = {
    environment_id: "env_byod",
    display_name: "Personal Linux",
    profile: "byod",
    environment_state: "online",
    state: "disabled",
    pending_path_count: 0,
    classifier_pending: [],
    skipped: [],
    conflicts: [],
    recovery_actions: [],
    key_version: 1,
    sync_revision: 0,
  };
  hosted = {
    environment_id: "env_hosted",
    display_name: "Hosted development",
    profile: "hosted",
    environment_state: "running",
    state: "conflict",
    assignment_id: "cfgasn_hosted",
    assignment_version: 4,
    repository_id: repository.id,
    repository_name: repository.display_name,
    consent_state: "not_required",
    helper_id: "helper_hosted",
    helper_generation: 2,
    remote_revision: "remote_head_1",
    pending_path_count: 1,
    classifier_pending: [
      { path: ".config/new-tool/settings.json", reason: "classifier_unavailable" },
    ],
    skipped: [{ path: ".cache/oversized.bin", bytes: 6_000_000, reason: "file_too_large" }],
    conflicts: [
      { path: ".config/editor/settings.json", reason: "changed_both", revision: "conflict_1" },
    ],
    recovery_actions: ["resolve_conflict"],
    key_version: 1,
    sync_revision: 8,
  };
}

reset();

function envelope(response, status, data) {
  const body = JSON.stringify(data);
  response.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body),
    "request-id": "req_browser_test",
  });
  response.end(body);
}

function success(response, data, status = 200) {
  envelope(response, status, { data });
}

function failure(response, status, code, message) {
  envelope(response, status, { error: { code, message, request_id: "req_browser_test" } });
}

async function readJSON(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1:43001");
  const path = url.pathname;

  if (path === "/healthz") return success(response, { status: "healthy" });
  if (path === "/__test/reset" && request.method === "POST") {
    reset();
    return success(response, { reset: true });
  }
  if (path === "/__test/stale-consent" && request.method === "POST") {
    staleConsentMutation = true;
    return success(response, { stale: true });
  }
  if (path === "/v1/me") {
    return success(response, {
      id: "usr_browser_test",
      email: "sailor@example.test",
      display_name: "Sailor",
    });
  }
  if (path === "/v1/billing/entitlement") {
    return success(response, { trial_eligible: false });
  }
  if (path === "/v1/billing/plan-products") return success(response, []);
  if (path === "/v1/config-repositories" && request.method === "GET") {
    return success(response, { items: [repository] });
  }
  if (path === "/v1/config-repositories/candidates") {
    return success(response, {
      items: [
        {
          provider: "github",
          external_id: repository.external_ref,
          display_name: repository.display_name,
          default_branch: "main",
        },
      ],
    });
  }
  if (path === "/v1/config-sync/status") {
    const environments = [hosted, byod];
    return success(response, {
      policy: {
        mode: "leased_writes",
        byod_enabled: true,
        revision: "2",
        max_file_bytes: 5_242_880,
        max_batch_bytes: 26_214_400,
        format: "paperboat-chezmoi-age-v1",
        mandatory_exclusions: [".ssh/**", ".gnupg/**"],
      },
      state: environments.some((item) => item.state === "conflict") ? "conflict" : "healthy",
      environments,
    });
  }
  if (path === "/v1/config-sync/overrides") return success(response, []);
  if (
    path === "/v1/environments/env_byod/config-assignment" &&
    request.method === "PUT"
  ) {
    const body = await readJSON(request);
    if (body.expected_version !== 0 || body.repository_id !== repository.id) {
      return failure(response, 409, "assignment_conflict", "The assignment changed. Refresh and retry.");
    }
    Object.assign(byod, {
      state: "consent_required",
      assignment_id: "cfgasn_byod",
      assignment_version: 1,
      repository_id: repository.id,
      repository_name: repository.display_name,
      consent_state: "pending",
      warning_revision: warning.revision,
    });
    return success(response, {
      id: "cfgasn_byod",
      environment_id: byod.environment_id,
      repository_id: repository.id,
      consent_state: "pending",
      warning_revision: warning.revision,
      version: 1,
    });
  }
  if (path === "/v1/environments/env_byod/config-assignment/warning") {
    return success(response, warning);
  }
  if (
    path === "/v1/environments/env_byod/config-assignment/consent" &&
    request.method === "POST"
  ) {
    const body = await readJSON(request);
    if (staleConsentMutation || body.expected_version !== 1) {
      staleConsentMutation = false;
      return failure(
        response,
        409,
        "assignment_conflict",
        "The assignment changed. Refresh and review the current warning.",
      );
    }
    Object.assign(byod, {
      state: "healthy",
      consent_state: "accepted",
      assignment_version: 2,
      sync_revision: 1,
    });
    return success(response, {
      id: "cfgasn_byod",
      environment_id: byod.environment_id,
      repository_id: repository.id,
      consent_state: "accepted",
      warning_revision: warning.revision,
      version: 2,
    });
  }
  if (
    path === "/v1/config-sync/environments/env_hosted/conflict-resolutions" &&
    request.method === "POST"
  ) {
    const body = await readJSON(request);
    if (
      body.path !== hosted.conflicts[0]?.path ||
      body.conflict_revision !== "conflict_1" ||
      body.expected_remote_revision !== "remote_head_1" ||
      body.expected_assignment_version !== 4
    ) {
      return failure(response, 409, "conflict_revision_stale", "Conflict details are stale.");
    }
    hosted.conflicts = [];
    hosted.pending_path_count = 0;
    hosted.recovery_actions = [];
    hosted.state = "healthy";
    hosted.sync_revision += 1;
    return success(response, { id: "cfgres_test", action: body.action });
  }

  return failure(response, 404, "not_found", "The test endpoint was not found.");
});

server.listen(43001, "127.0.0.1");
