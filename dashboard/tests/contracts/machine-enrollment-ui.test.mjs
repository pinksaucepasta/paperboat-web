import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  machineEnrollmentIdentity,
  mergeMachineEnrollmentStatus,
} from "../../src/lib/machine-enrollment-ui.ts";

const generationOne = {
  id: "enr_test",
  operation_id: "op_test_1",
  state: "awaiting_bootstrap",
  generation: 1,
  expires_at: "2030-01-01T00:10:00.000Z",
  created_at: "2030-01-01T00:00:00.000Z",
  updated_at: "2030-01-01T00:00:00.000Z",
};

test("does not merge an older generation into a newly issued enrollment token", () => {
  const current = {
    ...generationOne,
    generation: 2,
    state: "awaiting_bootstrap",
    bootstrap_token: "TOKEN-GENERATION-2",
    bootstrap_command: "pb machine bootstrap",
    token_download_path: "/v1/machine-enrollments/enr_test/bootstrap-token",
    server_url: "https://api.example.test",
  };
  const stale = { ...generationOne, state: "ready", machine_id: "mch_old" };

  assert.strictEqual(
    mergeMachineEnrollmentStatus(current, stale, machineEnrollmentIdentity(current)),
    current,
  );
});

test("merges current-generation status without discarding the bearer token", () => {
  const current = {
    ...generationOne,
    bootstrap_token: "TOKEN-GENERATION-1",
    bootstrap_command: "pb machine bootstrap",
    token_download_path: "/v1/machine-enrollments/enr_test/bootstrap-token",
    server_url: "https://api.example.test",
  };
  const next = { ...generationOne, state: "ready", machine_id: "mch_new" };

  assert.deepEqual(
    mergeMachineEnrollmentStatus(current, next, machineEnrollmentIdentity(current)),
    { ...current, ...next },
  );
  assert.equal(mergeMachineEnrollmentStatus(current, next, machineEnrollmentIdentity(current)).bootstrap_token, "TOKEN-GENERATION-1");
});

test("replaces a locally older generation with newer server status without its old token", () => {
  const current = {
    ...generationOne,
    bootstrap_token: "TOKEN-GENERATION-1",
    bootstrap_command: "pb machine bootstrap",
    token_download_path: "/v1/machine-enrollments/enr_test/bootstrap-token",
    server_url: "https://api.example.test",
  };
  const next = { ...generationOne, generation: 2, state: "ready", machine_id: "mch_generation-2" };

  assert.deepEqual(
    mergeMachineEnrollmentStatus(current, next, machineEnrollmentIdentity(current)),
    next,
  );
  assert.equal("bootstrap_token" in mergeMachineEnrollmentStatus(current, next, machineEnrollmentIdentity(current)), false);
});

test("preserves a token when an older poll observes the already-current generation", () => {
  const current = {
    ...generationOne,
    generation: 2,
    bootstrap_token: "TOKEN-GENERATION-2",
    bootstrap_command: "pb machine bootstrap",
    token_download_path: "/v1/machine-enrollments/enr_test/bootstrap-token",
    server_url: "https://api.example.test",
  };
  const stalePoll = { ...generationOne, generation: 2, state: "ready", machine_id: "mch_generation-2" };

  assert.equal(
    mergeMachineEnrollmentStatus(current, stalePoll, machineEnrollmentIdentity(generationOne)).bootstrap_token,
    "TOKEN-GENERATION-2",
  );
});

test("reads enrollment status without allowing a cached generation", () => {
  const source = fs.readFileSync(new URL("../../src/lib/api/machines.ts", import.meta.url), "utf8");
  assert.match(source, /export function getMachineEnrollment\(id: string\)[\s\S]*?cache: "no-store"/);
});
