import { ApiError, pbFetch } from "./client";

export type EnvironmentVariableScope = "global" | "machine";
export type EnvironmentScopeState = "active" | "retired";
export type EnvironmentKeyState = "key_authorization_required" | "ready" | "rotation_required";
export type EnvironmentVariableStatus = "pending" | "applied" | "offline" | "failed";

export interface EnvironmentVariableTarget {
  scope: EnvironmentVariableScope;
  machineId?: string;
}

/** Redacted metadata. This type intentionally has no value/ciphertext field. */
export interface EnvironmentVariableMetadata {
  scope: EnvironmentVariableScope;
  machine_id: string | null;
  name: string;
  configured: true;
  version: number;
  updated_at: string;
}

export interface EnvironmentVariableSnapshot {
  scope: EnvironmentVariableScope;
  machine_id: string | null;
  scope_state?: EnvironmentScopeState;
  key_state: EnvironmentKeyState;
  items: EnvironmentVariableMetadata[];
  version: number;
  key_epoch?: number;
  manifest_id?: string;
  etag: string;
  status?: EnvironmentVariableStatus;
  applied_global_version?: number;
  applied_machine_version?: number;
  applied_state?: "pending" | "applied" | "failed";
  error_code?: string;
  observed_at?: string;
}

export interface EnvironmentScopeInventoryItem {
  scope: EnvironmentVariableScope;
  machine_id?: string;
  scope_state: EnvironmentScopeState;
  version: number;
  key_epoch: number;
  manifest_id: string;
  names: string[];
}

export interface EnvironmentScopeInventory {
  schema: "paperboat.environment-scope-inventory/v1";
  scopes: EnvironmentScopeInventoryItem[];
}

export interface EnvironmentManifestState {
  schema: "paperboat.environment-manifest-state/v1";
  scope: EnvironmentVariableScope;
  machine_id?: string;
  version: number;
  key_epoch: number;
  manifest_id: string;
  envelope: string;
  etag: string;
}

export interface EnvironmentManifestMutation {
  schema: "paperboat.environment-manifest-mutation/v1";
  expected_version: number;
  operation_id: string;
  envelope: string;
}

export interface EnvironmentAuthorityState {
  schema: "paperboat.environment-authority-state/v1";
  generation: number;
  authority_id: string;
  authority: string;
  etag: string;
}

export interface EnvironmentAuthorityHead {
  generation: number;
  authority_id: string;
}

export interface EnvironmentAuthorityPage {
  schema: "paperboat.environment-authority-page/v1";
  authority_head: EnvironmentAuthorityHead;
  authority_documents: string[];
  has_more: boolean;
}

export interface EnvironmentEnrollmentState {
  schema: "paperboat.environment-key-enrollment-state/v1";
  request_id: string;
  state: "challenge" | "pending";
  expires_at: string;
  safety_code: string;
  enrollment_request: string;
  signing_proof: string | null;
  challenge?: string;
}

const VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SAFE_ERROR_CODE = /^[a-z0-9_]{1,64}$/;
const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
// Machine IDs are Paperboat identifiers, not arbitrary URL/path fragments.
// Keeping this equal to the server's identifier grammar prevents a dashboard
// target from aliasing another route through punctuation or encoded paths.
const SAFE_MACHINE_ID = SAFE_IDENTIFIER;
const SAFE_OPERATION_ID = /^envop_[0-9a-f]{32}$/;
const SAFE_DIGEST_ID = /^sha256:[0-9a-f]{64}$/;
const SAFE_KEY_ID = /^(?:sigk|envk)_[A-Za-z0-9_-]{43}$/;
const RFC3339_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/;
const MAX_NAME_BYTES = 128;
const MAX_TIMESTAMP_LENGTH = 128;
const MAX_ENROLLMENT_REQUEST_BYTES = 8 * 1024;
const MAX_ENROLLMENT_PROOF_BYTES = 64;
const MAX_ENROLLMENT_CHALLENGE_BYTES = 1 * 1024;
const MAX_MANIFEST_ENVELOPE_BYTES = 1 << 20;

const METADATA_FIELDS = new Set(["scope", "machine_id", "name", "configured", "version", "updated_at"]);
const SNAPSHOT_FIELDS = new Set([
  "scope", "machine_id", "scope_state", "key_state", "version", "key_epoch", "manifest_id", "variables",
  "status", "applied_global_version", "applied_machine_version", "applied_state", "error_code", "observed_at",
]);
const INVENTORY_FIELDS = new Set(["schema", "scopes"]);
const INVENTORY_ITEM_FIELDS = new Set(["scope", "machine_id", "scope_state", "version", "key_epoch", "manifest_id", "names"]);
const MANIFEST_STATE_FIELDS = new Set(["schema", "scope", "machine_id", "version", "key_epoch", "manifest_id", "envelope"]);
const AUTHORITY_FIELDS = new Set(["schema", "generation", "authority_id", "authority"]);
const AUTHORITY_PAGE_FIELDS = new Set(["schema", "authority_head", "authority_documents", "has_more"]);
const AUTHORITY_HEAD_FIELDS = new Set(["generation", "authority_id"]);

function invalidResponse(message: string): never {
  throw new ApiError("invalid_environment_response", message, 502);
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalidResponse(`The environment response has an invalid ${field}.`);
  return value as Record<string, unknown>;
}

function requireFields(value: Record<string, unknown>, allowed: ReadonlySet<string>, field: string): void {
  if (Object.keys(value).some((key) => !allowed.has(key))) invalidResponse(`The environment response has an invalid ${field} shape.`);
}

function safeInteger(value: unknown, field: string, allowZero = true): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < (allowZero ? 0 : 1) || value > Number.MAX_SAFE_INTEGER) invalidResponse(`The environment response has an invalid ${field}.`);
  return value;
}

function safeTimestamp(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_TIMESTAMP_LENGTH || /[\r\n]/.test(value) || !validRFC3339(value) || !Number.isFinite(Date.parse(value))) invalidResponse(`The environment response has an invalid ${field}.`);
  return value;
}

function validRFC3339(value: string): boolean {
  const match = RFC3339_TIMESTAMP.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[8] === "Z" ? 0 : Number(match[10]);
  const offsetMinute = match[8] === "Z" ? 0 : Number(match[11]);
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59 || offsetHour > 23 || offsetMinute > 59) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day >= 1 && day <= daysInMonth;
}

function safeName(value: unknown): string {
  if (typeof value !== "string" || new TextEncoder().encode(value).byteLength > MAX_NAME_BYTES || !VARIABLE_NAME.test(value)) invalidResponse("The environment response has an invalid variable name.");
  const folded = value.toUpperCase();
  if (["PAPERBOAT_", "LD_", "DYLD_"].some((prefix) => folded.startsWith(prefix)) || ["NODE_OPTIONS", "PYTHONPATH", "PYTHONHOME", "GOTRACEBACK"].includes(folded)) invalidResponse("The environment response has a reserved variable name.");
  return value;
}

function safeMachineId(value: string): string {
  if (!SAFE_MACHINE_ID.test(value)) throw new Error("A safe machine ID is required.");
  return value;
}

function targetMachineId(target: EnvironmentVariableTarget): string | null {
  if (target.scope === "global") {
    if (target.machineId !== undefined) throw new Error("Global environment scope cannot have a machine ID.");
    return null;
  }
  if (!target.machineId) throw new Error("A machine ID is required.");
  return safeMachineId(target.machineId);
}

function responseMachineId(value: unknown, target: EnvironmentVariableTarget): string | null {
  const expected = targetMachineId(target);
  if (expected === null) {
    if (value !== undefined && value !== null) invalidResponse("The environment response has an invalid machine scope.");
    return null;
  }
  if (value !== expected) invalidResponse("The environment response targets a different machine.");
  return expected;
}

export function environmentVariableETag(target: EnvironmentVariableTarget, version: number): string {
  if (!Number.isSafeInteger(version) || version < 0) throw new Error("A nonnegative scope version is required.");
  const suffix = target.scope === "global" ? "environment-global" : `environment-machine-${targetMachineId(target)}`;
  return `"${suffix}-${version}"`;
}

function requireETag(target: EnvironmentVariableTarget, etag: string | undefined, version: number): string {
  const expected = environmentVariableETag(target, version);
  if (etag !== expected) invalidResponse("The environment response is missing its exact scope ETag.");
  return expected;
}

function safeDigest(value: unknown, field: string): string {
  if (typeof value !== "string" || !SAFE_DIGEST_ID.test(value)) invalidResponse(`The environment response has an invalid ${field}.`);
  return value;
}

function safeBase64Url(value: unknown, maxBytes: number, field: string, exactBytes?: number): string {
  if (typeof value !== "string" || value.length === 0 || value.includes("=") || /[^A-Za-z0-9_-]/.test(value) || value.length > Math.ceil(maxBytes * 4 / 3) + 4) invalidResponse(`The environment response has an invalid ${field}.`);
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  let binary: string;
  try { binary = atob(padded); } catch { invalidResponse(`The environment response has an invalid ${field}.`); }
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  let canonical = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) canonical += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  if (bytes.length === 0 || bytes.length > maxBytes || exactBytes !== undefined && bytes.length !== exactBytes || btoa(canonical).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "") !== value) invalidResponse(`The environment response has an invalid ${field}.`);
  return value;
}

function normalizeEnrollmentState(payload: unknown): EnvironmentEnrollmentState {
  const root = asRecord(payload, "enrollment state");
  const required = ["schema", "request_id", "state", "expires_at", "safety_code", "enrollment_request", "signing_proof"];
  requireFields(root, new Set([...required, "challenge"]), "enrollment state");
  if (root.schema !== "paperboat.environment-key-enrollment-state/v1" || typeof root.request_id !== "string" || !SAFE_IDENTIFIER.test(root.request_id) || root.state !== "challenge" && root.state !== "pending" || typeof root.safety_code !== "string" || !/^[a-z2-7]{4}(?:-[a-z2-7]{4}){3}$/.test(root.safety_code)) invalidResponse("The environment enrollment state is invalid.");
  const expiresAt = safeTimestamp(root.expires_at, "enrollment expiry");
  const enrollmentRequest = safeBase64Url(root.enrollment_request, MAX_ENROLLMENT_REQUEST_BYTES, "enrollment request");
  if (root.signing_proof !== null) safeBase64Url(root.signing_proof, MAX_ENROLLMENT_PROOF_BYTES, "enrollment signing proof", 64);
  if (root.state === "challenge") {
    safeBase64Url(root.challenge, MAX_ENROLLMENT_CHALLENGE_BYTES, "enrollment challenge", 80);
  } else if (root.challenge !== undefined) {
    invalidResponse("A pending enrollment must not expose its challenge.");
  }
  return {
    schema: "paperboat.environment-key-enrollment-state/v1",
    request_id: root.request_id,
    state: root.state,
    expires_at: expiresAt,
    safety_code: root.safety_code,
    enrollment_request: enrollmentRequest,
    signing_proof: root.signing_proof === null ? null : String(root.signing_proof),
    ...(root.state === "challenge" ? { challenge: String(root.challenge) } : {}),
  };
}

function normalizeMetadata(value: unknown, target: EnvironmentVariableTarget, expectedName?: string, expectedVersion?: number): EnvironmentVariableMetadata {
  const item = asRecord(value, "variable metadata");
  requireFields(item, METADATA_FIELDS, "variable metadata");
  for (const forbidden of ["value", "values", "plaintext", "secret", "scope_key", "decryption_key", "ciphertext"]) if (forbidden in item) invalidResponse("The environment response contains non-redacted variable data.");
  if (item.scope !== target.scope) invalidResponse("The environment response targets a different scope.");
  const machineId = responseMachineId(item.machine_id, target);
  const name = safeName(item.name);
  if (expectedName !== undefined && name !== expectedName) invalidResponse("The environment response names a different variable.");
  if (item.configured !== true) invalidResponse("The environment response has an invalid configured state.");
  const version = safeInteger(item.version, "variable version", false);
  if (expectedVersion !== undefined && version !== expectedVersion) invalidResponse("The environment response has an invalid mutation version.");
  return { scope: target.scope, machine_id: machineId, name, configured: true, version, updated_at: safeTimestamp(item.updated_at, "updated_at") };
}

function normalizeStatus(value: unknown, target: EnvironmentVariableTarget): EnvironmentVariableStatus | undefined {
  if (value === undefined) return undefined;
  if (target.scope === "global" || typeof value !== "string" || !["pending", "applied", "offline", "failed"].includes(value)) invalidResponse("The environment response has an invalid machine status.");
  return value as EnvironmentVariableStatus;
}

function normalizeAppliedState(value: unknown, target: EnvironmentVariableTarget): EnvironmentVariableSnapshot["applied_state"] {
  if (value === undefined) return undefined;
  if (target.scope === "global" || typeof value !== "string" || !["pending", "applied", "failed"].includes(value)) invalidResponse("The environment response has an invalid applied state.");
  return value as EnvironmentVariableSnapshot["applied_state"];
}

function normalizeSnapshot(payload: unknown, target: EnvironmentVariableTarget, responseETag?: string): EnvironmentVariableSnapshot {
  const root = asRecord(payload, "scope");
  requireFields(root, SNAPSHOT_FIELDS, "scope");
  if (root.scope !== target.scope || !Array.isArray(root.variables)) invalidResponse("The environment response has an invalid scope shape.");
  const machineId = responseMachineId(root.machine_id, target);
  const keyState = root.key_state;
  if (keyState !== "key_authorization_required" && keyState !== "ready" && keyState !== "rotation_required") invalidResponse("The environment response has an invalid key state.");
  const version = safeInteger(root.version, "scope version");
  const etag = requireETag(target, responseETag, version);
  const scopeState = root.scope_state;
  if (scopeState !== undefined && scopeState !== "active" && scopeState !== "retired") invalidResponse("The environment response has an invalid scope state.");
  const keyEpoch = root.key_epoch === undefined ? undefined : safeInteger(root.key_epoch, "key epoch", false);
  const manifestId = root.manifest_id === undefined ? undefined : safeDigest(root.manifest_id, "manifest ID");
  if (keyState === "key_authorization_required") {
    if (version !== 0 || scopeState !== undefined || keyEpoch !== undefined || manifestId !== undefined || root.variables.length !== 0) invalidResponse("The environment response has invalid uninitialized scope metadata.");
  } else if (version < 1 || keyEpoch === undefined || manifestId === undefined || scopeState === undefined || target.scope === "global" && scopeState !== "active") {
    invalidResponse("The environment response has invalid encrypted scope metadata.");
  }
  const status = normalizeStatus(root.status, target);
  const appliedState = normalizeAppliedState(root.applied_state, target);
  const errorCode = root.error_code === undefined ? undefined : typeof root.error_code === "string" && SAFE_ERROR_CODE.test(root.error_code) ? root.error_code : invalidResponse("The environment response has an invalid error code.");
  const observedAt = root.observed_at === undefined ? undefined : safeTimestamp(root.observed_at, "observed_at");
  const appliedGlobalVersion = root.applied_global_version === undefined ? undefined : safeInteger(root.applied_global_version, "applied global version");
  const appliedMachineVersion = root.applied_machine_version === undefined ? undefined : safeInteger(root.applied_machine_version, "applied machine version");
  if (target.scope === "global" && ["status", "applied_global_version", "applied_machine_version", "applied_state", "error_code", "observed_at"].some((field) => field in root)) invalidResponse("The global environment response contains machine status fields.");
  const seen = new Set<string>();
  const items = root.variables.map((item) => {
    const metadata = normalizeMetadata(item, target);
    if (metadata.version !== version) invalidResponse("The environment response has an invalid variable version.");
    const folded = metadata.name.toUpperCase();
    if (seen.has(folded)) invalidResponse("The environment response contains colliding variable names.");
    seen.add(folded);
    return metadata;
  });
  return { scope: target.scope, machine_id: machineId, scope_state: scopeState, key_state: keyState, items, version, key_epoch: keyEpoch, manifest_id: manifestId, etag, status, applied_global_version: appliedGlobalVersion, applied_machine_version: appliedMachineVersion, applied_state: appliedState, error_code: errorCode, observed_at: observedAt };
}

export async function listEnvironmentVariables(target: EnvironmentVariableTarget = { scope: "global" }): Promise<EnvironmentVariableSnapshot> {
  let responseETag: string | undefined;
  const machineId = targetMachineId(target);
  const payload = await pbFetch<unknown>(machineId === null ? "/v1/environment-variables" : `/v1/machines/${encodeURIComponent(machineId)}/environment-variables`, {
    cache: "no-store",
    noRetry: true,
    onResponse: (response) => { responseETag = response.headers.get("etag") ?? undefined; },
  });
  return normalizeSnapshot(payload, target, responseETag);
}

export async function getEnvironmentVariable(target: EnvironmentVariableTarget, name: string): Promise<EnvironmentVariableMetadata> {
  const safe = safeName(name);
  const machineId = targetMachineId(target);
  let responseETag: string | undefined;
  const payload = await pbFetch<unknown>(machineId === null ? `/v1/environment-variables/${encodeURIComponent(safe)}` : `/v1/machines/${encodeURIComponent(machineId)}/environment-variables/${encodeURIComponent(safe)}`, {
    cache: "no-store",
    noRetry: true,
    onResponse: (response) => { responseETag = response.headers.get("etag") ?? undefined; },
  });
  const metadata = normalizeMetadata(payload, target, safe);
  requireETag(target, responseETag, metadata.version);
  return metadata;
}

export async function getEnvironmentScopeInventory(): Promise<EnvironmentScopeInventory> {
  const payload = await pbFetch<unknown>("/v1/environment-scopes", { cache: "no-store", noRetry: true });
  const root = asRecord(payload, "scope inventory");
  requireFields(root, INVENTORY_FIELDS, "scope inventory");
  if (root.schema !== "paperboat.environment-scope-inventory/v1" || !Array.isArray(root.scopes) || root.scopes.length > 513) invalidResponse("The environment scope inventory is invalid.");
  const scopes = root.scopes.map((value) => {
    const item = asRecord(value, "scope inventory item");
    requireFields(item, INVENTORY_ITEM_FIELDS, "scope inventory item");
    if (item.scope !== "global" && item.scope !== "machine" || item.scope_state !== "active" && item.scope_state !== "retired") invalidResponse("The environment scope inventory is invalid.");
    const machineId = item.machine_id === undefined ? undefined : typeof item.machine_id === "string" && SAFE_IDENTIFIER.test(item.machine_id) ? item.machine_id : invalidResponse("The environment scope inventory has an invalid machine ID.");
    if (item.scope === "global" && (machineId !== undefined || item.scope_state !== "active")) invalidResponse("The environment scope inventory has an invalid global scope.");
    if (item.scope === "machine" && machineId === undefined) invalidResponse("The environment scope inventory has an invalid machine scope.");
    if (!Array.isArray(item.names) || item.names.length > 128 || item.names.some((name) => typeof name !== "string")) invalidResponse("The environment scope inventory has invalid names.");
    const names = item.names.map((name) => safeName(name));
    if (names.some((name, index) => index > 0 && names[index - 1] >= name) || new Set(names.map((name) => name.toUpperCase())).size !== names.length) invalidResponse("The environment scope inventory has unsorted names.");
    return { scope: item.scope, machine_id: machineId, scope_state: item.scope_state, version: safeInteger(item.version, "scope version", false), key_epoch: safeInteger(item.key_epoch, "key epoch", false), manifest_id: safeDigest(item.manifest_id, "manifest ID"), names } as EnvironmentScopeInventoryItem;
  });
  if (scopes.length > 0 && (scopes[0].scope !== "global" || scopes.some((scope, index) => index > 0 && (scope.scope !== "machine" || !scope.machine_id || scope.machine_id <= (scopes[index - 1].machine_id ?? ""))))) invalidResponse("The environment scope inventory is not sorted.");
  return { schema: "paperboat.environment-scope-inventory/v1", scopes };
}

export async function getEnvironmentAuthority(): Promise<EnvironmentAuthorityState> {
  let responseETag: string | undefined;
  const payload = await pbFetch<unknown>("/v1/environment-authority", { cache: "no-store", noRetry: true, onResponse: (response) => { responseETag = response.headers.get("etag") ?? undefined; } });
  const root = asRecord(payload, "authority state");
  requireFields(root, AUTHORITY_FIELDS, "authority state");
  if (root.schema !== "paperboat.environment-authority-state/v1") invalidResponse("The authority state schema is invalid.");
  const generation = safeInteger(root.generation, "authority generation", false);
  const authorityId = safeDigest(root.authority_id, "authority ID");
  const authority = safeBase64Url(root.authority, 2 * 1024 * 1024, "authority document");
  if (!responseETag || responseETag !== `"environment-authority-${generation}-${authorityId.slice(7)}"`) invalidResponse("The authority response is missing its exact ETag.");
  return { schema: "paperboat.environment-authority-state/v1", generation, authority_id: authorityId, authority, etag: responseETag };
}

export async function getEnvironmentAuthorityDocuments(afterGeneration = 0, afterId?: string): Promise<EnvironmentAuthorityPage> {
  if (!Number.isSafeInteger(afterGeneration) || afterGeneration < 0 || afterGeneration > Number.MAX_SAFE_INTEGER || afterGeneration === 0 && afterId !== undefined || afterGeneration > 0 && (!afterId || !SAFE_DIGEST_ID.test(afterId))) throw new Error("The authority cursor is invalid.");
  const query = new URLSearchParams({ after_generation: String(afterGeneration) });
  if (afterGeneration > 0) query.set("after_id", afterId!);
  const payload = await pbFetch<unknown>(`/v1/environment-authority/documents?${query.toString()}`, { cache: "no-store", noRetry: true });
  const root = asRecord(payload, "authority page");
  requireFields(root, AUTHORITY_PAGE_FIELDS, "authority page");
  const head = asRecord(root.authority_head, "authority head");
  requireFields(head, AUTHORITY_HEAD_FIELDS, "authority head");
  if (root.schema !== "paperboat.environment-authority-page/v1" || !Array.isArray(root.authority_documents) || typeof root.has_more !== "boolean") invalidResponse("The authority page is invalid.");
  const documents = root.authority_documents.map((value) => safeBase64Url(value, 2 * 1024 * 1024, "authority document"));
  const decodedBytes = documents.reduce((total, value) => total + Math.floor(value.length * 3 / 4), 0);
  if (documents.length > 4 || decodedBytes > 4 * 1024 * 1024 || root.has_more && documents.length === 0 || safeInteger(head.generation, "authority head generation", false) < afterGeneration || !SAFE_DIGEST_ID.test(String(head.authority_id))) invalidResponse("The authority page is invalid.");
  return { schema: "paperboat.environment-authority-page/v1", authority_head: { generation: safeInteger(head.generation, "authority head generation", false), authority_id: safeDigest(head.authority_id, "authority head ID") }, authority_documents: documents, has_more: root.has_more };
}

export async function getEnvironmentManifest(target: EnvironmentVariableTarget): Promise<EnvironmentManifestState> {
  const machineId = targetMachineId(target);
  let responseETag: string | undefined;
  const payload = await pbFetch<unknown>(machineId === null ? "/v1/environment-manifests/global" : `/v1/environment-manifests/machines/${encodeURIComponent(machineId)}`, { cache: "no-store", noRetry: true, onResponse: (response) => { responseETag = response.headers.get("etag") ?? undefined; } });
  const root = asRecord(payload, "manifest state");
  requireFields(root, MANIFEST_STATE_FIELDS, "manifest state");
  if (root.schema !== "paperboat.environment-manifest-state/v1" || root.scope !== target.scope) invalidResponse("The environment manifest state is invalid.");
  const envelope = safeBase64Url(root.envelope, MAX_MANIFEST_ENVELOPE_BYTES, "manifest envelope");
  const responseMachine = responseMachineId(root.machine_id, target);
  const version = safeInteger(root.version, "manifest version", false);
  const keyEpoch = safeInteger(root.key_epoch, "manifest key epoch", false);
  const manifestId = safeDigest(root.manifest_id, "manifest ID");
  const etag = requireETag(target, responseETag, version);
  return { schema: "paperboat.environment-manifest-state/v1", scope: target.scope, machine_id: responseMachine ?? undefined, version, key_epoch: keyEpoch, manifest_id: manifestId, envelope, etag };
}

export async function putEnvironmentManifest(target: EnvironmentVariableTarget, mutation: EnvironmentManifestMutation, etag: string): Promise<EnvironmentManifestState> {
  const machineId = targetMachineId(target);
  if (mutation.schema !== "paperboat.environment-manifest-mutation/v1" || !Number.isSafeInteger(mutation.expected_version) || mutation.expected_version < 1 || !SAFE_OPERATION_ID.test(mutation.operation_id) || typeof mutation.envelope !== "string") throw new Error("The environment manifest mutation is invalid.");
  safeBase64Url(mutation.envelope, MAX_MANIFEST_ENVELOPE_BYTES, "manifest envelope");
  const expectedETag = environmentVariableETag(target, mutation.expected_version);
  if (etag !== expectedETag) throw new Error("The current environment ETag is unavailable.");
  try {
    let responseETag: string | undefined;
    const payload = await pbFetch<unknown>(machineId === null ? "/v1/environment-manifests/global" : `/v1/environment-manifests/machines/${encodeURIComponent(machineId)}`, { method: "PUT", body: mutation, headers: { "if-match": expectedETag }, cache: "no-store", noRetry: true, idempotencyKey: mutation.operation_id, onResponse: (response) => { responseETag = response.headers.get("etag") ?? undefined; } });
    const root = asRecord(payload, "manifest state");
    requireFields(root, MANIFEST_STATE_FIELDS, "manifest state");
    if (root.schema !== "paperboat.environment-manifest-state/v1" || root.scope !== target.scope) invalidResponse("The environment manifest response is invalid.");
    const envelope = safeBase64Url(root.envelope, MAX_MANIFEST_ENVELOPE_BYTES, "manifest envelope");
    if (envelope !== mutation.envelope) invalidResponse("The environment manifest response is invalid.");
    const responseMachine = responseMachineId(root.machine_id, target);
    const version = safeInteger(root.version, "manifest version", false);
    if (version !== mutation.expected_version + 1) invalidResponse("The environment manifest response has an invalid version.");
    const keyEpoch = safeInteger(root.key_epoch, "manifest key epoch", false);
    const manifestId = safeDigest(root.manifest_id, "manifest ID");
    const responseEtag = requireETag(target, responseETag, version);
    return { schema: "paperboat.environment-manifest-state/v1", scope: target.scope, machine_id: responseMachine ?? undefined, version, key_epoch: keyEpoch, manifest_id: manifestId, envelope, etag: responseEtag };
  } catch (error) {
    if (error instanceof ApiError) throw new ApiError(error.code, "The encrypted environment update could not be saved. Refresh and retry.", error.status, error.requestId);
    throw error;
  }
}

/** Browser enrollment request transport. It accepts only public keys/proofs. */
export async function requestEnvironmentEnrollment(body: Record<string, unknown>, idempotencyKey?: string): Promise<EnvironmentEnrollmentState> {
  if (Object.keys(body).some((key) => ["value", "values", "plaintext", "secret", "scope_key", "decryption_key"].includes(key))) throw new Error("Environment enrollment cannot contain plaintext values.");
  return normalizeEnrollmentState(await pbFetch<unknown>("/v1/environment-key-enrollments", { method: "POST", body, cache: "no-store", noRetry: true, idempotencyKey }));
}

export async function proveEnvironmentEnrollment(requestId: string, proof: string): Promise<EnvironmentEnrollmentState> {
  if (!SAFE_IDENTIFIER.test(requestId) || !/^[A-Za-z0-9_-]{43}$/.test(proof)) throw new Error("The environment enrollment proof is invalid.");
  return normalizeEnrollmentState(await pbFetch<unknown>(`/v1/environment-key-enrollments/${encodeURIComponent(requestId)}/proof`, { method: "PUT", body: { schema: "paperboat.environment-key-enrollment-proof/v1", proof }, cache: "no-store", noRetry: true }));
}
