import assert from "node:assert/strict";
import test from "node:test";

import {
  PREVIEW_TUNNEL_SCHEMA,
  PreviewTunnelCanceledError,
  PreviewTunnelClient,
  PreviewTunnelError,
  SecretExposureError,
  TRK07_CLIENT_CONTRACT_DEPENDENCIES,
  retryDelayMs,
} from "../../src/lib/api/preview-tunnel-v1.ts";
import { relayResponse } from "../../src/lib/api/bff-transport.ts";

const tunnel = {
  schema: PREVIEW_TUNNEL_SCHEMA,
  kind: "tunnel",
  id: "tun_01",
  account_id: "acc_01",
  name: "coolify",
  desired_state: "active",
  access_mode: "private",
  generation: 3,
  etag: '"ptv1:tunnel:dHVuXzAx:3"',
  stable_endpoint_id: "tep_01",
  stable_endpoint: "https://coolify-01.tunnel.example.test",
  created_by_host_id: "host_01",
  created_by_actor_id: "act_01",
  expires_at: null,
  summary_code: "ready",
  created_at: "2026-08-30T11:00:00Z",
  updated_at: "2026-08-30T11:02:00Z",
};

function ok(data, headers = {}) {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { "content-type": "application/json", ...headers },
  });
}

function errorResponse(status, error) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function streamResponse(chunks) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream", "cache-control": "no-store" },
  });
}

function event(id, cursor, resourceId = "tun_01") {
  return {
    schema: PREVIEW_TUNNEL_SCHEMA,
    kind: "event",
    id,
    cursor,
    event_type: "tunnel.updated",
    resource_kind: "tunnel",
    resource_id: resourceId,
    occurred_at: "2026-08-30T11:02:00Z",
    actor: { type: "user", id: "act_01" },
    correlation_id: "corr_server",
    safe_metadata: { generation: 3 },
  };
}

test("mutation sends the strong ETag, stable idempotency key, and correlation ID", async () => {
  const requests = [];
  const client = new PreviewTunnelClient({
    correlationId: "corr_mutation",
    makeRequestId: () => "req_mutation",
    maxAttempts: 1,
    fetchImpl: async (input, init) => {
      requests.push({ input: String(input), init });
      return ok(tunnel, { etag: tunnel.etag, "correlation-id": "corr_mutation" });
    },
  });

  const result = await client.updateTunnel(
    "tun_01",
    { access_mode: "private" },
    { ifMatch: tunnel.etag, idempotencyKey: "idem_tunnel_01" },
  );

  assert.equal(result.kind, "tunnel");
  assert.equal(requests.length, 1);
  const headers = requests[0].init.headers;
  assert.equal(headers.get("if-match"), tunnel.etag);
  assert.equal(headers.get("idempotency-key"), "idem_tunnel_01");
  assert.equal(headers.get("correlation-id"), "corr_mutation");
  assert.equal(headers.get("request-id"), "req_mutation");
  assert.equal(requests[0].input, "/api/pb/v1/tunnels/tun_01");
});

test("preview reads return the strong ETag needed for a safe stop", async () => {
  const preview = {
    schema: PREVIEW_TUNNEL_SCHEMA,
    kind: "preview_lease",
    id: "prv_01",
  };
  const etag = '"preview_lease:prv_01:1"';
  const client = new PreviewTunnelClient({
    maxAttempts: 1,
    fetchImpl: async (input) => {
      assert.equal(String(input), "/api/pb/v1/previews/prv_01");
      return ok(preview, { etag });
    },
  });

  const result = await client.getPreviewWithETag("prv_01");
  assert.equal(result.preview.kind, "preview_lease");
  assert.equal(result.etag, etag);
});

test("retryable failures reuse the same idempotency key and use bounded jittered backoff", async () => {
  const requests = [];
  const delays = [];
  let attempt = 0;
  const client = new PreviewTunnelClient({
    correlationId: "corr_retry",
    maxAttempts: 3,
    retryBaseDelayMs: 10,
    retryMaxDelayMs: 20,
    random: () => 1,
    sleep: async (milliseconds) => delays.push(milliseconds),
    fetchImpl: async (_input, init) => {
      requests.push(init.headers.get("idempotency-key"));
      attempt += 1;
      if (attempt === 1) {
        return errorResponse(503, {
          schema: PREVIEW_TUNNEL_SCHEMA,
          kind: "error",
          code: "edge_unavailable",
          component: "edge",
          message: "The edge is retrying.",
          outcome: "uncertain",
          retryable: true,
          retry_at: null,
          repair_action: "retry",
          request_id: "req_1",
          correlation_id: "corr_retry",
        });
      }
      return ok(tunnel);
    },
  });

  const result = await client.createTunnel(
    {
      name: "coolify",
      origin: { scheme: "http", address: "127.0.0.1:80", preserve_host: true },
    },
    { idempotencyKey: "idem_retry" },
  );

  assert.equal(result.kind, "tunnel");
  assert.deepEqual(requests, ["idem_retry", "idem_retry"]);
  assert.deepEqual(delays, [10]);
  assert.equal(retryDelayMs(3, 10, 20, () => 1), 20);
});

test("generation conflicts are typed and are never retried", async () => {
  let calls = 0;
  const client = new PreviewTunnelClient({
    maxAttempts: 5,
    fetchImpl: async () => {
      calls += 1;
      return errorResponse(412, {
        schema: PREVIEW_TUNNEL_SCHEMA,
        kind: "error",
        code: "generation_conflict",
        component: "config",
        message: "The tunnel changed before this update was applied.",
        outcome: "unchanged",
        retryable: false,
        retry_at: null,
        repair_action: "refresh_and_retry",
        request_id: "req_conflict",
        correlation_id: "corr_conflict",
      });
    },
  });

  await assert.rejects(
    client.updateTunnel("tun_01", { access_mode: "public" }, {
      ifMatch: tunnel.etag,
      idempotencyKey: "idem_conflict",
    }),
    (error) => {
      assert.ok(error instanceof PreviewTunnelError);
      assert.equal(error.code, "generation_conflict");
      assert.equal(error.status, 412);
      assert.equal(error.outcome, "unchanged");
      assert.equal(error.retryable, false);
      assert.equal(error.isConflict, true);
      return true;
    },
  );
  assert.equal(calls, 1);
});

test("domain and connector lifecycle methods use canonical paths and mutation headers", async () => {
  const domain = { schema: PREVIEW_TUNNEL_SCHEMA, kind: "domain_binding" };
  const connector = { schema: PREVIEW_TUNNEL_SCHEMA, kind: "connector" };
  const operation = { schema: PREVIEW_TUNNEL_SCHEMA, kind: "operation" };
  const responses = [domain, domain, domain, connector, connector, operation];
  const requests = [];
  const client = new PreviewTunnelClient({
    maxAttempts: 1,
    fetchImpl: async (input, init) => {
      requests.push({ input: String(input), init });
      return ok(responses.shift());
    },
  });

  await client.getDomain("tun_01", "dom_01");
  await client.deleteDomain("tun_01", "dom_01", {
    ifMatch: '"dom_01:2"',
    idempotencyKey: "idem_dom_delete",
  });
  await client.verifyDomain("tun_01", "dom_01", {
    ifMatch: '"dom_01:2"',
    idempotencyKey: "idem_dom_verify",
  });
  await client.drainConnector("tun_01", "con_01", { ifMatch: '"con_01:2"', idempotencyKey: "idem_drain" });
  await client.revokeConnector("tun_01", "con_01", { ifMatch: '"con_01:2"', idempotencyKey: "idem_revoke" });
  await client.rotateTunnelCredentials("tun_01", { ifMatch: '"tun_01:3"', idempotencyKey: "idem_rotate" });

  assert.deepEqual(
    requests.map(({ input }) => input),
    [
      "/api/pb/v1/tunnels/tun_01/domains/dom_01",
      "/api/pb/v1/tunnels/tun_01/domains/dom_01",
      "/api/pb/v1/tunnels/tun_01/domains/dom_01/verify",
      "/api/pb/v1/tunnels/tun_01/connectors/con_01/drain",
      "/api/pb/v1/tunnels/tun_01/connectors/con_01",
      "/api/pb/v1/tunnels/tun_01/credentials/rotate",
    ],
  );
  assert.equal(requests[1].init.headers.get("if-match"), '"dom_01:2"');
  assert.equal(requests[2].init.headers.get("if-match"), '"dom_01:2"');
  assert.equal(requests[3].init.headers.get("if-match"), '"con_01:2"');
  assert.equal(requests[4].init.headers.get("if-match"), '"con_01:2"');
  assert.equal(requests[5].init.headers.get("if-match"), '"tun_01:3"');
  assert.equal(requests[3].init.headers.get("idempotency-key"), "idem_drain");
  assert.equal(requests[4].init.headers.get("idempotency-key"), "idem_revoke");
  assert.equal(requests[5].init.headers.get("idempotency-key"), "idem_rotate");
  assert.deepEqual(TRK07_CLIENT_CONTRACT_DEPENDENCIES.map((item) => item.endpoint), [
    "/v1/tunnels/{tunnelId}/connectors/enrollments",
  ]);
});

test("safe log, DNS instruction, and connector reads use canonical resource kinds", async () => {
  const responses = [
    { schema: PREVIEW_TUNNEL_SCHEMA, kind: "connector" },
    { items: [{ schema: PREVIEW_TUNNEL_SCHEMA, kind: "log_entry" }] },
    { items: [{ schema: PREVIEW_TUNNEL_SCHEMA, kind: "log_entry" }] },
    { schema: PREVIEW_TUNNEL_SCHEMA, kind: "dns_instructions" },
  ];
  const requests = [];
  const client = new PreviewTunnelClient({
    maxAttempts: 1,
    fetchImpl: async (input, init) => {
      requests.push({ input: String(input), init });
      return ok(responses.shift());
    },
  });
  await client.getConnector("tun_01", "con_01");
  await client.listTunnelLogs("tun_01", { cursor: "cur_01", limit: 10 });
  await client.listPreviewLogs("prv_01");
  await client.getDomainInstructions("tun_01", "dom_01");
  assert.deepEqual(requests.map(({ input }) => input), [
    "/api/pb/v1/tunnels/tun_01/connectors/con_01",
    "/api/pb/v1/tunnels/tun_01/logs?cursor=cur_01&limit=10",
    "/api/pb/v1/previews/prv_01/logs",
    "/api/pb/v1/tunnels/tun_01/domains/dom_01/instructions",
  ]);
});

test("event reconnect resumes with the exact cursor and suppresses replayed events", async () => {
  const first = event("evt_01", "cur_00000001");
  const second = event("evt_02", "cur_00000002");
  const requests = [];
  const received = [];
  let subscription;
  const client = new PreviewTunnelClient({
    correlationId: "corr_events",
    makeRequestId: () => "req_events",
    random: () => 1,
    sleep: async () => undefined,
    fetchImpl: async (input, init) => {
      requests.push({ url: String(input), headers: init.headers });
      if (requests.length === 1) {
        const encoded = JSON.stringify(first);
        return streamResponse([
          ": keep-alive\r\n\r\ndata: ",
          encoded.slice(0, 19),
          encoded.slice(19),
          "\r\n\r\n",
        ]);
      }
      assert.match(String(input), /[?&]cursor=cur_00000001(?:&|$)/);
      assert.equal(init.headers.get("last-event-id"), "cur_00000001");
      assert.equal(init.headers.get("correlation-id"), "corr_events");
      return streamResponse([
        `data: ${JSON.stringify(first)}\n\n`,
        `data: ${JSON.stringify(second)}\n\n`,
      ]);
    },
  });

  subscription = client.subscribeEvents("tunnel", "tun_01", {
    maxReconnectAttempts: 3,
    onEvent: async (value) => {
      received.push(value.id);
      if (value.id === "evt_02") subscription.close();
    },
  });
  await subscription.done;

  assert.deepEqual(received, ["evt_01", "evt_02"]);
  assert.equal(subscription.getCursor(), "cur_00000002");
  assert.equal(requests.length, 2);
});

test("cancellation is typed and aborts an in-flight request", async () => {
  const controller = new AbortController();
  const client = new PreviewTunnelClient({
    maxAttempts: 1,
    fetchImpl: async (_input, init) => new Promise((_, reject) => {
      init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }),
  });
  const pending = client.getOperation("op_01", { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, (error) => error instanceof PreviewTunnelCanceledError);
});

test("unsafe reusable credentials are rejected before typed data is returned", async () => {
  const client = new PreviewTunnelClient({
    maxAttempts: 1,
    fetchImpl: async () => ok({ ...tunnel, token: "reusable-secret-value" }),
  });

  await assert.rejects(client.getTunnel("tun_01"), (error) => {
    assert.ok(error instanceof SecretExposureError);
    assert.equal(error.message.includes("reusable-secret-value"), false);
    return true;
  });
});

test("URL userinfo is rejected before a reusable credential can reach callers", async () => {
  const client = new PreviewTunnelClient({
    maxAttempts: 1,
    fetchImpl: async () => ok({
      ...tunnel,
      stable_endpoint: "https://user:password@example.test/preview",
    }),
  });

  await assert.rejects(client.getTunnel("tun_01"), (error) => error instanceof SecretExposureError);
});

test("oversized multiline SSE events are rejected before unbounded accumulation", async () => {
  const oversized = Array(40_000).fill("data: x\n").join("");
  const client = new PreviewTunnelClient({
    maxAttempts: 1,
    maxReconnectAttempts: 0,
    fetchImpl: async () => streamResponse([oversized]),
  });
  const subscription = client.subscribeEvents("tunnel", "tun_01");

  await assert.rejects(subscription.done, (error) => {
    assert.ok(error instanceof PreviewTunnelError);
    assert.equal(error.code, "invalid_response");
    return true;
  });
});

test("the BFF relay preserves a live event-stream body and its recovery headers", async () => {
  const encoder = new TextEncoder();
  const upstreamStream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode("data: first\\n\\n"));
      controller.close();
    },
  });
  const upstream = new Response(upstreamStream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
      connection: "keep-alive",
      "keep-alive": "timeout=30",
      "correlation-id": "corr_stream",
    },
  });

  const relayed = relayResponse(upstream, upstream.body);

  assert.equal(relayed.headers.get("content-type"), "text/event-stream");
  assert.equal(relayed.headers.get("cache-control"), "no-store");
  assert.equal(relayed.headers.get("connection"), null);
  assert.equal(relayed.headers.get("keep-alive"), null);
  assert.equal(relayed.headers.get("correlation-id"), "corr_stream");
  assert.equal(await relayed.text(), "data: first\\n\\n");
});
