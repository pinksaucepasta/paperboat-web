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
  mode: "pull_only",
  manifest_scope:
    "Only home-relative files and directories explicitly listed in the repository's .pbinclude manifest are managed.",
  repository_visibility:
    "Selected configuration content is stored as ordinary plaintext in the connected private Git repository.",
  history_retention:
    "Git history can retain earlier and removed versions after files are changed, un-managed, or deleted.",
  conflict_behavior:
    "Conflicting local and remote versions are both preserved and automatic writes stop until you resolve them.",
  disable_action: "Remove consent or unassign the repository to stop synchronization immediately.",
  offline_behavior:
    "Offline changes remain local; synchronization requires fresh server authorization after reconnecting.",
  access_consequence:
    "Anyone who gains repository or provider-account access may read selected configuration content and retained history.",
  force_behavior:
    "Force actions are explicit, scoped, and create recoverable repository history without rewriting Git history.",
};

let staleConsentMutation = false;
let previewsUnavailable = false;
let tunnelsUnavailable = false;
let tunnelConflict = false;
let byod;
let hosted;
let previews;
let tunnels;
let tunnelRoutes;
let tunnelConnectors;
let operations;
let enrollment;
let machines;
let environmentGlobal;
let environmentMachines;
let environmentConflict;
let environmentEchoError;
let includeClientOnlyMachine;

function environmentETag(scope, machineID, version) {
  return scope === "global"
    ? `"environment-global-${version}"`
    : `"environment-machine-${machineID}-${version}"`;
}

function createEnvironmentScope(scope, machineID, variables = []) {
  return {
    scope,
    machine_id: machineID,
    version: 1,
    variables,
    status: scope === "machine" ? "applied" : undefined,
    applied_global_version: scope === "machine" ? 1 : undefined,
    applied_machine_version: scope === "machine" ? 1 : undefined,
    applied_state: scope === "machine" ? "applied" : undefined,
    error_code: undefined,
    observed_at: "2030-01-01T03:04:05Z",
    values: new Map(),
  };
}

function environmentMetadata(scope, name) {
  return {
    scope: scope.scope,
    machine_id: scope.machine_id,
    name,
    configured: true,
    version: scope.version,
    updated_at: "2030-01-01T03:04:05Z",
  };
}

function environmentResponse(response, scope) {
  const body = {
    scope: scope.scope,
    machine_id: scope.machine_id,
    version: scope.version,
    variables: scope.variables,
    ...(scope.status ? { status: scope.status } : {}),
    ...(scope.applied_global_version === undefined ? {} : { applied_global_version: scope.applied_global_version }),
    ...(scope.applied_machine_version === undefined ? {} : { applied_machine_version: scope.applied_machine_version }),
    ...(scope.applied_state === undefined ? {} : { applied_state: scope.applied_state }),
    ...(scope.error_code === undefined ? {} : { error_code: scope.error_code }),
    ...(scope.observed_at === undefined ? {} : { observed_at: scope.observed_at }),
  };
  response.setHeader("etag", environmentETag(scope.scope, scope.machine_id, scope.version));
  response.setHeader("cache-control", "no-store, private");
  return success(response, body);
}

function markMachineScopesPending() {
  for (const machineScope of environmentMachines.values()) {
    const machine = machines.find((item) => item.id === machineScope.machine_id);
    machineScope.status = machine?.online ? "pending" : "offline";
  }
}

function environmentScopeForPath(path) {
  if (path === "/v1/environment-variables" || path.startsWith("/v1/environment-variables/")) {
    return {
      scope: environmentGlobal,
      name: path === "/v1/environment-variables"
        ? undefined
        : decodeURIComponent(path.slice("/v1/environment-variables/".length)),
    };
  }
  const match = path.match(/^\/v1\/machines\/([^/]+)\/environment-variables(?:\/(.*))?$/);
  if (!match) return undefined;
  const machineID = decodeURIComponent(match[1]);
  return {
    scope: environmentMachines.get(machineID),
    name: match[2] ? decodeURIComponent(match[2]) : undefined,
  };
}

function clientOnlyMachine() {
  const host = machines[0];
  return {
    ...host,
    id: "mch_client_only",
    environment_id: "env_client_only",
    display_name: "Client-only machine",
    setup_roles: ["interactive"],
    setup_mode: "client",
    capabilities: {
      ...host.capabilities,
      environment_injection: { configured: false, observed: false },
    },
  };
}

function reset() {
  staleConsentMutation = false;
  previewsUnavailable = false;
  tunnelsUnavailable = false;
  tunnelConflict = false;
  operations = new Map();
  environmentEchoError = false;
  includeClientOnlyMachine = false;
  machines = [{
    id: "mch_browser_test",
    environment_id: "env_browser_test",
    display_name: "Studio machine",
    platform: "linux",
    architecture: "amd64",
    workspace_root: "/home/sailor",
    state: "online",
    seat_state: "occupied",
    online: true,
    runtime_versions: {},
    setup_roles: ["interactive", "host"],
    setup_mode: "host",
    capabilities: {
      file_receive: { configured: true, observed: true },
      preview_launch: { configured: true, observed: true },
      environment_injection: { configured: true, observed: true },
      terminal_host: { configured: false, observed: false },
      codex_host: { configured: false, observed: false },
      session_host: { configured: false, observed: false },
      keep_awake: { configured: false, observed: false },
    },
    machine_kind: "personal",
    public_identity_key: "test-key",
    installation_generation: 1,
    availability: {
      schema: "paperboat.availability-policy/v1",
      desired_mode: "allow_sleep",
      desired_version: 0,
      observed_version: 0,
      update_rollbacks: 0,
    },
  }];
  environmentConflict = false;
  environmentGlobal = createEnvironmentScope("global", null, [
    {
      scope: "global",
      machine_id: null,
      name: "APP_REGION",
      configured: true,
      version: 1,
      updated_at: "2030-01-01T03:04:05Z",
    },
  ]);
  environmentGlobal.values.set("APP_REGION", "test-region");
  environmentMachines = new Map([
    [
      "mch_browser_test",
      createEnvironmentScope("machine", "mch_browser_test", [
        {
          scope: "machine",
          machine_id: "mch_browser_test",
          name: "APP_LOG_LEVEL",
          configured: true,
          version: 1,
          updated_at: "2030-01-01T03:04:05Z",
        },
      ]),
    ],
  ]);
  environmentMachines.get("mch_browser_test").values.set("APP_LOG_LEVEL", "debug");
  byod = {
    machine_id: "mch_byod",
    environment_id: "env_byod",
    display_name: "Personal Linux",
    profile: "byod",
    environment_state: "online",
    state: "disabled",
    mode: "pull_only",
    manifest_health: "empty",
    manifest_revision: "a".repeat(64),
    managed_path_count: 0,
    pending_clean_path_count: 0,
    skipped: [],
    conflicts: [],
    recovery_actions: [],
    sync_revision: 0,
  };
  hosted = {
    machine_id: "mch_hosted",
    environment_id: "env_hosted",
    display_name: "Hosted development",
    profile: "hosted",
    environment_state: "running",
    state: "conflict",
    assignment_id: "cfgasn_hosted",
    assignment_version: 4,
    mode: "bidirectional",
    repository_id: repository.id,
    repository_name: repository.display_name,
    consent_state: "not_required",
    helper_id: "helper_hosted",
    helper_generation: 2,
    remote_revision: "remote_head_1",
    manifest_health: "healthy",
    manifest_revision: "b".repeat(64),
    managed_path_count: 3,
    pending_clean_path_count: 0,
    last_applied_revision: "remote_head_1",
    last_published_revision: "remote_head_1",
    skipped: [{ path: ".cache/oversized.bin", bytes: 6_000_000, reason: "file_too_large" }],
    conflicts: [
      { path: ".config/editor/settings.json", reason: "changed_both", revision: "conflict_1" },
    ],
    recovery_actions: ["resolve_conflict"],
    sync_revision: 8,
  };
  previews = [
    {
      schema: "paperboat.preview-tunnel/v1",
      kind: "preview_lease",
      id: "prv_docs",
      account_id: "acct_browser_test",
      actor_id: "usr_browser_test",
      owner_device_id: "mch_browser_test",
      owner_session_id: "ses_browser_test",
      target: { scheme: "http", address: "127.0.0.1:3000" },
      access_mode: "public",
      persistent: false,
      endpoint: "https://docs.preview.example.test",
      lease_deadline: "2030-01-02T03:04:05Z",
      user_deadline: "2030-01-01T15:04:05Z",
      state: "ready",
      allocation_state: "ready",
      edge_state: "ready",
      origin_state: "ready",
      created_at: "2030-01-01T03:04:05Z",
      last_renewed_at: "2030-01-01T03:04:05Z",
    },
    {
      schema: "paperboat.preview-tunnel/v1",
      kind: "preview_lease",
      id: "prv_disconnected",
      account_id: "acct_browser_test",
      actor_id: "usr_browser_test",
      owner_device_id: "mch_browser_test",
      owner_session_id: "ses_reconnect",
      target: { scheme: "h2c", address: "127.0.0.1:8080" },
      access_mode: "private",
      persistent: false,
      endpoint: "https://private.preview.example.test",
      lease_deadline: "2030-01-02T03:04:05Z",
      user_deadline: null,
      state: "owner_disconnected",
      allocation_state: "ready",
      edge_state: "degraded",
      origin_state: "unknown",
      created_at: "2030-01-01T02:04:05Z",
      last_renewed_at: "2030-01-01T02:04:05Z",
    },
  ];
  tunnels = [
    {
      schema: "paperboat.preview-tunnel/v1",
      kind: "tunnel",
      id: "tun_browser_test",
      account_id: "acct_browser_test",
      name: "Docs gateway",
      desired_state: "active",
      access_mode: "public",
      generation: 4,
      etag: '"tunnel:tun_browser_test:4"',
      stable_endpoint_id: "endpoint_browser_test",
      stable_endpoint: "https://docs.tunnel.example.test",
      created_by_host_id: "host_browser_test",
      created_by_actor_id: "usr_browser_test",
      expires_at: null,
      summary_code: "ready",
      created_at: "2030-01-01T01:00:00Z",
      updated_at: "2030-01-01T03:04:05Z",
    },
  ];
  tunnelRoutes = [
    {
      schema: "paperboat.preview-tunnel/v1",
      kind: "route",
      id: "rte_docs_browser",
      tunnel_id: "tun_browser_test",
      name: "Documentation",
      protocol: "http",
      host_match: { type: "managed_exact", hostname: "docs.tunnel.example.test" },
      path_prefix: "/docs",
      origin: { scheme: "http", address: "127.0.0.1:3000", preserve_host: true },
      priority: 100,
      connect_timeout_ms: 5_000,
      idle_timeout_ms: 60_000,
      max_concurrent_streams: 128,
      desired_state: "active",
      generation: 4,
      etag: '"route:rte_docs_browser:4"',
    },
  ];
  tunnelConnectors = [
    {
      schema: "paperboat.preview-tunnel/v1",
      kind: "connector",
      id: "con_browser_test",
      tunnel_id: "tun_browser_test",
      host_id: "host_browser_test",
      credential_reference: "cred_browser_reference",
      rotation_generation: 2,
      desired_state: "active",
      software_version: "1.0.0-test",
      protocol_version: "1.0",
      last_session_id: "session_browser_test",
      last_heartbeat_at: "2030-01-01T03:04:05Z",
      operating_system: "linux",
      architecture: "amd64",
      ready_at: "2030-01-01T03:04:00Z",
      last_applied_config_generation: 4,
      drain_state: "accepting",
      generation: 3,
      etag: '"connector:con_browser_test:3"',
    },
  ];
  enrollment = undefined;
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

function previewETag(preview) {
  return `"preview_lease:${preview.id}:1"`;
}

function previewEvent(preview) {
  return {
    schema: "paperboat.preview-tunnel/v1",
    kind: "event",
    id: `evt_${preview.id}_1`,
    cursor: `cursor_${preview.id}_1`,
    event_type: "preview.ready",
    resource_kind: "preview_lease",
    resource_id: preview.id,
    occurred_at: preview.last_renewed_at,
    actor: { type: "system", id: "system" },
    correlation_id: "cor_browser_test",
    safe_metadata: { state: preview.state },
  };
}

function previewReady(preview) {
  return preview.state === "ready" &&
    preview.allocation_state === "ready" &&
    preview.edge_state === "ready" &&
    preview.origin_state === "ready";
}

function previewOperation(preview, overrides = {}) {
  return {
    schema: "paperboat.preview-tunnel/v1",
    kind: "operation",
    id: `op_${preview.id}`,
    resource_kind: "preview_lease",
    resource_id: preview.id,
    phase: "connecting",
    state: "running",
    progress: 30,
    retrying: false,
    next_retry_at: null,
    error: null,
    correlation_id: "cor_browser_test",
    created_at: preview.created_at,
    updated_at: preview.last_renewed_at,
    ...overrides,
  };
}

function tunnelHealth(tunnel) {
  const ready = tunnel.desired_state === "active";
  const status = ready ? "ready" : "not_applicable";
  const dimensions = Object.fromEntries(
    ["service", "edge", "config", "route", "origin", "dns", "certificate", "access", "update"]
      .map((name) => [name, { status, code: ready ? `${name}_ready` : `${name}_paused` }]),
  );
  return {
    schema: "paperboat.preview-tunnel/v1",
    kind: "health",
    resource_kind: "tunnel",
    resource_id: tunnel.id,
    overall_code: ready ? "ready" : "paused",
    dimensions,
    summary: ready ? "Tunnel is ready." : "Tunnel is paused.",
    since: tunnel.updated_at,
    retrying: false,
    next_retry_at: null,
    repair_action: ready ? "none" : "resume",
    correlation_id: "cor_tunnel_browser",
  };
}

function tunnelOperation(tunnel, action) {
  return {
    schema: "paperboat.preview-tunnel/v1",
    kind: "operation",
    id: `op_tunnel_${action}_browser`,
    resource_kind: "tunnel",
    resource_id: tunnel.id,
    phase: action === "delete" ? "draining" : "ready",
    state: action === "delete" ? "running" : "succeeded",
    progress: action === "delete" ? 70 : 100,
    retrying: false,
    next_retry_at: null,
    error: null,
    correlation_id: "cor_tunnel_browser",
    created_at: tunnel.updated_at,
    updated_at: tunnel.updated_at,
  };
}

function tunnelEvent(tunnel) {
  return {
    schema: "paperboat.preview-tunnel/v1",
    kind: "event",
    id: "evt_tunnel_browser",
    cursor: "cursor_tunnel_browser",
    event_type: "tunnel.ready",
    resource_kind: "tunnel",
    resource_id: tunnel.id,
    occurred_at: tunnel.updated_at,
    actor: { type: "system", id: "system" },
    correlation_id: "cor_tunnel_browser",
    safe_metadata: { operation_id: "op_tunnel_ready_browser" },
  };
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
  if (path === "/__test/offline" && request.method === "POST") {
    machines[0] = { ...machines[0], online: false, state: "offline" };
    const scope = environmentMachines?.get("mch_browser_test");
    if (scope) {
      scope.status = "offline";
      scope.applied_state = "applied";
    }
    return success(response, { offline: true });
  }
  if (path === "/__test/degraded" && request.method === "POST") {
    previews[0] = { ...previews[0], edge_state: "degraded", origin_state: "unavailable" };
    return success(response, { degraded: true });
  }
  if (path === "/__test/fail-previews" && request.method === "POST") {
    previewsUnavailable = true;
    return success(response, { unavailable: true });
  }
  if (path === "/__test/recover-previews" && request.method === "POST") {
    previewsUnavailable = false;
    return success(response, { available: true });
  }
  if (path === "/__test/empty-tunnels" && request.method === "POST") {
    tunnels = [];
    return success(response, { empty: true });
  }
  if (path === "/__test/fail-tunnels" && request.method === "POST") {
    tunnelsUnavailable = true;
    return success(response, { unavailable: true });
  }
  if (path === "/__test/recover-tunnels" && request.method === "POST") {
    tunnelsUnavailable = false;
    return success(response, { available: true });
  }
  if (path === "/__test/conflict-tunnel" && request.method === "POST") {
    tunnelConflict = true;
    return success(response, { conflict: true });
  }
  if (path === "/__test/environment-conflict" && request.method === "POST") {
    environmentConflict = true;
    return success(response, { conflict: true });
  }
  if (path === "/__test/environment-echo" && request.method === "POST") {
    environmentEchoError = true;
    return success(response, { echo: true });
  }
  if (path === "/__test/environment-client-only" && request.method === "POST") {
    includeClientOnlyMachine = true;
    return success(response, { client_only: true });
  }
  if (path === "/__test/environment-empty" && request.method === "POST") {
    environmentGlobal.variables = [];
    environmentGlobal.values.clear();
    environmentGlobal.version += 1;
    return success(response, { empty: true });
  }
  if (path === "/__test/environment-apply" && request.method === "POST") {
    for (const scope of [environmentGlobal, ...environmentMachines.values()]) {
      scope.variables = scope.variables.map((variable) => ({ ...variable, version: scope.version }));
      if (scope.scope === "machine") {
        scope.status = "applied";
        scope.applied_global_version = environmentGlobal.version;
        scope.applied_machine_version = scope.version;
        scope.applied_state = "applied";
      }
    }
    return success(response, { applied: true });
  }
  if (path === "/v1/me") {
    return success(response, {
      id: "usr_browser_test",
      email: "sailor@example.test",
      display_name: "Sailor",
    });
  }
  const environmentRequest = environmentScopeForPath(path);
  if (environmentRequest) {
    const scope = environmentRequest.scope;
    if (!scope) return failure(response, 404, "not_found", "Environment variable scope not found.");

    if (request.method === "GET" && !environmentRequest.name) {
      return environmentResponse(response, scope);
    }
    if (request.method === "GET" && environmentRequest.name) {
      const variable = scope.variables.find((item) => item.name === environmentRequest.name);
      if (!variable) return failure(response, 404, "not_found", "Environment variable not found.");
      response.setHeader("etag", environmentETag(scope.scope, scope.machine_id, scope.version));
      response.setHeader("cache-control", "no-store, private");
      return success(response, variable);
    }
    if (request.method === "PUT" && environmentRequest.name) {
      const body = await readJSON(request);
      if (typeof body.value !== "string") {
        return failure(response, 400, "validation_failed", "Environment variable values must be strings.");
      }
      if (environmentEchoError) {
        environmentEchoError = false;
        return failure(response, 400, "validation_failed", `Rejected value: ${body.value}\nThe value was not accepted.`);
      }
      if (environmentConflict || body.expected_version !== scope.version) {
        environmentConflict = false;
        return failure(response, 409, "environment_version_conflict", "The environment scope changed. Refresh and retry.");
      }
      scope.version += 1;
      scope.variables = scope.variables.map((item) => ({ ...item, version: scope.version }));
      const machine = scope.machine_id ? machines.find((item) => item.id === scope.machine_id) : undefined;
      const status = scope.scope === "machine" && !machine?.online ? "offline" : "pending";
      const variable = environmentMetadata(scope, environmentRequest.name);
      const existingIndex = scope.variables.findIndex((item) => item.name === environmentRequest.name);
      scope.variables = existingIndex === -1
        ? [...scope.variables, variable]
        : scope.variables.map((item, index) => index === existingIndex ? variable : item);
      scope.values.set(environmentRequest.name, body.value);
      if (scope.scope === "machine") {
        scope.status = status;
        scope.applied_state = "pending";
        scope.error_code = undefined;
      } else {
        markMachineScopesPending();
      }
      response.setHeader("etag", environmentETag(scope.scope, scope.machine_id, scope.version));
      response.setHeader("cache-control", "no-store, private");
      return success(response, variable, 200);
    }
    if (request.method === "DELETE" && environmentRequest.name) {
      const variable = scope.variables.find((item) => item.name === environmentRequest.name);
      if (!variable) return failure(response, 404, "not_found", "Environment variable not found.");
      const expectedETag = environmentETag(scope.scope, scope.machine_id, scope.version);
      if (request.headers["if-match"] !== expectedETag) {
        return failure(response, 412, "environment_version_conflict", "The environment scope changed. Refresh and retry.");
      }
      scope.version += 1;
      scope.variables = scope.variables.filter((item) => item.name !== environmentRequest.name);
      scope.variables = scope.variables.map((item) => ({ ...item, version: scope.version }));
      scope.values.delete(environmentRequest.name);
      if (scope.scope === "machine") {
        const machine = machines.find((item) => item.id === scope.machine_id);
        scope.status = machine?.online ? "pending" : "offline";
        scope.applied_state = "pending";
      } else {
        markMachineScopesPending();
      }
      response.writeHead(204, {
        etag: environmentETag(scope.scope, scope.machine_id, scope.version),
        "cache-control": "no-store, private",
      });
      response.end();
      return;
    }
    return failure(response, 405, "method_not_allowed", "The environment variable operation is not supported.");
  }
  if (path === "/v1/billing/entitlement") {
    return success(response, { trial_eligible: false });
  }
  if (path === "/v1/billing/plan-products") return success(response, []);
  if (path === "/v1/machines" && request.method === "GET") {
    return success(response, { items: includeClientOnlyMachine ? [...machines, clientOnlyMachine()] : machines });
  }
  if (path === "/v1/machines/mch_browser_test" && request.method === "PATCH") {
    const input = await readJSON(request);
    machines[0] = { ...machines[0], display_name: input.display_name };
    return success(response, machines[0]);
  }
  if (path === "/v1/machines/overview" && request.method === "GET") {
    return success(response, {
      entitlement_state: "active",
      seat_quantity: 2,
      occupied_seats: 1,
      available_seats: 1,
      included_bytes: 0,
      consumed_included_bytes: 0,
      consumed_topup_bytes: 0,
      paid_topup_remaining_bytes: 0,
    });
  }
  if (path === "/v1/machines/update-summary" && request.method === "GET") return success(response, { items: [], counts: {} });
  if (path === "/v1/machine-enrollments" && request.method === "POST") {
    enrollment = {
      id: "enr_browser_test",
      operation_id: "op_browser_test",
      state: "awaiting_bootstrap",
      generation: 1,
      expires_at: "2030-01-02T03:04:05Z",
      created_at: "2030-01-01T03:04:05Z",
      updated_at: "2030-01-01T03:04:05Z",
    };
    return success(response, {
      ...enrollment,
      bootstrap_command: "https://get.pprbt.dev/install",
      token_download_path: `/v1/machine-enrollments/${enrollment.id}/bootstrap-token`,
      server_url: "https://api.pprbt.dev",
    }, 201);
  }
  if (path === "/v1/machine-enrollments/enr_browser_test/bootstrap-token" && request.method === "GET") {
    const body = "bootstrap-token-browser-test\n";
    response.writeHead(200, {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": 'attachment; filename="paperboat-enrollment-token.txt"',
      "cache-control": "no-store, private",
      "content-length": Buffer.byteLength(body),
    });
    response.end(body);
    return;
  }
  if (path.startsWith("/v1/machine-enrollments/") && request.method === "GET") {
    if (!enrollment || path !== `/v1/machine-enrollments/${enrollment.id}`) return failure(response, 404, "not_found", "Enrollment not found.");
    return success(response, enrollment);
  }
  if (path === "/v1/previews" && request.method === "GET") {
    if (previewsUnavailable) return failure(response, 503, "provider_unavailable", "The preview control plane is unavailable.");
    return success(response, { items: previews, next_cursor: null });
  }
  if (path === "/v1/previews" && request.method === "POST") {
    const input = await readJSON(request);
    if (!input.owner_device_id || !input.owner_session_id || !input.target?.scheme || !input.target?.address) {
      return failure(response, 400, "validation_failed", "Preview request details are invalid.");
    }
    const created = {
      schema: "paperboat.preview-tunnel/v1",
      kind: "preview_lease",
      id: "prv_created",
      account_id: "acct_browser_test",
      actor_id: "usr_browser_test",
      owner_device_id: input.owner_device_id,
      owner_session_id: input.owner_session_id,
      target: input.target,
      access_mode: input.access_mode === "private" ? "private" : "public",
      persistent: false,
      endpoint: "https://created.preview.example.test",
      lease_deadline: "2030-01-02T03:04:05Z",
      user_deadline: input.expires_at ?? null,
      state: "connecting",
      allocation_state: "pending",
      edge_state: "pending",
      origin_state: "unknown",
      created_at: "2030-01-01T04:04:05Z",
      last_renewed_at: "2030-01-01T04:04:05Z",
    };
    previews = [created, ...previews.filter((item) => item.id !== created.id)];
    const operation = previewOperation(created);
    operations.set(operation.id, { operation, polls: 0 });
    return success(response, operation, 202);
  }
  if (path.startsWith("/v1/operations/") && request.method === "GET") {
    const id = decodeURIComponent(path.slice("/v1/operations/".length));
    if (id === "op_tunnel_ready_browser") {
      const tunnel = tunnels[0];
      if (!tunnel) return failure(response, 404, "operation_not_found", "Operation not found.");
      return success(response, { ...tunnelOperation(tunnel, "ready"), id });
    }
    const entry = operations.get(id);
    if (!entry) return failure(response, 404, "operation_not_found", "Operation not found.");
    entry.polls += 1;
    if (entry.polls >= 2 && entry.operation.state === "running") {
      const preview = previews.find((item) => item.id === entry.operation.resource_id);
      if (preview) {
        Object.assign(preview, {
          state: "ready",
          allocation_state: "ready",
          edge_state: "ready",
          origin_state: "ready",
        });
      }
      entry.operation = {
        ...entry.operation,
        phase: "ready",
        state: "succeeded",
        progress: 100,
        updated_at: "2030-01-01T04:04:06Z",
      };
    }
    return success(response, entry.operation);
  }
  if (path.startsWith("/v1/previews/") && path.endsWith("/events") && request.method === "GET") {
    const id = decodeURIComponent(path.slice("/v1/previews/".length, -"/events".length));
    const preview = previews.find((item) => item.id === id);
    if (!preview) return failure(response, 404, "not_found_or_forbidden", "Preview not found.");
    const event = previewEvent(preview);
    if (!request.headers.accept?.includes("text/event-stream")) {
      return success(response, { items: previewReady(preview) ? [event] : [], next_cursor: null });
    }
    response.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-store",
      "connection": "keep-alive",
      "request-id": "req_browser_test",
    });
    if (previewReady(preview)) response.write(`id: ${event.cursor}\ndata: ${JSON.stringify(event)}\n\n`);
    response.write(": keepalive\n\n");
    const keepalive = setInterval(() => response.write(": keepalive\n\n"), 15_000);
    request.on("close", () => clearInterval(keepalive));
    return;
  }
  if (path.startsWith("/v1/previews/") && request.method === "GET") {
    const id = decodeURIComponent(path.slice("/v1/previews/".length));
    const preview = previews.find((item) => item.id === id);
    if (!preview) return failure(response, 404, "not_found_or_forbidden", "Preview not found.");
    response.setHeader("etag", previewETag(preview));
    return success(response, preview);
  }
  if (path.startsWith("/v1/previews/") && request.method === "DELETE") {
    const id = decodeURIComponent(path.slice("/v1/previews/".length));
    const preview = previews.find((item) => item.id === id);
    if (!preview) return failure(response, 404, "not_found_or_forbidden", "Preview not found.");
    if (request.headers["if-match"] !== previewETag(preview)) return failure(response, 412, "generation_conflict", "The preview changed; refresh it and retry.");
    previews = previews.filter((item) => item.id !== id);
    response.setHeader("etag", previewETag(preview));
    return success(response, { ...preview, state: "stopped", allocation_state: "released", edge_state: "down" });
  }
  if (path === "/v1/tunnels" && request.method === "GET") {
    if (tunnelsUnavailable) return failure(response, 503, "control_plane_unavailable", "The tunnel control plane is unavailable.");
    return success(response, { items: tunnels, next_cursor: null });
  }
  if (path.startsWith("/v1/tunnels/") && path.endsWith("/status") && request.method === "GET") {
    const id = decodeURIComponent(path.slice("/v1/tunnels/".length, -"/status".length));
    const tunnel = tunnels.find((item) => item.id === id);
    if (!tunnel) return failure(response, 404, "not_found_or_forbidden", "Tunnel not found.");
    return success(response, tunnelHealth(tunnel));
  }
  if (path.startsWith("/v1/tunnels/") && path.endsWith("/routes") && request.method === "GET") {
    const id = decodeURIComponent(path.slice("/v1/tunnels/".length, -"/routes".length));
    return success(response, { items: tunnelRoutes.filter((route) => route.tunnel_id === id), next_cursor: null });
  }
  if (path.startsWith("/v1/tunnels/") && path.endsWith("/connectors") && request.method === "GET") {
    const id = decodeURIComponent(path.slice("/v1/tunnels/".length, -"/connectors".length));
    return success(response, { items: tunnelConnectors.filter((connector) => connector.tunnel_id === id), next_cursor: null });
  }
  if (path.startsWith("/v1/tunnels/") && path.endsWith("/events") && request.method === "GET") {
    const id = decodeURIComponent(path.slice("/v1/tunnels/".length, -"/events".length));
    const tunnel = tunnels.find((item) => item.id === id);
    if (!tunnel) return failure(response, 404, "not_found_or_forbidden", "Tunnel not found.");
    const event = tunnelEvent(tunnel);
    if (!request.headers.accept?.includes("text/event-stream")) return success(response, { items: [event], next_cursor: null });
    response.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-store",
      "connection": "keep-alive",
      "request-id": "req_browser_test",
    });
    response.write(`id: ${event.cursor}\ndata: ${JSON.stringify(event)}\n\n`);
    const keepalive = setInterval(() => response.write(": keepalive\n\n"), 15_000);
    request.on("close", () => clearInterval(keepalive));
    return;
  }
  if (path.startsWith("/v1/tunnels/") && path.endsWith("/pause") && request.method === "POST") {
    const id = decodeURIComponent(path.slice("/v1/tunnels/".length, -"/pause".length));
    const tunnel = tunnels.find((item) => item.id === id);
    if (!tunnel) return failure(response, 404, "not_found_or_forbidden", "Tunnel not found.");
    if (tunnelConflict || request.headers["if-match"] !== tunnel.etag) {
      tunnelConflict = false;
      return failure(response, 412, "generation_conflict", "The tunnel changed; refresh it and retry.");
    }
    Object.assign(tunnel, { desired_state: "paused", summary_code: "paused", generation: tunnel.generation + 1, updated_at: "2030-01-01T03:05:00Z" });
    tunnel.etag = `"tunnel:${tunnel.id}:${tunnel.generation}"`;
    return success(response, tunnelOperation(tunnel, "pause"));
  }
  if (path.startsWith("/v1/tunnels/") && path.endsWith("/resume") && request.method === "POST") {
    const id = decodeURIComponent(path.slice("/v1/tunnels/".length, -"/resume".length));
    const tunnel = tunnels.find((item) => item.id === id);
    if (!tunnel) return failure(response, 404, "not_found_or_forbidden", "Tunnel not found.");
    if (request.headers["if-match"] !== tunnel.etag) return failure(response, 412, "generation_conflict", "The tunnel changed; refresh it and retry.");
    Object.assign(tunnel, { desired_state: "active", summary_code: "ready", generation: tunnel.generation + 1, updated_at: "2030-01-01T03:06:00Z" });
    tunnel.etag = `"tunnel:${tunnel.id}:${tunnel.generation}"`;
    return success(response, tunnelOperation(tunnel, "resume"));
  }
  if (path.startsWith("/v1/tunnels/") && request.method === "GET") {
    const id = decodeURIComponent(path.slice("/v1/tunnels/".length));
    const tunnel = tunnels.find((item) => item.id === id);
    if (!tunnel) return failure(response, 404, "not_found_or_forbidden", "Tunnel not found.");
    response.setHeader("etag", tunnel.etag);
    return success(response, tunnel);
  }
  if (path.startsWith("/v1/tunnels/") && request.method === "DELETE") {
    const id = decodeURIComponent(path.slice("/v1/tunnels/".length));
    const tunnel = tunnels.find((item) => item.id === id);
    if (!tunnel) return failure(response, 404, "not_found_or_forbidden", "Tunnel not found.");
    if (request.headers["if-match"] !== tunnel.etag) return failure(response, 412, "generation_conflict", "The tunnel changed; refresh it and retry.");
    const operation = tunnelOperation(tunnel, "delete");
    tunnels = tunnels.filter((item) => item.id !== id);
    operations.set(operation.id, { operation, polls: 0 });
    return success(response, operation, 202);
  }
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
        format: "paperboat-config-plaintext-v1",
        manifest_contract: "paperboat-manifest-v1",
        manifest_max_bytes: 262_144,
        manifest_max_lines: 4_096,
        manifest_max_pattern_bytes: 1_024,
      },
      state: environments.some((item) => item.state === "conflict") ? "conflict" : "healthy",
      environments,
    });
  }
  if (
    path === "/v1/machines/mch_byod/config-assignment" &&
    request.method === "PUT"
  ) {
    const body = await readJSON(request);
    if (
      body.expected_version !== 0 ||
      body.repository_id !== repository.id ||
      body.mode !== "pull_only"
    ) {
      return failure(response, 409, "assignment_conflict", "The assignment changed. Refresh and retry.");
    }
    Object.assign(byod, {
      state: "consent_required",
      assignment_id: "cfgasn_byod",
      assignment_version: 1,
      repository_id: repository.id,
      repository_name: repository.display_name,
      mode: body.mode,
      consent_state: "pending",
      warning_revision: warning.revision,
    });
    return success(response, {
      id: "cfgasn_byod",
      machine_id: byod.machine_id,
      environment_id: byod.environment_id,
      repository_id: repository.id,
      mode: body.mode,
      consent_state: "pending",
      warning_revision: warning.revision,
      version: 1,
    });
  }
  if (path === "/v1/machines/mch_byod/config-assignment/warning") {
    return success(response, warning);
  }
  if (
    path === "/v1/machines/mch_byod/config-assignment/consent" &&
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
      machine_id: byod.machine_id,
      environment_id: byod.environment_id,
      repository_id: repository.id,
      mode: byod.mode,
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
    hosted.pending_clean_path_count = 0;
    hosted.recovery_actions = [];
    hosted.state = "healthy";
    hosted.sync_revision += 1;
    return success(response, { id: "cfgres_test", action: body.action });
  }
  if (
    path === "/v1/config-sync/environments/env_hosted/force" &&
    request.method === "POST"
  ) {
    const body = await readJSON(request);
    if (
      body.scope !== "path" ||
      body.path !== hosted.conflicts[0]?.path ||
      body.conflict_revision !== "conflict_1" ||
      body.expected_remote_revision !== "remote_head_1" ||
      body.expected_assignment_version !== 4 ||
      body.action !== "force_pull" ||
      body.confirmation !== "FORCE PULL"
    ) {
      return failure(response, 400, "force_confirmation_required", "Force confirmation is invalid.");
    }
    hosted.conflicts = [];
    hosted.recovery_actions = [];
    hosted.state = "healthy";
    hosted.sync_revision += 1;
    return success(response, { id: "cfgforce_test", scope: body.scope, action: body.action }, 202);
  }

  return failure(response, 404, "not_found", "The test endpoint was not found.");
});

server.listen(43001, "127.0.0.1");
