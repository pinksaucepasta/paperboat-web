import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fixtureURL = new URL(
  "../../../testdata/contracts/preview-tunnel-v1/fixtures/resources.ndjson",
  import.meta.url,
);

const vectors = (await readFile(fixtureURL, "utf8"))
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));

function keysDeep(value) {
  if (Array.isArray(value)) return value.flatMap(keysDeep);
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => [key, ...keysDeep(child)]);
  }
  return [];
}

test("preview-tunnel-v1 exposes complete safe dashboard read models", () => {
  const valid = vectors.filter((vector) => vector.valid).map((vector) => vector.resource);
  assert.deepEqual(
    [...new Set(valid.map((resource) => resource.kind))].sort(),
    [
      "config_generation",
      "connector",
      "dns_instructions",
      "domain_binding",
      "error",
      "event",
      "health",
      "log_entry",
      "operation",
      "preview_lease",
      "route",
      "tunnel",
      "tunnel_config_snapshot",
    ],
  );
  assert.ok(valid.every((resource) => resource.schema === "paperboat.preview-tunnel/v1"));
  assert.equal(
    keysDeep(valid).some((key) =>
      ["token", "secret", "private_key", "authorization"].includes(key),
    ),
    false,
  );

  const preview = valid.find((resource) => resource.kind === "preview_lease");
  assert.equal(preview.access_mode, "public");
  assert.equal(preview.persistent, false);

  const health = valid.find((resource) => resource.kind === "health");
  assert.deepEqual(Object.keys(health.dimensions).sort(), [
    "access",
    "certificate",
    "config",
    "dns",
    "edge",
    "origin",
    "route",
    "service",
    "update",
  ]);
});

test("preview-tunnel-v1 negative vectors remain typed", () => {
  assert.deepEqual(
    vectors
      .filter((vector) => !vector.valid)
      .map((vector) => vector.expected_error)
      .sort(),
    [
      "generation_invalid",
      "hostname_required",
      "preview_persistence_forbidden",
      "secret_field_forbidden",
      "secret_field_forbidden",
      "secret_field_forbidden",
      "secret_field_forbidden",
      "secret_field_forbidden",
      "secret_field_forbidden",
      "wildcard_depth_invalid",
    ],
  );
});
