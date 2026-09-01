/**
 * Browser-side paperboat-server client. `pbFetch` calls through the BFF proxy
 * (`/api/pb/*`) so the browser persists rotated/login cookies. It unwraps the
 * server's `{ data }` / `{ error }` envelope, throwing `ApiError` (carrying the
 * contract error `code`) on failure.
 *
 * Server-component reads live in `./server-fetch` (server-only) and reuse the
 * `ApiError` / `unwrap` exported here — this module stays browser-safe.
 */

const BFF_BASE = "/api/pb";

export class ApiError extends Error {
  code: string;
  status: number;
  requestId?: string;

  constructor(code: string, message: string, status: number, requestId?: string) {
    super(apiErrorMessage(code, message, status, requestId));
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

export function apiErrorMessage(
  code: string,
  serverMessage: string,
  status: number,
  requestId?: string,
): string {
  let message: string;
  switch (code) {
    case "unauthenticated":
    case "credential_invalid":
      message = "Your session is no longer valid. Sign in again, then retry.";
      break;
    case "payment_required":
    case "entitlement_lost":
      message = "Your Paperboat plan is inactive. Restore billing access, then retry.";
      break;
    case "credits_exhausted":
      message = "Your account is out of credits. Add credits, then retry.";
      break;
    case "machine_offline":
      message = "This machine is offline. Bring it online, then retry.";
      break;
    case "machine_not_ready":
    case "tunnel_unavailable":
      message = "This environment is still becoming available. Retry in a moment.";
      break;
    case "machine_revoked":
      message = "This machine has been disconnected. Reconnect it before retrying.";
      break;
    case "not_found":
    case "not_found_or_forbidden":
      message = "This item no longer exists or is not available to this account.";
      break;
    default:
      if ([400, 409, 422].includes(status) && serverMessage.trim()) {
        message = serverMessage.trim();
      } else if (status === 403) {
        message = "You do not have permission to perform this action.";
      } else if (status === 404) {
        message = "The requested item was not found. Refresh the page and retry.";
      } else if (status === 409 && serverMessage.trim()) {
        message = serverMessage.trim();
      } else if (status === 429) {
        message = "Paperboat is receiving too many requests. Wait a moment, then retry.";
      } else if (status >= 500 || status === 0) {
        message = "Paperboat is temporarily unavailable. Retry in a moment.";
      } else {
        message = "Paperboat could not complete this request. Refresh the page and retry.";
      }
  }

  if (requestId && (status >= 500 || status === 0)) {
    message += ` Request ID: ${requestId}.`;
  }
  return message;
}

export function displayErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

interface Envelope<T> {
  data?: T;
  error?: { code: string; message: string; request_id?: string };
}

export async function unwrap<T>(res: Response): Promise<T> {
  let body: Envelope<T> | null = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text) as Envelope<T>;
    } catch {
      // Non-JSON body (should not happen from the server contract).
    }
  }
  if (!res.ok || body?.error) {
    const err = body?.error;
    throw new ApiError(
      err?.code ?? "internal_error",
      err?.message ?? "",
      res.status,
      err?.request_id,
    );
  }
  return (body?.data as T) ?? (undefined as T);
}

const UNSAFE = new Set(["POST", "PATCH", "PUT", "DELETE"]);

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(name + "="));
  return match?.slice(name.length + 1);
}

function idempotencyKey(): string {
  return "idem_" + crypto.randomUUID();
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Provide to override the auto-generated idempotency key on mutations. */
  idempotencyKey?: string;
  /** Additional request headers, such as a resource's If-Match ETag. */
  headers?: HeadersInit;
  /** Browser cache policy for requests that must observe the latest state. */
  cache?: RequestCache;
  /** ENV E2EE requests must be attempted exactly once to preserve CAS bytes. */
  noRetry?: boolean;
  /** Observe response headers before the response body is consumed. */
  onResponse?: (response: Response) => void;
}

/** Browser client — goes through the BFF proxy with cookies. */
export async function pbFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? "GET";
  const headers = new Headers(opts.headers);
  const init: RequestInit = {
    method,
    credentials: "same-origin",
    headers,
    cache: opts.cache,
  };

  if (opts.body !== undefined) {
    headers.set("content-type", "application/json");
    init.body = JSON.stringify(opts.body);
  }
  if (UNSAFE.has(method)) {
    const csrf = readCookie("paperboat_csrf");
    if (csrf) headers.set("x-csrf-token", decodeURIComponent(csrf));
    headers.set("idempotency-key", opts.idempotencyKey ?? idempotencyKey());
  }
  const res = await fetch(BFF_BASE + path, init);
  opts.onResponse?.(res);
  return unwrap<T>(res);
}

/** Download an authenticated non-JSON response through the dashboard BFF. */
export async function pbDownload(path: string): Promise<Blob> {
  const res = await fetch(BFF_BASE + path, { method: "GET", credentials: "same-origin", cache: "no-store" });
  if (!res.ok) {
    await unwrap<never>(res);
  }
  return res.blob();
}
