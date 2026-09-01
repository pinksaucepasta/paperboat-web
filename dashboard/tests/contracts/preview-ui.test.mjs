import assert from "node:assert/strict";
import test from "node:test";

import {
  formatPreviewCountdown,
  originLabel,
  parsePreviewTarget,
  previewIsReady,
  previewStatus,
  safePreviewEndpoint,
  targetLabel,
  trafficLabel,
} from "../../src/lib/preview-ui.ts";

const basePreview = {
  schema: "paperboat.preview-tunnel/v1",
  kind: "preview_lease",
  id: "prv_test",
  account_id: "acc_test",
  actor_id: "actor_test",
  owner_device_id: "device_test",
  owner_session_id: "session_test",
  target: { scheme: "http", address: "127.0.0.1:3000" },
  access_mode: "public",
  persistent: false,
  endpoint: "https://preview.example.test",
  lease_deadline: "2030-01-01T01:00:00.000Z",
  user_deadline: "2030-01-01T00:30:00.000Z",
  state: "ready",
  allocation_state: "ready",
  edge_state: "ready",
  origin_state: "ready",
  created_at: "2030-01-01T00:00:00.000Z",
  last_renewed_at: "2030-01-01T00:00:00.000Z",
};

test("normalizes supported local origin inputs and rejects unsafe URLs", () => {
  assert.deepEqual(parsePreviewTarget("3000"), {
    scheme: "http",
    address: "127.0.0.1:3000",
  });
  assert.deepEqual(parsePreviewTarget("h2c://localhost:8080"), {
    scheme: "h2c",
    address: "localhost:8080",
  });
  assert.deepEqual(parsePreviewTarget("unix:///tmp/paperboat.sock"), {
    scheme: "unix",
    address: "/tmp/paperboat.sock",
  });
  assert.deepEqual(parsePreviewTarget("tcp://10.0.0.4:5432"), {
    scheme: "tcp",
    address: "10.0.0.4:5432",
  });
  assert.throws(() => parsePreviewTarget("https://user:password@127.0.0.1:3000"), /credentials/);
  assert.throws(() => parsePreviewTarget("http://127.0.0.1:3000/private"), /path/);
  assert.throws(() => parsePreviewTarget("http://example.test:3000"), /loopback/);
  assert.equal(safePreviewEndpoint("https://preview.example.test"), "https://preview.example.test");
  assert.equal(safePreviewEndpoint("javascript:alert(1)"), undefined);
  assert.equal(safePreviewEndpoint("https://user:password@preview.example.test"), undefined);
});

test("projects canonical preview dimensions into clear status and traffic copy", () => {
  assert.equal(previewIsReady(basePreview), true);
  assert.equal(previewStatus(basePreview).label, "Ready");
  assert.equal(trafficLabel(basePreview), "Accepting traffic");
  assert.equal(originLabel(basePreview), "Reachable");

  const originUnavailable = {
    ...basePreview,
    origin_state: "unavailable",
    edge_state: "ready",
  };
  assert.equal(previewIsReady(originUnavailable), false);
  assert.equal(previewStatus(originUnavailable).label, "Origin unavailable");
  assert.equal(trafficLabel(originUnavailable), "Waiting for origin");
  assert.equal(originLabel(originUnavailable), "Unavailable");

  const disconnected = { ...basePreview, state: "owner_disconnected", edge_state: "degraded" };
  assert.equal(previewIsReady(disconnected), false);
  assert.equal(previewStatus(disconnected).label, "Owner disconnected");
  assert.equal(previewStatus(disconnected).variant, "warning");

  const expired = { ...basePreview, state: "expired" };
  assert.equal(previewStatus(expired).label, "Expired");
  assert.equal(trafficLabel(expired), "Not accepting");
});

test("formats duration relative to the server deadline without guessing indefinitely", () => {
  const now = Date.parse("2030-01-01T00:00:00.000Z");
  assert.equal(formatPreviewCountdown("2030-01-01T00:05:00.000Z", now), "in 5m");
  assert.equal(formatPreviewCountdown("2030-01-01T02:05:00.000Z", now), "in 2h 5m");
  assert.equal(formatPreviewCountdown(null, now), "Indefinite");
  assert.equal(formatPreviewCountdown("2029-12-31T23:59:59.000Z", now), "Expired");
  assert.equal(targetLabel({ scheme: "unix", address: "/tmp/paperboat.sock" }), "unix:///tmp/paperboat.sock");
});
