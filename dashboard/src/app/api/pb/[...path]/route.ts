import {
  buildServerRequest,
  fetchPaperboatServer,
  relayResponse,
} from "@/lib/api/server";

export const dynamic = "force-dynamic";

const ENV_FORBIDDEN_KEYS = new Set(["value", "values", "plaintext", "secret", "scope_key", "decryption_key"]);
const ENV_OPERATION_ID = /^envop_[0-9a-f]{32}$/;
const ENV_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const ENV_BASE64URL = /^[A-Za-z0-9_-]+$/;
const ENV_DIGEST = /^sha256:[0-9a-f]{64}$/;
const ENV_MAX_MANIFEST_JSON = (14 * 1024 * 1024) / 10;
const ENV_MAX_AUTHORITY_JSON = 3 * 1024 * 1024;
const ENV_MAX_ENROLLMENT_JSON = 32 * 1024;
const ENV_MAX_PROOF_JSON = 1024;
const ENV_RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

type EnvironmentRouteKind =
  | "metadata"
  | "inventory"
  | "authority"
  | "authority-documents"
  | "transition"
  | "transition-state"
  | "transition-abort"
  | "transition-manifest"
  | "manifest"
  | "enrollment"
  | "enrollment-pending"
  | "enrollment-proof"
  | "enrollment-approve";

interface RoutePolicy { kind: EnvironmentRouteKind; maxBody: number; methods: readonly string[]; }

function environmentPolicy(path: string): RoutePolicy | undefined {
  if (path === "/v1/environment-variables" || /^\/v1\/environment-variables\/[^/]+$/.test(path) || /^\/v1\/machines\/[^/]+\/environment-variables(?:\/[^/]+)?$/.test(path)) return { kind: "metadata", maxBody: 0, methods: ["GET"] };
  if (path === "/v1/environment-scopes") return { kind: "inventory", maxBody: 0, methods: ["GET"] };
  if (path === "/v1/environment-authority") return { kind: "authority", maxBody: 0, methods: ["GET"] };
  if (path === "/v1/environment-authority/documents") return { kind: "authority-documents", maxBody: 0, methods: ["GET"] };
  if (path === "/v1/environment-authority/transitions") return { kind: "transition", maxBody: ENV_MAX_AUTHORITY_JSON, methods: ["POST"] };
  if (/^\/v1\/environment-authority\/transitions\/[^/]+$/.test(path)) return { kind: "transition-state", maxBody: 0, methods: ["GET"] };
  if (/^\/v1\/environment-authority\/transitions\/[^/]+\/abort$/.test(path)) return { kind: "transition-abort", maxBody: ENV_MAX_AUTHORITY_JSON, methods: ["POST"] };
  if (/^\/v1\/environment-authority\/transitions\/[^/]+\/scopes\/(?:global|machines\/[^/]+)$/.test(path)) return { kind: "transition-manifest", maxBody: ENV_MAX_MANIFEST_JSON, methods: ["PUT"] };
  if (path === "/v1/environment-manifests/global" || /^\/v1\/environment-manifests\/machines\/[^/]+$/.test(path)) return { kind: "manifest", maxBody: ENV_MAX_MANIFEST_JSON, methods: ["GET", "PUT"] };
  if (path === "/v1/environment-key-enrollments") return { kind: "enrollment", maxBody: ENV_MAX_ENROLLMENT_JSON, methods: ["POST"] };
  if (path === "/v1/environment-key-enrollments/pending") return { kind: "enrollment-pending", maxBody: 0, methods: ["GET"] };
  if (/^\/v1\/environment-key-enrollments\/[^/]+\/proof$/.test(path)) return { kind: "enrollment-proof", maxBody: ENV_MAX_PROOF_JSON, methods: ["PUT"] };
  if (/^\/v1\/environment-key-enrollments\/[^/]+\/approve$/.test(path)) return { kind: "enrollment-approve", maxBody: ENV_MAX_AUTHORITY_JSON, methods: ["POST"] };
  return undefined;
}

function isEnvironmentPath(path: string): boolean {
  return path === "/v1/environment-scopes" || path.startsWith("/v1/environment-") || path.startsWith("/v1/machines/") && path.includes("/environment-variables");
}

function invalidEnvironment(message = "The environment request is invalid."): Response {
  return Response.json({ error: { code: "invalid_environment_request", message } }, { status: 400, headers: { "cache-control": "no-store" } });
}

function allowedKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const expected = new Set(keys);
  return Object.keys(value).every((key) => expected.has(key)) && Object.keys(value).length === expected.size;
}

function hasForbiddenKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasForbiddenKey);
  return Object.entries(value).some(([key, child]) => ENV_FORBIDDEN_KEYS.has(key) || hasForbiddenKey(child));
}

function validBase64Url(value: unknown, maximumBytes: number, exactBytes?: number): value is string {
  if (typeof value !== "string" || value.length === 0 || value.includes("=") || !ENV_BASE64URL.test(value) || value.length > Math.ceil(maximumBytes * 4 / 3) + 4) return false;
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  let binary: string;
  try { binary = atob(padded); } catch { return false; }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (bytes.length === 0 || bytes.length > maximumBytes || exactBytes !== undefined && bytes.length !== exactBytes) return false;
  let canonical = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) canonical += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(canonical).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "") === value;
}

function validEnvironmentExpiry(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 64 || !ENV_RFC3339.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const hour = Number(value.slice(11, 13));
  const minute = Number(value.slice(14, 16));
  const second = Number(value.slice(17, 19));
  const zone = value.slice(-1) === "Z" ? "Z" : value.slice(-6);
  const offsetHour = zone === "Z" ? 0 : Number(zone.slice(1, 3));
  const offsetMinute = zone === "Z" ? 0 : Number(zone.slice(4, 6));
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth || hour > 23 || minute > 59 || second > 59 || offsetHour > 23 || offsetMinute > 59) return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && milliseconds >= 0 && milliseconds % 1000 === 0;
}

function validateOpaqueJSON(policy: EnvironmentRouteKind, raw: ArrayBuffer): boolean {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)) as unknown;
  } catch {
    return false;
  }
  if (!value || typeof value !== "object" || Array.isArray(value) || hasForbiddenKey(value)) return false;
  const body = value as Record<string, unknown>;
  if (policy === "manifest" || policy === "transition-manifest") {
    const schema = policy === "manifest" ? "paperboat.environment-manifest-mutation/v1" : "paperboat.environment-transition-manifest/v1";
    const minimumVersion = policy === "manifest" ? 1 : 0;
    if (!allowedKeys(body, ["schema", "expected_version", "operation_id", "envelope"]) || body.schema !== schema || typeof body.expected_version !== "number" || !Number.isSafeInteger(body.expected_version) || body.expected_version < minimumVersion || !ENV_OPERATION_ID.test(String(body.operation_id)) || !validBase64Url(body.envelope, 1 << 20)) return false;
    return true;
  }
  if (policy === "enrollment-proof") return allowedKeys(body, ["schema", "proof"]) && body.schema === "paperboat.environment-key-enrollment-proof/v1" && validBase64Url(body.proof, 32, 32);
  if (policy === "enrollment") {
    const required = ["schema", "operation_id", "subject_kind", "subject_id", "subject_generation", "key_generation", "endpoint_certificate", "signing_public_key", "signing_key_id", "signing_proof", "recipient_public_key", "recipient_key_id", "binding_not_after", "request_expires_at"];
    if (!allowedKeys(body, required) || body.schema !== "paperboat.environment-key-enrollment/v1" || typeof body.operation_id !== "string" || !ENV_OPERATION_ID.test(body.operation_id) || !["manager_cli", "manager_browser", "host"].includes(String(body.subject_kind)) || typeof body.subject_id !== "string" || !ENV_IDENTIFIER.test(body.subject_id) || typeof body.subject_generation !== "number" || typeof body.key_generation !== "number" || !Number.isSafeInteger(body.subject_generation) || !Number.isSafeInteger(body.key_generation) || body.subject_generation < 1 || body.key_generation < 1 || body.binding_not_after !== null || !validBase64Url(body.recipient_public_key, 32, 32) || typeof body.recipient_key_id !== "string" || !/^envk_[A-Za-z0-9_-]{43}$/.test(body.recipient_key_id) || !validEnvironmentExpiry(body.request_expires_at)) return false;
    const kind = body.subject_kind;
    if (kind === "manager_browser") {
      return body.endpoint_certificate === null && validBase64Url(body.signing_public_key, 32, 32) && typeof body.signing_key_id === "string" && /^sigk_[A-Za-z0-9_-]{43}$/.test(body.signing_key_id) && validBase64Url(body.signing_proof, 64, 64);
    }
    if (kind === "manager_cli") {
      return validBase64Url(body.endpoint_certificate, 8192) && validBase64Url(body.signing_public_key, 32, 32) && typeof body.signing_key_id === "string" && /^sigk_[A-Za-z0-9_-]{43}$/.test(body.signing_key_id) && validBase64Url(body.signing_proof, 64, 64);
    }
    return validBase64Url(body.endpoint_certificate, 8192) && body.signing_public_key === null && body.signing_key_id === null && body.signing_proof === null;
  }
  if (policy === "transition") return allowedKeys(body, ["schema", "expected_authority_id", "operation_id", "authority"]) && body.schema === "paperboat.environment-authority-transition/v1" && typeof body.expected_authority_id === "string" && ENV_DIGEST.test(body.expected_authority_id) && ENV_OPERATION_ID.test(String(body.operation_id)) && typeof body.authority === "string" && ENV_BASE64URL.test(body.authority);
  if (policy === "transition-abort") return allowedKeys(body, ["schema", "expected_transition_id", "operation_id", "authorization"]) && body.schema === "paperboat.environment-authority-transition-abort/v1" && typeof body.expected_transition_id === "string" && ENV_DIGEST.test(body.expected_transition_id) && ENV_OPERATION_ID.test(String(body.operation_id)) && typeof body.authorization === "string" && ENV_BASE64URL.test(body.authorization);
  if (policy === "enrollment-approve") return allowedKeys(body, ["schema", "expected_authority_id", "operation_id", "binding", "authority"]) && body.schema === "paperboat.environment-key-approval/v1" && (body.expected_authority_id === null || typeof body.expected_authority_id === "string" && ENV_DIGEST.test(body.expected_authority_id)) && ENV_OPERATION_ID.test(String(body.operation_id)) && typeof body.binding === "string" && ENV_BASE64URL.test(body.binding) && typeof body.authority === "string" && ENV_BASE64URL.test(body.authority);
  return false;
}

async function handle(req: Request, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await ctx.params;
  const encodedPath = "/" + path.map((part) => encodeURIComponent(part)).join("/");
  const policy = environmentPolicy(encodedPath);
  if (isEnvironmentPath(encodedPath) && !policy) return invalidEnvironment("The environment route is not supported.");
  if (!policy) {
    const search = new URL(req.url).search;
    const body = req.method !== "GET" && req.method !== "HEAD" ? await req.arrayBuffer() : null;
    const outbound = buildServerRequest(encodedPath + search, req, body && body.byteLength > 0 ? body : null);
    let serverRes: Response;
    try { serverRes = await fetchPaperboatServer(outbound); } catch { return Response.json({ error: { code: "provider_unavailable", message: "The Paperboat control plane is unreachable." } }, { status: 502 }); }
    return relayResponse(serverRes, serverRes.body);
  }
  if (!policy.methods.includes(req.method)) return invalidEnvironment("The environment method is not supported.");
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (!Number.isFinite(contentLength) || contentLength < 0 || contentLength > policy.maxBody) return invalidEnvironment("The environment request is too large.");
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? await req.arrayBuffer() : new ArrayBuffer(0);
  if (body.byteLength > policy.maxBody || hasBody && body.byteLength === 0 || hasBody && !validateOpaqueJSON(policy.kind, body)) return invalidEnvironment();
  const search = new URL(req.url).search;
  const outbound = buildServerRequest(encodedPath + search, req, body.byteLength > 0 ? body : null);
  outbound.headers.set("cache-control", "no-store");
  outbound.headers.set("pragma", "no-cache");
  let serverRes: Response;
  try { serverRes = await fetchPaperboatServer(outbound, undefined, { noRetry: true }); } catch { return Response.json({ error: { code: "provider_unavailable", message: "The Paperboat control plane is unreachable." } }, { status: 502, headers: { "cache-control": "no-store" } }); }
  const relayed = relayResponse(serverRes, serverRes.body);
  relayed.headers.set("cache-control", "no-store");
  relayed.headers.set("pragma", "no-cache");
  return relayed;
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
