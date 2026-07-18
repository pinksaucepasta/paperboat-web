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
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
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
      err?.message ?? `Request failed with status ${res.status}.`,
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
}

/** Browser client — goes through the BFF proxy with cookies. */
export async function pbFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? "GET";
  const headers = new Headers();
  const init: RequestInit = { method, credentials: "same-origin", headers };

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
  return unwrap<T>(res);
}
