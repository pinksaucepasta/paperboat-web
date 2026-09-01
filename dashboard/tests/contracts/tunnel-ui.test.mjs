import assert from "node:assert/strict";
import test from "node:test";

import {
  connectorStatus,
  healthDimensionLabel,
  operationIDFromEvent,
  routeMatchLabel,
  routeOriginLabel,
  safeTunnelEndpoint,
  tunnelStatus,
} from "../../src/lib/tunnel-ui.ts";

const tunnel = {
  desired_state: "active",
  summary_code: "tunnel.ready",
};

test("projects durable tunnel status without treating active as ready by itself", () => {
  assert.deepEqual(tunnelStatus(tunnel), { label: "Ready", variant: "success" });
  assert.deepEqual(tunnelStatus({ ...tunnel, summary_code: "connector.pending" }), { label: "Connecting", variant: "warning" });
  assert.deepEqual(tunnelStatus({ ...tunnel, desired_state: "paused" }), { label: "Paused", variant: "secondary" });
  assert.deepEqual(tunnelStatus({ ...tunnel, desired_state: "deleted" }), { label: "Deleting", variant: "error" });
});

test("accepts only secret-free canonical HTTPS stable endpoints", () => {
  assert.equal(safeTunnelEndpoint("https://stable.example.test"), "https://stable.example.test");
  assert.equal(safeTunnelEndpoint("https://user:secret@stable.example.test"), undefined);
  assert.equal(safeTunnelEndpoint("http://stable.example.test"), undefined);
  assert.equal(safeTunnelEndpoint("https://stable.example.test?q=secret"), undefined);
  assert.equal(safeTunnelEndpoint("javascript:alert(1)"), undefined);
});

test("formats exact, wildcard, catch-all, unix, and network route projections", () => {
  const route = {
    host_match: { type: "exact", hostname: "api.example.test" },
    path_prefix: "/v1",
    origin: { scheme: "https", address: "127.0.0.1:8443" },
  };
  assert.equal(routeMatchLabel(route), "api.example.test/v1");
  assert.equal(routeMatchLabel({ ...route, host_match: { type: "one_label_wildcard", hostname: "example.test" } }), "*.example.test/v1");
  assert.equal(routeMatchLabel({ ...route, host_match: { type: "catch_all" }, path_prefix: "/" }), "Any managed hostname");
  assert.equal(routeOriginLabel(route), "https://127.0.0.1:8443");
  assert.equal(routeOriginLabel({ ...route, origin: { scheme: "unix", address: "/tmp/app.sock" } }), "unix:///tmp/app.sock");
});

test("connector and health labels preserve pending, draining, and terminal distinctions", () => {
  assert.equal(connectorStatus({ desired_state: "active", drain_state: "accepting", ready_at: "2030-01-01", last_session_id: "session" }).label, "Connected");
  assert.equal(connectorStatus({ desired_state: "draining", drain_state: "draining" }).label, "Draining");
  assert.equal(connectorStatus({ desired_state: "revoked", drain_state: "forced_closed" }).label, "Revoked");
  assert.equal(healthDimensionLabel({ status: "not_applicable", code: "n/a" }), "Not applicable");
  assert.equal(healthDimensionLabel({ status: "down", code: "route.down" }), "Down");
});

test("extracts only bounded operation IDs from safe event metadata", () => {
  const event = { safe_metadata: { operation_id: "op_tunnel_pause_01" } };
  assert.equal(operationIDFromEvent(event), "op_tunnel_pause_01");
  assert.equal(operationIDFromEvent({ safe_metadata: { operation_id: "../../secret" } }), undefined);
  assert.equal(operationIDFromEvent({ safe_metadata: {} }), undefined);
});
