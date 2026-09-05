/**
 * Typed browser client for the preview-tunnel-v1 contract.
 *
 * This module intentionally owns the v1 boundary instead of widening
 * unrelated browser clients. The browser talks to paperboat-server through the dashboard
 * BFF, keeps one correlation ID for a workflow, and never accepts reusable
 * credentials in a response.
 *
 * Verify changes against the server API and repository-local preview/tunnel
 * fixtures in testdata/contracts/preview-tunnel-v1.
 */

export const PREVIEW_TUNNEL_SCHEMA = "paperboat.preview-tunnel/v1" as const;
export const PREVIEW_TUNNEL_BFF_BASE = "/api/pb";

export type V1Schema = typeof PREVIEW_TUNNEL_SCHEMA;
export type AccessMode = "public" | "private";
export type PreviewLeaseState =
  | "allocating"
  | "connecting"
  | "ready"
  | "owner_disconnected"
  | "expired"
  | "stopped";
export type TunnelDesiredState = "active" | "paused" | "deleted";
export type Protocol = "http" | "tcp_private";
export type EventResourceKind =
  | "preview_lease"
  | "tunnel"
  | "route"
  | "domain_binding"
  | "connector"
  | "config_generation"
  | "operation";
export type V1ResourceKind =
  | EventResourceKind
  | "health"
  | "error"
  | "event";
export type ErrorComponent =
  | "service"
  | "edge"
  | "config"
  | "route"
  | "origin"
  | "dns"
  | "certificate"
  | "access"
  | "update"
  | "control";
export type ErrorOutcome = "unchanged" | "changed" | "uncertain";
export type OperationPhase =
  | "validating"
  | "persisting"
  | "waiting_for_dns"
  | "issuing_certificate"
  | "installing_service"
  | "connecting"
  | "checking_origin"
  | "draining"
  | "rolling_back"
  | "ready"
  | "failed";
export type OperationState =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled";

export interface PreviewTarget {
  scheme: "http" | "https" | "h2c" | "unix" | "tcp";
  address: string;
}

export interface PreviewLease {
  schema: V1Schema;
  kind: "preview_lease";
  id: string;
  account_id: string;
  actor_id: string;
  owner_device_id: string;
  owner_session_id: string;
  target: PreviewTarget;
  access_mode: AccessMode;
  persistent: false;
  endpoint: string;
  lease_deadline: string;
  user_deadline?: string | null;
  state: PreviewLeaseState;
  allocation_state: "pending" | "ready" | "failed" | "released";
  edge_state: "pending" | "ready" | "degraded" | "down";
  origin_state: "unknown" | "ready" | "unavailable";
  created_at: string;
  last_renewed_at: string;
  /** Custom aliases are metadata-only and never include certificate secrets. */
  domains: PreviewDomainSummary[];
}

/** A read resource plus the strong ETag supplied by the control plane. */
export interface PreviewLeaseWithETag {
  preview: PreviewLease;
  etag: string;
}

export interface Tunnel {
  schema: V1Schema;
  kind: "tunnel";
  id: string;
  account_id: string;
  name: string;
  desired_state: TunnelDesiredState;
  access_mode: AccessMode;
  generation: number;
  etag: string;
  stable_endpoint_id: string;
  stable_endpoint: string;
  created_by_host_id: string;
  created_by_actor_id: string;
  expires_at: string | null;
  summary_code: string;
  created_at: string;
  updated_at: string;
}

export interface OriginTLS {
  verification: "not_applicable" | "system" | "custom_ca" | "insecure_development";
  server_name?: string | null;
  ca_reference?: string | null;
  client_credential_reference?: string | null;
}

export interface RouteOrigin {
  scheme: "http" | "https" | "h2c" | "unix" | "tcp";
  address: string;
  preserve_host: boolean;
  host_override?: string | null;
  tls?: OriginTLS;
}

export interface RouteHostMatch {
  type: "managed_exact" | "exact" | "one_label_wildcard" | "catch_all";
  hostname?: string;
  wildcard_labels?: 1;
}

export interface TunnelRoute {
  schema: V1Schema;
  kind: "route";
  id: string;
  tunnel_id: string;
  name: string;
  protocol: Protocol;
  host_match: RouteHostMatch;
  path_prefix?: string | null;
  origin: RouteOrigin;
  priority: number;
  connect_timeout_ms: number;
  idle_timeout_ms: number;
  max_concurrent_streams: number;
  desired_state: "active" | "disabled" | "deleted";
  generation: number;
  etag: string;
}

export interface DomainBinding {
  schema: V1Schema;
  kind: "domain_binding";
  id: string;
  account_id: string;
  target_kind: "tunnel_route" | "preview_lease";
  tunnel_id?: string;
  route_id?: string;
  preview_id?: string;
  hostname: string;
  match_type: "exact" | "one_label_wildcard";
  wildcard_labels?: 1;
  state:
    | "requested"
    | "waiting_dns"
    | "verified"
    | "issuing_tls"
    | "ready"
    | "conflict"
    | "dns_error"
    | "tls_error"
    | "expired"
    | "quarantined";
  dns: {
    target: string;
    observed_records?: string[];
    last_checked_at?: string;
  };
  certificate: {
    state:
      | "not_requested"
      | "issuing"
      | "ready"
      | "renewing"
      | "failed"
      | "expired"
      | "revoked";
    reference?: string;
    expires_at?: string;
    failure?: Record<string, unknown> | null;
  };
  generation: number;
  etag: string;
  instructions?: DNSInstructions;
}

/** The bounded preview alias projection returned by preview domain endpoints. */
export interface PreviewDomainSummary {
  id: string;
  target_kind: "preview_lease";
  preview_id: string;
  hostname: string;
  match_type: "exact" | "one_label_wildcard";
  wildcard_labels?: 1;
  state: DomainState;
  dns: DNSState;
  certificate: CertificateState;
  generation: number;
  etag: string;
  instructions?: DNSInstructions;
}

export type DomainState =
  | "requested"
  | "waiting_dns"
  | "verified"
  | "issuing_tls"
  | "ready"
  | "conflict"
  | "dns_error"
  | "tls_error"
  | "expired"
  | "quarantined"
  | "released";

export interface DNSState {
  target: string;
  observed_records?: string[];
  last_checked_at?: string;
}

export interface CertificateState {
  state: "not_requested" | "issuing" | "ready" | "renewing" | "failed" | "expired" | "revoked";
  reference?: string;
  expires_at?: string;
  failure?: SafeMetadata | null;
}

export interface Connector {
  schema: V1Schema;
  kind: "connector";
  id: string;
  tunnel_id: string;
  host_id: string;
  credential_reference: string;
  rotation_generation: number;
  desired_state: "active" | "draining" | "revoked";
  software_version?: string;
  protocol_version: "1.0";
  last_session_id?: string;
  last_heartbeat_at?: string;
  operating_system?: string;
  architecture?: string;
  ready_at?: string;
  last_applied_config_generation?: number;
  drain_state: "accepting" | "draining" | "drained" | "forced_closed";
  generation: number;
  etag: string;
}

export interface LogEntry {
  schema: V1Schema;
  kind: "log_entry";
  id: string;
  tunnel_id?: string;
  preview_id?: string;
  route_id?: string;
  connector_id?: string;
  session_id?: string;
  level: "debug" | "info" | "warn" | "error";
  component: string;
  code: string;
  message: string;
  metadata: SafeMetadata;
  correlation_id: string;
  occurred_at: string;
  cursor: string;
}

export interface DNSRecordInstruction {
  name: string;
  type: "CNAME";
  value: string;
  ttl: number;
}

export interface DNSInstructions {
  schema: V1Schema;
  kind: "dns_instructions";
  tunnel_id: string;
  domain_id: string;
  hostname: string;
  provider: string;
  records: DNSRecordInstruction[];
  certificate_strategy: string;
  verification_state:
    | "requested"
    | "waiting_dns"
    | "verified"
    | "issuing_tls"
    | "ready"
    | "conflict"
    | "dns_error"
    | "tls_error"
    | "expired"
    | "quarantined";
  note: string;
  target_kind?: "tunnel_route" | "preview_lease";
  preview_id?: string;
}

export interface OperationError {
  schema: V1Schema;
  kind: "error";
  code: string;
  component: ErrorComponent;
  message: string;
  outcome: ErrorOutcome;
  retryable: boolean;
  retry_at?: string | null;
  repair_action: string;
  request_id: string;
  correlation_id: string;
  details?: SafeMetadata;
}

export interface Operation {
  schema: V1Schema;
  kind: "operation";
  id: string;
  resource_kind: "preview_lease" | "tunnel" | "route" | "domain_binding" | "connector";
  resource_id: string;
  phase: OperationPhase;
  state: OperationState;
  progress: number;
  retrying: boolean;
  next_retry_at?: string | null;
  error?: OperationError | null;
  correlation_id: string;
  created_at: string;
  updated_at: string;
}

export interface EventActor {
  type: "user" | "host" | "system" | "edge";
  id: string;
}

export type SafeMetadata = Record<string, unknown>;

export interface V1Event {
  schema: V1Schema;
  kind: "event";
  id: string;
  cursor: string;
  event_type: string;
  resource_kind: EventResourceKind;
  resource_id: string;
  occurred_at: string;
  actor: EventActor;
  correlation_id: string;
  safe_metadata: SafeMetadata;
}

export interface HealthDimension {
  status: "unknown" | "ready" | "degraded" | "down" | "not_applicable";
  code: string;
}

export interface Health {
  schema: V1Schema;
  kind: "health";
  resource_kind: "preview_lease" | "tunnel" | "route" | "domain_binding" | "connector";
  resource_id: string;
  overall_code: string;
  dimensions: Record<
    "service" | "edge" | "config" | "route" | "origin" | "dns" | "certificate" | "access" | "update",
    HealthDimension
  >;
  summary: string;
  since: string;
  retrying: boolean;
  next_retry_at?: string | null;
  repair_action: string;
  correlation_id: string;
}

export type V1Resource =
  | PreviewLease
  | Tunnel
  | TunnelRoute
  | DomainBinding
  | Connector
  | LogEntry
  | DNSInstructions
  | Operation
  | Health
  | V1Event
  | OperationError;

export interface V1Page<T> {
  items: T[];
  next_cursor?: string | null;
}

export interface PreviewCreateInput {
  owner_device_id: string;
  owner_session_id: string;
  target: PreviewTarget;
  access_mode: AccessMode;
  expires_at?: string | null;
  domains?: string[];
}

export interface TunnelCreateInput {
  name: string;
  access_mode?: AccessMode;
  origin: RouteOrigin;
  expires_at?: string | null;
  domains?: string[];
}

export interface TunnelPatchInput {
  name?: string;
  access_mode?: AccessMode;
  expires_at?: string | null;
}

export interface RouteCreateInput {
  name: string;
  protocol: Protocol;
  host_match: RouteHostMatch;
  path_prefix?: string | null;
  origin: RouteOrigin;
  priority?: number;
  connect_timeout_ms?: number;
  idle_timeout_ms?: number;
  max_concurrent_streams?: number;
}

export type RoutePatchInput = Partial<RouteCreateInput> & {
  desired_state?: "active" | "disabled" | "deleted";
};

export interface DomainCreateInput {
  hostname: string;
  route_id: string;
  provider?: string;
  certificate_strategy?: "managed" | "on_demand_leaf";
}

export interface PreviewDomainCreateInput {
  hostname: string;
  provider?: string;
  certificate_strategy?: "managed" | "on_demand_leaf";
}

/** Enrollment remains host-only because its response contains a one-time
 * credential. The browser deliberately has no enrollment response model. */
export const TRK07_CLIENT_CONTRACT_DEPENDENCIES = [
  {
    endpoint: "/v1/tunnels/{tunnelId}/connectors/enrollments",
    reason: "The endpoint issues a single-use credential, so the browser must not consume or model its response.",
  },
] as const;

export interface MutationOptions extends RequestOptions {
  /** Required for updates and destructive state changes. */
  ifMatch?: string;
  /** Reuse this key when retrying an uncertain mutation. */
  idempotencyKey?: string;
}

export interface RequestOptions {
  signal?: AbortSignal;
  correlationId?: string;
  maxAttempts?: number;
  retryBaseDelayMs?: number;
  retryMaxDelayMs?: number;
}

export interface ListOptions extends RequestOptions {
  cursor?: string;
  limit?: number;
}

export interface LogListOptions extends ListOptions {
  level?: LogEntry["level"];
  component?: string;
  code?: string;
  since?: string;
}

export interface EventListOptions extends ListOptions {
  resourceKind?: EventResourceKind;
}

export interface RetryInfo {
  attempt: number;
  delayMs: number;
  error: PreviewTunnelError;
}

export interface ClientOptions {
  /** Keep the default on the same-origin BFF. A full URL is allowed in tests. */
  basePath?: string;
  fetchImpl?: FetchLike;
  sleep?: SleepLike;
  random?: () => number;
  makeRequestId?: () => string;
  correlationId?: string;
  maxAttempts?: number;
  retryBaseDelayMs?: number;
  retryMaxDelayMs?: number;
}

export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;
export type SleepLike = (milliseconds: number, signal?: AbortSignal) => Promise<void>;

export interface EventSubscriptionOptions extends RequestOptions {
  /** Cursor of the last event the caller has durably consumed. */
  cursor?: string;
  maxReconnectAttempts?: number;
  onEvent?: (event: V1Event) => void | Promise<void>;
  onRetry?: (info: RetryInfo) => void;
  onError?: (error: PreviewTunnelError) => void;
}

export interface LiveEventSubscription {
  readonly correlationId: string;
  readonly done: Promise<void>;
  getCursor(): string | undefined;
  close(): void;
}

export interface OperationWatchOptions extends RequestOptions {
  pollIntervalMs?: number;
  maxPollIntervalMs?: number;
  onProgress?: (operation: Operation) => void;
  onRetry?: (info: RetryInfo) => void;
}

export interface OperationWatcher {
  readonly done: Promise<Operation>;
  stop(): void;
  cancelRemote(): Promise<Operation>;
}

const SAFE_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const SAFE_MAX_DEPTH = 40;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_MS = 250;
const DEFAULT_RETRY_MAX_MS = 5_000;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 8;
const DEFAULT_POLL_INTERVAL_MS = 500;
const DEFAULT_MAX_POLL_INTERVAL_MS = 5_000;
const MAX_PAGE_LIMIT = 200;
const MAX_SSE_BUFFER_BYTES = 512 * 1024;
const MAX_SSE_EVENT_BYTES = 256 * 1024;
const MAX_SEEN_EVENT_KEYS = 1_024;

const ALLOWED_REFERENCE_KEYS = new Set([
  "credentialreference",
  "clientcredentialreference",
  "careference",
  "certificatereference",
  "snapshotreference",
]);

const FORBIDDEN_KEYS = new Set([
  "accesstoken",
  "apikey",
  "authorization",
  "bearertoken",
  "bootstrapmaterial",
  "bootstraptoken",
  "clientkey",
  "clientsecret",
  "cookie",
  "headers",
  "password",
  "privatekey",
  "refreshtoken",
  "requestbody",
  "requestheaders",
  "responsebody",
  "responseheaders",
  "secret",
  "sessiontoken",
  "setcookie",
  "sharetoken",
  "token",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isForbiddenResponseKey(key: string): boolean {
  const normalized = normalizeKey(key);
  if (ALLOWED_REFERENCE_KEYS.has(normalized)) return false;
  if (FORBIDDEN_KEYS.has(normalized)) return true;
  return (
    normalized.includes("token") ||
    normalized.includes("secret") ||
    normalized.endsWith("accesstoken") ||
    normalized.endsWith("refreshtoken") ||
    normalized.endsWith("sessiontoken") ||
    normalized.endsWith("secret") ||
    normalized.endsWith("privatekey") ||
    normalized.endsWith("password")
  );
}

function isCredentialLikeString(value: string): boolean {
  const trimmed = value.trim();
  if (/^bearer\s+\S+/i.test(trimmed)) return true;
  if (/-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----/.test(trimmed)) return true;
  if (/^ey[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+$/i.test(trimmed)) return true;
  if (/(?:token|secret|password|authorization)\s*[:=]\s*\S+/i.test(trimmed)) return true;
  return false;
}

/**
 * Validate decoded JSON before inspecting or returning it. This is deliberately
 * stricter than the TypeScript types because an unknown response field is still
 * capable of leaking a credential into a dashboard component or browser log.
 */
export function assertSecretSafe(value: unknown, depth = 0): asserts value is SafeJSON {
  if (depth > SAFE_MAX_DEPTH) {
    throw new SecretExposureError();
  }
  if (typeof value === "string") {
    if (isCredentialLikeString(value)) throw new SecretExposureError();
    return;
  }
  if (value === null || typeof value === "boolean" || typeof value === "number") return;
  if (Array.isArray(value)) {
    for (const child of value) assertSecretSafe(child, depth + 1);
    return;
  }
  if (!isRecord(value)) throw new SecretExposureError();
  for (const [key, child] of Object.entries(value)) {
    if (isForbiddenResponseKey(key)) throw new SecretExposureError();
    if (typeof child === "string" && /^https?:\/\//i.test(child)) {
      try {
        const url = new URL(child);
        if (url.username || url.password) throw new SecretExposureError();
        for (const queryKey of url.searchParams.keys()) {
          if (isForbiddenResponseKey(queryKey)) throw new SecretExposureError();
        }
      } catch (error) {
        if (error instanceof SecretExposureError) throw error;
      }
    }
    assertSecretSafe(child, depth + 1);
  }
}

type SafeJSON = string | number | boolean | null | SafeJSON[] | { [key: string]: SafeJSON };

export class SecretExposureError extends Error {
  readonly code = "secret_field_forbidden";
  readonly status = 0;
  readonly retryable = false;

  constructor() {
    super("The server returned credential material, so the response was rejected.");
    this.name = "SecretExposureError";
  }
}

export interface PreviewTunnelErrorFields {
  code: string;
  message: string;
  status: number;
  component: ErrorComponent;
  outcome: ErrorOutcome;
  retryable: boolean;
  retryAt?: string | null;
  repairAction: string;
  requestId?: string;
  correlationId?: string;
  details?: SafeMetadata;
  retryAfterMs?: number;
}

export class PreviewTunnelError extends Error {
  readonly code: string;
  readonly status: number;
  readonly component: ErrorComponent;
  readonly outcome: ErrorOutcome;
  readonly retryable: boolean;
  readonly retryAt: string | null;
  readonly repairAction: string;
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly details?: SafeMetadata;
  readonly retryAfterMs?: number;

  constructor(fields: PreviewTunnelErrorFields) {
    super(fields.message);
    this.name = "PreviewTunnelError";
    this.code = fields.code;
    this.status = fields.status;
    this.component = fields.component;
    this.outcome = fields.outcome;
    this.retryable = fields.retryable;
    this.retryAt = fields.retryAt ?? null;
    this.repairAction = fields.repairAction;
    this.requestId = fields.requestId;
    this.correlationId = fields.correlationId;
    this.details = fields.details;
    this.retryAfterMs = fields.retryAfterMs;
  }

  get isConflict(): boolean {
    return this.status === 409 || this.status === 412 || this.code.includes("conflict");
  }
}

export class PreviewTunnelCanceledError extends PreviewTunnelError {
  constructor(correlationId?: string) {
    super({
      code: "canceled",
      message: "The Paperboat request was canceled before it completed.",
      status: 0,
      component: "control",
      outcome: "unchanged",
      retryable: false,
      repairAction: "retry_when_ready",
      correlationId,
    });
    this.name = "PreviewTunnelCanceledError";
  }
}

class PreviewTunnelProtocolError extends PreviewTunnelError {
  constructor(message: string, correlationId?: string) {
    super({
      code: "invalid_response",
      message,
      status: 0,
      component: "control",
      outcome: "unchanged",
      retryable: false,
      repairAction: "refresh_and_retry",
      correlationId,
    });
    this.name = "PreviewTunnelProtocolError";
  }
}

export function makeIdempotencyKey(prefix = "pb"): string {
  return `${prefix}_${secureUUID()}`;
}

export function makeCorrelationId(): string {
  return `cor_${secureUUID()}`;
}

export function isPreviewTunnelError(error: unknown): error is PreviewTunnelError {
  return error instanceof PreviewTunnelError;
}

export function validateIdempotencyKey(value: string): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 256 ||
    !/^[\x21-\x7e]+$/.test(value)
  ) {
    throw new PreviewTunnelError({
      code: "invalid_idempotency_key",
      message: "The idempotency key is invalid. Retry with a new ASCII key.",
      status: 0,
      component: "control",
      outcome: "unchanged",
      retryable: false,
      repairAction: "supply_a_valid_idempotency_key",
    });
  }
  return value;
}

export function validateStrongETag(value: string): string {
  if (
    typeof value !== "string" ||
    value.length < 3 ||
    value.length > 512 ||
    value.startsWith("W/") ||
    value[0] !== '"' ||
    value[value.length - 1] !== '"' ||
    value.includes(",") ||
    /[\r\n]/.test(value)
  ) {
    throw new PreviewTunnelError({
      code: "invalid_etag",
      message: "The resource version is invalid. Refresh the resource before retrying.",
      status: 0,
      component: "config",
      outcome: "unchanged",
      retryable: false,
      repairAction: "refresh_and_retry",
    });
  }
  return value;
}

export function retryDelayMs(
  attempt: number,
  baseDelayMs = DEFAULT_RETRY_BASE_MS,
  maxDelayMs = DEFAULT_RETRY_MAX_MS,
  random = Math.random,
): number {
  const safeAttempt = Math.max(1, Math.floor(attempt));
  const maximum = Math.max(0, maxDelayMs);
  const base = Math.max(0, Math.min(baseDelayMs, maximum));
  const cap = Math.min(maximum, base * 2 ** (safeAttempt - 1));
  const jitter = Math.max(0, Math.min(1, random()));
  return Math.floor(cap * jitter);
}

function secureUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  }
  throw new Error("A secure browser random source is required for Paperboat request IDs.");
}

function defaultSleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(new PreviewTunnelCanceledError());
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    const abort = () => {
      clearTimeout(timer);
      reject(new PreviewTunnelCanceledError());
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${name}=`));
  return match?.slice(name.length + 1);
}

function safeHeaderValue(value: string, field: string): string {
  if (!value || /[\r\n]/.test(value)) {
    throw new PreviewTunnelError({
      code: "invalid_request",
      message: `The ${field} is invalid.`,
      status: 0,
      component: "control",
      outcome: "unchanged",
      retryable: false,
      repairAction: "refresh_and_retry",
    });
  }
  return value;
}

function requestID(): string {
  return `req_${secureUUID()}`;
}

function normalizedCorrelationID(value: string | undefined): string {
  const candidate = value?.trim() || makeCorrelationId();
  return safeHeaderValue(candidate, "correlation ID");
}

function encodePathPart(value: string): string {
  if (!value || /[\r\n]/.test(value)) {
    throw new PreviewTunnelError({
      code: "invalid_request",
      message: "The resource identifier is invalid.",
      status: 0,
      component: "control",
      outcome: "unchanged",
      retryable: false,
      repairAction: "refresh_and_retry",
    });
  }
  return encodeURIComponent(value);
}

function buildQuery(path: string, values: Record<string, string | undefined>): string {
  const query = Object.entries(values)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value as string)}`)
    .join("&");
  if (!query) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${query}`;
}

function parseLimit(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 1 || value > MAX_PAGE_LIMIT) {
    throw new PreviewTunnelError({
      code: "invalid_limit",
      message: `Limit must be an integer between 1 and ${MAX_PAGE_LIMIT}.`,
      status: 0,
      component: "control",
      outcome: "unchanged",
      retryable: false,
      repairAction: "supply_a_valid_limit",
    });
  }
  return value;
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function isTerminalOperation(operation: Operation): boolean {
  return (
    operation.state === "succeeded" ||
    operation.state === "failed" ||
    operation.state === "canceled"
  );
}

function publicString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function publicID(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^[A-Za-z0-9._:-]{1,256}$/.test(value)) return undefined;
  return value;
}

function asErrorComponent(value: unknown): ErrorComponent {
  const components: ErrorComponent[] = [
    "service",
    "edge",
    "config",
    "route",
    "origin",
    "dns",
    "certificate",
    "access",
    "update",
    "control",
  ];
  return typeof value === "string" && components.includes(value as ErrorComponent)
    ? (value as ErrorComponent)
    : "control";
}

function asOutcome(value: unknown, status: number): ErrorOutcome {
  if (value === "unchanged" || value === "changed" || value === "uncertain") {
    return value;
  }
  return status >= 500 || status === 0 ? "uncertain" : "unchanged";
}

function responseRetryable(value: unknown, status: number): boolean {
  if (typeof value === "boolean") return value;
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function retryAfterMilliseconds(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, DEFAULT_RETRY_MAX_MS);
  const timestamp = Date.parse(header);
  if (!Number.isFinite(timestamp)) return undefined;
  return Math.max(0, Math.min(timestamp - Date.now(), DEFAULT_RETRY_MAX_MS));
}

function errorFromPayload(
  status: number,
  payload: unknown,
  response: Response,
  correlationId: string,
): PreviewTunnelError {
  const record = isRecord(payload) && isRecord(payload.error) ? payload.error : payload;
  const source = isRecord(record) ? record : {};
  const code = publicString(
    source.code,
    status === 409 || status === 412 ? "generation_conflict" : status >= 500 ? "control_plane_unavailable" : "request_failed",
  );
  const statusCode = status || 0;
  const message = publicString(
    source.message,
    statusCode >= 500 || statusCode === 0
      ? "Paperboat is temporarily unavailable."
      : "Paperboat could not complete the request.",
  );
  const repairAction = publicString(
    source.repair_action,
    statusCode === 409 || statusCode === 412 ? "refresh_and_retry" : responseRetryable(source.retryable, statusCode) ? "retry" : "inspect_request",
  );
  const details = isRecord(source.details) ? (source.details as SafeMetadata) : undefined;
  return new PreviewTunnelError({
    code,
    message,
    status: statusCode,
    component: asErrorComponent(source.component),
    outcome: asOutcome(source.outcome, statusCode),
    retryable: responseRetryable(source.retryable, statusCode),
    retryAt: typeof source.retry_at === "string" || source.retry_at === null ? source.retry_at : null,
    repairAction,
    requestId: publicID(source.request_id) ?? publicID(response.headers.get("request-id") ?? undefined),
    correlationId: publicID(source.correlation_id) ?? correlationId,
    details,
    retryAfterMs: retryAfterMilliseconds(response.headers.get("retry-after")),
  });
}

async function parseResponseBody(response: Response, correlationId: string): Promise<unknown> {
  const text = await response.text();
  if (text.length > SAFE_MAX_RESPONSE_BYTES) {
    throw new PreviewTunnelProtocolError("The server response exceeded the safe size limit.", correlationId);
  }
  if (!text) return undefined;
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    if (!response.ok) throw errorFromPayload(response.status, undefined, response, correlationId);
    throw new PreviewTunnelProtocolError("The server returned invalid JSON.", correlationId);
  }
  assertSecretSafe(payload);
  return payload;
}

function unwrapData(payload: unknown): unknown {
  if (isRecord(payload) && Object.prototype.hasOwnProperty.call(payload, "data")) {
    return payload.data;
  }
  return payload;
}

function expectKind<T>(payload: unknown, kind: string, correlationId: string): T {
  assertSecretSafe(payload);
  if (!isRecord(payload) || payload.schema !== PREVIEW_TUNNEL_SCHEMA || payload.kind !== kind) {
    throw new PreviewTunnelProtocolError(`The server returned an invalid ${kind} resource.`, correlationId);
  }
  return payload as T;
}

function expectResourceOrOperation<T>(payload: unknown, resourceKind: string, correlationId: string): T | Operation {
  const value = unwrapData(payload);
  if (isRecord(value) && value.kind === "operation") return expectKind<Operation>(value, "operation", correlationId);
  return expectKind<T>(value, resourceKind, correlationId);
}

function expectPage<T>(payload: unknown, itemKind: string, correlationId: string): V1Page<T> {
  const value = unwrapData(payload);
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new PreviewTunnelProtocolError("The server returned an invalid page.", correlationId);
  }
  const items = value.items.map((item) => expectKind<T>(item, itemKind, correlationId));
  if (value.next_cursor !== undefined && value.next_cursor !== null && typeof value.next_cursor !== "string") {
    throw new PreviewTunnelProtocolError("The server returned an invalid page cursor.", correlationId);
  }
  return { items, next_cursor: (value.next_cursor as string | null | undefined) ?? null };
}

function expectOperation(payload: unknown, correlationId: string): Operation {
  return expectKind<Operation>(unwrapData(payload), "operation", correlationId);
}

function expectEvent(payload: unknown, correlationId: string): V1Event {
  const value = unwrapData(payload);
  const event = expectKind<V1Event>(value, "event", correlationId);
  if (!event.id || !event.cursor || !event.event_type || !event.resource_id) {
    throw new PreviewTunnelProtocolError("The server returned an incomplete event.", correlationId);
  }
  return event;
}

function combineSignals(parent: AbortSignal | undefined, local: AbortController): () => void {
  if (!parent) return () => undefined;
  if (parent.aborted) local.abort();
  const abort = () => local.abort();
  parent.addEventListener("abort", abort, { once: true });
  return () => parent.removeEventListener("abort", abort);
}

function eventPath(resourceKind: "preview_lease" | "tunnel", resourceID: string): string {
  const encodedID = encodePathPart(resourceID);
  return resourceKind === "preview_lease"
    ? `/v1/previews/${encodedID}/events`
    : `/v1/tunnels/${encodedID}/events`;
}

function mutationMethod(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

export class PreviewTunnelClient {
  readonly correlationId: string;
  private readonly basePath: string;
  private readonly fetchImpl: FetchLike;
  private readonly sleep: SleepLike;
  private readonly random: () => number;
  private readonly makeRequestId: () => string;
  private readonly defaults: Required<Pick<ClientOptions, "maxAttempts" | "retryBaseDelayMs" | "retryMaxDelayMs">>;

  constructor(options: ClientOptions = {}) {
    this.basePath = (options.basePath ?? PREVIEW_TUNNEL_BFF_BASE).replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.sleep = options.sleep ?? defaultSleep;
    this.random = options.random ?? Math.random;
    this.makeRequestId = options.makeRequestId ?? requestID;
    this.correlationId = normalizedCorrelationID(options.correlationId);
    this.defaults = {
      maxAttempts: options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      retryBaseDelayMs: options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_MS,
      retryMaxDelayMs: options.retryMaxDelayMs ?? DEFAULT_RETRY_MAX_MS,
    };
  }

  async listPreviews(options: ListOptions = {}): Promise<V1Page<PreviewLease>> {
    return this.listResource<PreviewLease>("/v1/previews", "preview_lease", options);
  }

  async getPreview(id: string, options: RequestOptions = {}): Promise<PreviewLease> {
    return this.resourceRequest<PreviewLease>(`/v1/previews/${encodePathPart(id)}`, "preview_lease", options);
  }

  /**
   * Read a preview together with its transport metadata. Preview JSON is
   * deliberately free of concurrency fields, but mutating it still requires
   * the server's strong ETag. Callers should pass this value to stopPreview.
   */
  async getPreviewWithETag(id: string, options: RequestOptions = {}): Promise<PreviewLeaseWithETag> {
    let etag: string | null = null;
    const payload = await this.request(
      `/v1/previews/${encodePathPart(id)}`,
      "GET",
      undefined,
      {
        ...options,
        onResponse: (response) => {
          etag = response.headers.get("etag");
        },
      },
    );
    const preview = expectKind<PreviewLease>(unwrapData(payload), "preview_lease", normalizedCorrelationID(options.correlationId ?? this.correlationId));
    if (!etag) {
      throw new PreviewTunnelError({
        code: "missing_etag",
        message: "The server did not return a resource version. Refresh before retrying.",
        status: 0,
        component: "control",
        outcome: "unchanged",
        retryable: true,
        repairAction: "refresh_and_retry",
        correlationId: options.correlationId ?? this.correlationId,
      });
    }
    return { preview, etag: validateStrongETag(etag) };
  }

  async createPreview(
    input: PreviewCreateInput,
    options: MutationOptions = {},
  ): Promise<PreviewLease | Operation> {
    return this.mutationResource<PreviewLease>("/v1/previews", "POST", input, "preview_lease", options);
  }

  async stopPreview(id: string, options: MutationOptions = {}): Promise<PreviewLease | Operation | undefined> {
    return this.mutationResource<PreviewLease>(
      `/v1/previews/${encodePathPart(id)}`,
      "DELETE",
      undefined,
      "preview_lease",
      this.requiredETag(options),
      true,
    );
  }

  async renewPreview(
    id: string,
    input: { expires_at?: string | null } = {},
    options: MutationOptions = {},
  ): Promise<PreviewLease | Operation> {
    return this.mutationResource<PreviewLease>(
      `/v1/previews/${encodePathPart(id)}/lease/renew`,
      "POST",
      input,
      "preview_lease",
      this.requiredETag(options),
    );
  }

  async listPreviewDomains(previewID: string, options: ListOptions = {}): Promise<V1Page<DomainBinding>> {
    return this.listResource<DomainBinding>(
      `/v1/previews/${encodePathPart(previewID)}/domains`,
      "domain_binding",
      options,
    );
  }

  async getPreviewDomain(previewID: string, domainID: string, options: RequestOptions = {}): Promise<DomainBinding> {
    return this.resourceRequest<DomainBinding>(
      `/v1/previews/${encodePathPart(previewID)}/domains/${encodePathPart(domainID)}`,
      "domain_binding",
      options,
    );
  }

  async createPreviewDomain(
    previewID: string,
    input: PreviewDomainCreateInput,
    options: MutationOptions = {},
  ): Promise<DomainBinding | Operation> {
    return this.mutationResource<DomainBinding>(
      `/v1/previews/${encodePathPart(previewID)}/domains`,
      "POST",
      input,
      "domain_binding",
      options,
    );
  }

  async verifyPreviewDomain(
    previewID: string,
    domainID: string,
    options: MutationOptions,
  ): Promise<DomainBinding | Operation> {
    return this.mutationResource<DomainBinding>(
      `/v1/previews/${encodePathPart(previewID)}/domains/${encodePathPart(domainID)}/verify`,
      "POST",
      undefined,
      "domain_binding",
      this.requiredETag(options),
    );
  }

  async deletePreviewDomain(
    previewID: string,
    domainID: string,
    options: MutationOptions,
  ): Promise<DomainBinding | Operation | undefined> {
    return this.mutationResource<DomainBinding>(
      `/v1/previews/${encodePathPart(previewID)}/domains/${encodePathPart(domainID)}`,
      "DELETE",
      undefined,
      "domain_binding",
      this.requiredETag(options),
      true,
    );
  }

  async getPreviewDomainInstructions(
    previewID: string,
    domainID: string,
    options: RequestOptions = {},
  ): Promise<DNSInstructions> {
    return this.resourceRequest<DNSInstructions>(
      `/v1/previews/${encodePathPart(previewID)}/domains/${encodePathPart(domainID)}/instructions`,
      "dns_instructions",
      options,
    );
  }

  async listTunnels(options: ListOptions = {}): Promise<V1Page<Tunnel>> {
    return this.listResource<Tunnel>("/v1/tunnels", "tunnel", options);
  }

  async getTunnel(id: string, options: RequestOptions = {}): Promise<Tunnel> {
    return this.resourceRequest<Tunnel>(`/v1/tunnels/${encodePathPart(id)}`, "tunnel", options);
  }

  async createTunnel(input: TunnelCreateInput, options: MutationOptions = {}): Promise<Tunnel | Operation> {
    return this.mutationResource<Tunnel>("/v1/tunnels", "POST", input, "tunnel", options);
  }

  async updateTunnel(
    id: string,
    input: TunnelPatchInput,
    options: MutationOptions,
  ): Promise<Tunnel | Operation> {
    return this.mutationResource<Tunnel>(
      `/v1/tunnels/${encodePathPart(id)}`,
      "PATCH",
      input,
      "tunnel",
      this.requiredETag(options),
    );
  }

  async pauseTunnel(id: string, options: MutationOptions): Promise<Tunnel | Operation> {
    return this.mutationResource<Tunnel>(
      `/v1/tunnels/${encodePathPart(id)}/pause`,
      "POST",
      undefined,
      "tunnel",
      this.requiredETag(options),
    );
  }

  async resumeTunnel(id: string, options: MutationOptions): Promise<Tunnel | Operation> {
    return this.mutationResource<Tunnel>(
      `/v1/tunnels/${encodePathPart(id)}/resume`,
      "POST",
      undefined,
      "tunnel",
      this.requiredETag(options),
    );
  }

  async deleteTunnel(id: string, options: MutationOptions): Promise<Tunnel | Operation | undefined> {
    return this.mutationResource<Tunnel>(
      `/v1/tunnels/${encodePathPart(id)}`,
      "DELETE",
      undefined,
      "tunnel",
      this.requiredETag(options),
      true,
    );
  }

  async getTunnelStatus(id: string, options: RequestOptions = {}): Promise<Health> {
    return this.resourceRequest<Health>(`/v1/tunnels/${encodePathPart(id)}/status`, "health", options);
  }

  async listRoutes(tunnelID: string, options: ListOptions = {}): Promise<V1Page<TunnelRoute>> {
    return this.listResource<TunnelRoute>(
      `/v1/tunnels/${encodePathPart(tunnelID)}/routes`,
      "route",
      options,
    );
  }

  async getRoute(tunnelID: string, routeID: string, options: RequestOptions = {}): Promise<TunnelRoute> {
    return this.resourceRequest<TunnelRoute>(
      `/v1/tunnels/${encodePathPart(tunnelID)}/routes/${encodePathPart(routeID)}`,
      "route",
      options,
    );
  }

  async createRoute(
    tunnelID: string,
    input: RouteCreateInput,
    options: MutationOptions = {},
  ): Promise<TunnelRoute | Operation> {
    return this.mutationResource<TunnelRoute>(
      `/v1/tunnels/${encodePathPart(tunnelID)}/routes`,
      "POST",
      input,
      "route",
      options,
    );
  }

  async updateRoute(
    tunnelID: string,
    routeID: string,
    input: RoutePatchInput,
    options: MutationOptions,
  ): Promise<TunnelRoute | Operation> {
    return this.mutationResource<TunnelRoute>(
      `/v1/tunnels/${encodePathPart(tunnelID)}/routes/${encodePathPart(routeID)}`,
      "PATCH",
      input,
      "route",
      this.requiredETag(options),
    );
  }

  async deleteRoute(tunnelID: string, routeID: string, options: MutationOptions): Promise<TunnelRoute | Operation | undefined> {
    return this.mutationResource<TunnelRoute>(
      `/v1/tunnels/${encodePathPart(tunnelID)}/routes/${encodePathPart(routeID)}`,
      "DELETE",
      undefined,
      "route",
      this.requiredETag(options),
      true,
    );
  }

  async listDomains(tunnelID: string, options: ListOptions = {}): Promise<V1Page<DomainBinding>> {
    return this.listResource<DomainBinding>(
      `/v1/tunnels/${encodePathPart(tunnelID)}/domains`,
      "domain_binding",
      options,
    );
  }

  async createDomain(
    tunnelID: string,
    input: DomainCreateInput,
    options: MutationOptions = {},
  ): Promise<DomainBinding | Operation> {
    return this.mutationResource<DomainBinding>(
      `/v1/tunnels/${encodePathPart(tunnelID)}/domains`,
      "POST",
      input,
      "domain_binding",
      options,
    );
  }

  async getDomain(tunnelID: string, domainID: string, options: RequestOptions = {}): Promise<DomainBinding> {
    return this.resourceRequest<DomainBinding>(
      `/v1/tunnels/${encodePathPart(tunnelID)}/domains/${encodePathPart(domainID)}`,
      "domain_binding",
      options,
    );
  }

  async getDomainInstructions(
    tunnelID: string,
    domainID: string,
    options: RequestOptions = {},
  ): Promise<DNSInstructions> {
    return this.resourceRequest<DNSInstructions>(
      `/v1/tunnels/${encodePathPart(tunnelID)}/domains/${encodePathPart(domainID)}/instructions`,
      "dns_instructions",
      options,
    );
  }

  async deleteDomain(
    tunnelID: string,
    domainID: string,
    options: MutationOptions,
  ): Promise<DomainBinding | Operation | undefined> {
    return this.mutationResource<DomainBinding>(
      `/v1/tunnels/${encodePathPart(tunnelID)}/domains/${encodePathPart(domainID)}`,
      "DELETE",
      undefined,
      "domain_binding",
      this.requiredETag(options),
      true,
    );
  }

  async verifyDomain(
    tunnelID: string,
    domainID: string,
    options: MutationOptions,
  ): Promise<DomainBinding | Operation> {
    return this.mutationResource<DomainBinding>(
      `/v1/tunnels/${encodePathPart(tunnelID)}/domains/${encodePathPart(domainID)}/verify`,
      "POST",
      undefined,
      "domain_binding",
      this.requiredETag(options),
    );
  }

  async listConnectors(tunnelID: string, options: ListOptions = {}): Promise<V1Page<Connector>> {
    return this.listResource<Connector>(
      `/v1/tunnels/${encodePathPart(tunnelID)}/connectors`,
      "connector",
      options,
    );
  }

  async getConnector(tunnelID: string, connectorID: string, options: RequestOptions = {}): Promise<Connector> {
    return this.resourceRequest<Connector>(
      `/v1/tunnels/${encodePathPart(tunnelID)}/connectors/${encodePathPart(connectorID)}`,
      "connector",
      options,
    );
  }

  async listTunnelLogs(tunnelID: string, options: LogListOptions = {}): Promise<V1Page<LogEntry>> {
    return this.listLogs(`/v1/tunnels/${encodePathPart(tunnelID)}/logs`, options);
  }

  async listPreviewLogs(previewID: string, options: LogListOptions = {}): Promise<V1Page<LogEntry>> {
    return this.listLogs(`/v1/previews/${encodePathPart(previewID)}/logs`, options);
  }

  private async listLogs(path: string, options: LogListOptions): Promise<V1Page<LogEntry>> {
    const queryPath = buildQuery(path, {
      cursor: options.cursor,
      limit: parseLimit(options.limit)?.toString(),
      level: options.level,
      component: options.component,
      code: options.code,
      since: options.since,
    });
    return this.pageRequest<LogEntry>(queryPath, "log_entry", options);
  }

  async drainConnector(
    tunnelID: string,
    connectorID: string,
    options: MutationOptions,
  ): Promise<Connector | Operation> {
    return this.mutationResource<Connector>(
      `/v1/tunnels/${encodePathPart(tunnelID)}/connectors/${encodePathPart(connectorID)}/drain`,
      "POST",
      undefined,
      "connector",
      this.requiredETag(options),
    );
  }

  async deleteConnector(
    tunnelID: string,
    connectorID: string,
    options: MutationOptions,
  ): Promise<Connector | Operation | undefined> {
    return this.mutationResource<Connector>(
      `/v1/tunnels/${encodePathPart(tunnelID)}/connectors/${encodePathPart(connectorID)}`,
      "DELETE",
      undefined,
      "connector",
      this.requiredETag(options),
      true,
    );
  }

  async revokeConnector(
    tunnelID: string,
    connectorID: string,
    options: MutationOptions,
  ): Promise<Connector | Operation | undefined> {
    return this.deleteConnector(tunnelID, connectorID, options);
  }

  /**
   * Credential rotation is exposed only as a canonical operation trigger. Any
   * non-operation response, including enrollment material, is rejected by the
   * shared safe response parser and never reaches dashboard callers.
   */
  async rotateTunnelCredentials(
    tunnelID: string,
    options: MutationOptions,
  ): Promise<Operation> {
    const result = await this.mutationResource<Operation>(
      `/v1/tunnels/${encodePathPart(tunnelID)}/credentials/rotate`,
      "POST",
      undefined,
      "operation",
      this.requiredETag(options),
    );
    if (result.kind !== "operation") {
      throw new PreviewTunnelProtocolError(
        "The server returned an invalid credential rotation operation.",
        normalizedCorrelationID(options.correlationId ?? this.correlationId),
      );
    }
    return result;
  }

  async getOperation(id: string, options: RequestOptions = {}): Promise<Operation> {
    return this.resourceRequest<Operation>(`/v1/operations/${encodePathPart(id)}`, "operation", options);
  }

  async cancelOperation(id: string, options: MutationOptions = {}): Promise<Operation> {
    const result = await this.mutationResource<Operation>(
      `/v1/operations/${encodePathPart(id)}`,
      "DELETE",
      undefined,
      "operation",
      options,
    );
    if (result.kind !== "operation") {
      throw new PreviewTunnelProtocolError("The server returned an invalid operation cancellation result.", this.correlationId);
    }
    return result;
  }

  async listEvents(
    resourceKind: "preview_lease" | "tunnel",
    resourceID: string,
    options: ListOptions = {},
  ): Promise<V1Page<V1Event>> {
    const path = buildQuery(eventPath(resourceKind, resourceID), {
      cursor: options.cursor,
      limit: parseLimit(options.limit)?.toString(),
    });
    return this.pageRequest<V1Event>(path, "event", options);
  }

  subscribeEvents(
    resourceKind: "preview_lease" | "tunnel",
    resourceID: string,
    options: EventSubscriptionOptions = {},
  ): LiveEventSubscription {
    const correlationId = normalizedCorrelationID(options.correlationId ?? this.correlationId);
    const controller = new AbortController();
    const removeParentAbort = combineSignals(options.signal, controller);
    let cursor = options.cursor;
    let closed = false;
    let resolveDone: () => void = () => undefined;
    let rejectDone: (error: unknown) => void = () => undefined;
    const done = new Promise<void>((resolve, reject) => {
      resolveDone = resolve;
      rejectDone = reject;
    });
    const seen = new Set<string>();
    if (cursor) seen.add(`cursor:${cursor}`);
    const maxReconnectAttempts = Math.max(
      0,
      Math.min(100, options.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS),
    );
    let sawEvent = false;

    const close = () => {
      if (closed) return;
      closed = true;
      controller.abort();
      removeParentAbort();
    };

    const fail = (error: PreviewTunnelError) => {
      if (closed) return;
      close();
      options.onError?.(error);
      rejectDone(error);
    };

    const subscription: LiveEventSubscription = {
      correlationId,
      done,
      getCursor: () => cursor,
      close,
    };

    const deliver = async (event: V1Event): Promise<void> => {
      const cursorKey = `cursor:${event.cursor}`;
      const idKey = `id:${event.id}`;
      if (seen.has(cursorKey) || seen.has(idKey)) return;
      // The cursor advances only after validation and the consumer callback.
      // A failed consumer therefore causes reconnect from the last committed
      // cursor instead of silently skipping the event.
      await options.onEvent?.(event);
      cursor = event.cursor;
      sawEvent = true;
      seen.add(cursorKey);
      seen.add(idKey);
      // Keep duplicate suppression bounded while retaining the current event.
      while (seen.size > MAX_SEEN_EVENT_KEYS) {
        const first = seen.values().next().value as string | undefined;
        if (!first) break;
        seen.delete(first);
      }
    };

    const run = async () => {
      let failedConnections = 0;
      while (!closed) {
        try {
          await this.consumeEventStream(
            resourceKind,
            resourceID,
            cursor,
            correlationId,
            controller.signal,
            deliver,
          );
          if (closed) break;
          if (sawEvent) {
            failedConnections = 0;
            sawEvent = false;
          }
          failedConnections += 1;
          if (failedConnections > maxReconnectAttempts) {
            throw new PreviewTunnelError({
              code: "event_stream_disconnected",
              message: "The live event stream disconnected too many times.",
              status: 0,
              component: "control",
              outcome: "unchanged",
              retryable: false,
              repairAction: "refresh_and_retry",
              correlationId,
            });
          }
          const delay = retryDelayMs(
            failedConnections,
            options.retryBaseDelayMs ?? this.defaults.retryBaseDelayMs,
            options.retryMaxDelayMs ?? this.defaults.retryMaxDelayMs,
            this.random,
          );
          const retryError = new PreviewTunnelError({
            code: "event_stream_disconnected",
            message: "The live event stream disconnected. Paperboat will reconnect.",
            status: 0,
            component: "control",
            outcome: "unchanged",
            retryable: true,
            repairAction: "retry",
            correlationId,
          });
          options.onRetry?.({ attempt: failedConnections, delayMs: delay, error: retryError });
          await this.sleep(delay, controller.signal);
        } catch (error) {
          if (closed || controller.signal.aborted) break;
          const typed = this.asTransportError(error, "GET", correlationId);
          if (!typed.retryable) throw typed;
          failedConnections += 1;
          if (failedConnections > maxReconnectAttempts) throw typed;
          const delay = typed.retryAfterMs ?? retryDelayMs(
            failedConnections,
            options.retryBaseDelayMs ?? this.defaults.retryBaseDelayMs,
            options.retryMaxDelayMs ?? this.defaults.retryMaxDelayMs,
            this.random,
          );
          options.onRetry?.({ attempt: failedConnections, delayMs: delay, error: typed });
          await this.sleep(delay, controller.signal);
        }
      }
    };

    void run()
      .then(() => {
        // Resolve only after the current event callback has returned. This is
        // important when a consumer closes from inside onEvent: its cursor
        // must be committed before callers observe done.
        resolveDone();
      })
      .catch((error: unknown) => {
        if (closed || controller.signal.aborted) {
          resolveDone();
          return;
        }
        fail(this.asTransportError(error, "GET", correlationId));
      });

    return subscription;
  }

  watchOperation(id: string, options: OperationWatchOptions = {}): OperationWatcher {
    const controller = new AbortController();
    const removeParentAbort = combineSignals(options.signal, controller);
    let stopped = false;
    const correlationId = normalizedCorrelationID(options.correlationId ?? this.correlationId);
    const done = (async () => {
      let interval = Math.max(0, options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS);
      const maxInterval = Math.max(interval, options.maxPollIntervalMs ?? DEFAULT_MAX_POLL_INTERVAL_MS);
      let previous: Operation | undefined;
      while (!stopped) {
        const operation = await this.getOperation(id, {
          signal: controller.signal,
          correlationId,
          maxAttempts: options.maxAttempts,
          retryBaseDelayMs: options.retryBaseDelayMs,
          retryMaxDelayMs: options.retryMaxDelayMs,
        });
        if (
          !previous ||
          previous.progress !== operation.progress ||
          previous.phase !== operation.phase ||
          previous.state !== operation.state ||
          previous.updated_at !== operation.updated_at
        ) {
          options.onProgress?.(operation);
        }
        previous = operation;
        if (isTerminalOperation(operation)) {
          removeParentAbort();
          return operation;
        }
        await this.sleep(interval, controller.signal);
        interval = Math.min(maxInterval, Math.max(1, interval * 2));
      }
      throw new PreviewTunnelCanceledError(correlationId);
    })();

    return {
      done,
      stop: () => {
        stopped = true;
        controller.abort();
        removeParentAbort();
      },
      cancelRemote: () => this.cancelOperation(id, { correlationId }),
    };
  }

  private requiredETag(options: MutationOptions): MutationOptions {
    if (!options.ifMatch) {
      throw new PreviewTunnelError({
        code: "etag_required",
        message: "This change needs the current resource version. Refresh before retrying.",
        status: 0,
        component: "config",
        outcome: "unchanged",
        retryable: false,
        repairAction: "refresh_and_retry",
        correlationId: options.correlationId ?? this.correlationId,
      });
    }
    return { ...options, ifMatch: validateStrongETag(options.ifMatch) };
  }

  private async listResource<T>(path: string, kind: string, options: ListOptions): Promise<V1Page<T>> {
    return this.pageRequest<T>(
      buildQuery(path, { cursor: options.cursor, limit: parseLimit(options.limit)?.toString() }),
      kind,
      options,
    );
  }

  private async pageRequest<T>(path: string, kind: string, options: RequestOptions): Promise<V1Page<T>> {
    const payload = await this.request(path, "GET", undefined, options);
    return expectPage<T>(payload, kind, normalizedCorrelationID(options.correlationId ?? this.correlationId));
  }

  private async resourceRequest<T>(path: string, kind: string, options: RequestOptions): Promise<T> {
    const correlationId = normalizedCorrelationID(options.correlationId ?? this.correlationId);
    const payload = await this.request(path, "GET", undefined, options);
    return expectKind<T>(unwrapData(payload), kind, correlationId);
  }

  private async mutationResource<T>(
    path: string,
    method: string,
    body: unknown,
    kind: string,
    options: MutationOptions,
  ): Promise<T | Operation>;
  private async mutationResource<T>(
    path: string,
    method: string,
    body: unknown,
    kind: string,
    options: MutationOptions,
    allowEmpty: true,
  ): Promise<T | Operation | undefined>;
  private async mutationResource<T>(
    path: string,
    method: string,
    body: unknown,
    kind: string,
    options: MutationOptions,
    allowEmpty = false,
  ): Promise<T | Operation | undefined> {
    const idempotencyKey = validateIdempotencyKey(options.idempotencyKey ?? makeIdempotencyKey());
    const requestOptions = { ...options, idempotencyKey };
    const payload = await this.request(path, method, body, requestOptions);
    if (payload === undefined && allowEmpty) return undefined;
    return expectResourceOrOperation<T>(payload, kind, normalizedCorrelationID(options.correlationId ?? this.correlationId));
  }

  private async request(
    path: string,
    method: string,
    body: unknown,
    options: RequestOptions & {
      ifMatch?: string;
      idempotencyKey?: string;
      onResponse?: (response: Response) => void;
    } = {},
  ): Promise<unknown> {
    const upperMethod = method.toUpperCase();
    const mutating = mutationMethod(upperMethod);
    const correlationId = normalizedCorrelationID(options.correlationId ?? this.correlationId);
    const maxAttempts = Math.max(1, Math.min(6, options.maxAttempts ?? this.defaults.maxAttempts));
    const idempotencyKey = options.idempotencyKey
      ? validateIdempotencyKey(options.idempotencyKey)
      : undefined;
    const ifMatch = options.ifMatch ? validateStrongETag(options.ifMatch) : undefined;
    let encodedBody: string | undefined;
    if (body !== undefined) {
      try {
        encodedBody = JSON.stringify(body);
      } catch {
        throw new PreviewTunnelError({
          code: "invalid_request",
          message: "The request body could not be encoded.",
          status: 0,
          component: "control",
          outcome: "unchanged",
          retryable: false,
          repairAction: "inspect_request",
          correlationId,
        });
      }
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (options.signal?.aborted) throw new PreviewTunnelCanceledError(correlationId);
      const headers = this.headers(upperMethod, correlationId, idempotencyKey, ifMatch, false);
      const init: RequestInit = {
        method: upperMethod,
        headers,
        credentials: "same-origin",
        cache: "no-store",
        signal: options.signal,
      };
      if (encodedBody !== undefined) init.body = encodedBody;
      try {
        const response = await this.fetchImpl(this.basePath + path, init);
        const payload = await parseResponseBody(response, correlationId);
        if (!response.ok) throw errorFromPayload(response.status, payload, response, correlationId);
        options.onResponse?.(response);
        return payload;
      } catch (error) {
        const typed = this.asTransportError(error, upperMethod, correlationId);
        if (typed instanceof SecretExposureError) throw typed;
        if (typed.code === "canceled") throw typed;
        if (!typed.retryable || attempt >= maxAttempts) throw typed;
        const delay = typed.retryAfterMs ?? retryDelayMs(
          attempt,
          options.retryBaseDelayMs ?? this.defaults.retryBaseDelayMs,
          options.retryMaxDelayMs ?? this.defaults.retryMaxDelayMs,
          this.random,
        );
        await this.sleep(delay, options.signal);
      }
    }
    throw new PreviewTunnelError({
      code: "control_plane_unavailable",
      message: "Paperboat is temporarily unavailable.",
      status: 0,
      component: "control",
      outcome: mutating ? "uncertain" : "unchanged",
      retryable: true,
      repairAction: "retry",
      correlationId,
    });
  }

  private headers(
    method: string,
    correlationId: string,
    idempotencyKey: string | undefined,
    ifMatch: string | undefined,
    eventStream: boolean,
  ): Headers {
    const headers = new Headers();
    headers.set("accept", eventStream ? "text/event-stream" : "application/json");
    headers.set("correlation-id", safeHeaderValue(correlationId, "correlation ID"));
    headers.set("request-id", safeHeaderValue(this.makeRequestId(), "request ID"));
    if (method !== "GET" && method !== "HEAD" && method !== "DELETE") {
      headers.set("content-type", "application/json");
    }
    if (idempotencyKey) headers.set("idempotency-key", safeHeaderValue(idempotencyKey, "idempotency key"));
    if (ifMatch) headers.set("if-match", safeHeaderValue(ifMatch, "ETag"));
    const csrf = readCookie("paperboat_csrf");
    if (csrf) headers.set("x-csrf-token", decodeURIComponent(csrf));
    return headers;
  }

  private asTransportError(error: unknown, method: string, correlationId: string): PreviewTunnelError {
    if (error instanceof SecretExposureError) throw error;
    if (error instanceof PreviewTunnelError) {
      if (error.code === "control_plane_unavailable" && method !== "GET" && method !== "HEAD") {
        return new PreviewTunnelError({
          code: error.code,
          message: error.message,
          status: error.status,
          component: error.component,
          outcome: "uncertain",
          retryable: error.retryable,
          retryAt: error.retryAt,
          repairAction: error.repairAction,
          requestId: error.requestId,
          correlationId,
          details: error.details,
          retryAfterMs: error.retryAfterMs,
        });
      }
      return error;
    }
    if (isAbortError(error)) return new PreviewTunnelCanceledError(correlationId);
    return new PreviewTunnelError({
      code: "control_plane_unavailable",
      message: "Paperboat is temporarily unavailable.",
      status: 0,
      component: "control",
      outcome: method === "GET" || method === "HEAD" ? "unchanged" : "uncertain",
      retryable: true,
      repairAction: "retry",
      correlationId,
    });
  }

  private async consumeEventStream(
    resourceKind: "preview_lease" | "tunnel",
    resourceID: string,
    cursor: string | undefined,
    correlationId: string,
    signal: AbortSignal,
    deliver: (event: V1Event) => Promise<void>,
  ): Promise<void> {
    const path = buildQuery(eventPath(resourceKind, resourceID), { cursor });
    const headers = this.headers("GET", correlationId, undefined, undefined, true);
    if (cursor) headers.set("last-event-id", safeHeaderValue(cursor, "event cursor"));
    let response: Response;
    try {
      response = await this.fetchImpl(this.basePath + path, {
        method: "GET",
        headers,
        credentials: "same-origin",
        cache: "no-store",
        signal,
      });
    } catch (error) {
      throw this.asTransportError(error, "GET", correlationId);
    }
    if (!response.ok) {
      const payload = await parseResponseBody(response, correlationId);
      throw errorFromPayload(response.status, payload, response, correlationId);
    }
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.startsWith("text/event-stream")) {
      throw new PreviewTunnelProtocolError("The event stream returned an unexpected content type.", correlationId);
    }
    if (!response.body) {
      throw new PreviewTunnelProtocolError("The event stream did not include a response body.", correlationId);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = "";
    let fields: { data: string[]; id?: string; event?: string } = { data: [] };
    let eventBytes = 0;
    const resetFields = () => {
      fields = { data: [] };
      eventBytes = 0;
    };
    const dispatch = async () => {
      if (fields.data.length === 0) {
        resetFields();
        return;
      }
      const data = fields.data.join("\n");
      if (eventBytes > MAX_SSE_EVENT_BYTES || data.length > MAX_SSE_EVENT_BYTES) {
        throw new PreviewTunnelProtocolError("The event stream returned an oversized event.", correlationId);
      }
      let payload: unknown;
      try {
        payload = JSON.parse(data);
      } catch {
        throw new PreviewTunnelProtocolError("The event stream returned invalid JSON.", correlationId);
      }
      assertSecretSafe(payload);
      await deliver(expectEvent(payload, correlationId));
      resetFields();
    };
    const consumeLine = async (line: string) => {
      if (line.length > MAX_SSE_EVENT_BYTES) {
        throw new PreviewTunnelProtocolError("The event stream returned an oversized line.", correlationId);
      }
      if (line === "") {
        await dispatch();
        return;
      }
      if (line.startsWith(":")) return;
      const separator = line.indexOf(":");
      const field = separator === -1 ? line : line.slice(0, separator);
      const value = separator === -1 ? "" : line.slice(separator + 1).replace(/^ /, "");
      if (field === "data") {
        const nextBytes = eventBytes + encoder.encode(value).byteLength + (fields.data.length > 0 ? 1 : 0);
        if (nextBytes > MAX_SSE_EVENT_BYTES) {
          throw new PreviewTunnelProtocolError("The event stream returned an oversized event.", correlationId);
        }
        eventBytes = nextBytes;
        fields.data.push(value);
      }
      else if (field === "id") fields.id = value;
      else if (field === "event") fields.event = value;
    };

    while (true) {
      const chunk = await reader.read();
      buffer += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !chunk.done });
      if (buffer.length > MAX_SSE_BUFFER_BYTES) {
        throw new PreviewTunnelProtocolError("The event stream buffer exceeded its limit.", correlationId);
      }
      const lines = buffer.split(/\r\n|\n|\r/);
      buffer = lines.pop() ?? "";
      for (const line of lines) await consumeLine(line);
      if (chunk.done) {
        if (buffer) await consumeLine(buffer);
        await dispatch();
        return;
      }
    }
  }
}
