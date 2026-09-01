import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_VARIABLE_VALUE_BYTES,
  environmentVariableStatus,
  environmentVariableStatusMessage,
  environmentVariableValueByteLength,
  validateEnvironmentVariableValue,
  validateEnvironmentVariableName,
} from "../../src/lib/environment-variable-ui.ts";

test("maps reconciliation states to safe, readable labels", () => {
  assert.equal(environmentVariableStatus("applied").label, "Applied");
  assert.equal(environmentVariableStatus("offline").label, "Offline");
  assert.equal(environmentVariableStatus("failed").label, "Failed");
  assert.equal(environmentVariableStatus("conflict").label, "Not reported");
  assert.equal(environmentVariableStatus("unrecognized").label, "Not reported");
  assert.equal(environmentVariableStatus(undefined, "global").label, "Configured");
  assert.equal(environmentVariableStatus("pending", "global").label, "Configured");
  assert.match(environmentVariableStatusMessage(undefined, true, "global"), /tracked per host/);
  assert.match(environmentVariableStatusMessage("pending", true), /shortly/);
  assert.match(environmentVariableStatusMessage("offline", true), /reconnects/);
});

test("validates portable environment variable names", () => {
  assert.equal(validateEnvironmentVariableName("APP_REGION"), undefined);
  assert.equal(validateEnvironmentVariableName("_private2"), undefined);
  assert.match(validateEnvironmentVariableName(""), /Enter a variable name/);
  assert.match(validateEnvironmentVariableName("2FAST"), /Start with/);
  assert.match(validateEnvironmentVariableName("HAS-DASH"), /letters/);
  assert.match(validateEnvironmentVariableName("node_options"), /reserved/);
  assert.match(validateEnvironmentVariableName("LD_LIBRARY_PATH"), /reserved/);
  assert.match(validateEnvironmentVariableName("paperboat_region"), /reserved/);
  assert.equal(validateEnvironmentVariableName("foo"), undefined);
  assert.match(validateEnvironmentVariableName("foo", ["FOO"]), /already exists/);
});

test("enforces the cross-platform UTF-8 value limit without exposing values", () => {
  assert.equal(environmentVariableValueByteLength("a".repeat(MAX_VARIABLE_VALUE_BYTES)), MAX_VARIABLE_VALUE_BYTES);
  assert.equal(validateEnvironmentVariableValue("a".repeat(MAX_VARIABLE_VALUE_BYTES)), undefined);
  assert.match(validateEnvironmentVariableValue("😀".repeat(8_192)) ?? "", /32,767/);
  assert.match(validateEnvironmentVariableValue("bad\u0000value") ?? "", /NUL/);
});
