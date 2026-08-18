import "server-only";

/**
 * Shared server-side helpers for talking to paperboat-server (the control plane).
 * The dashboard never exposes the server origin to the browser — all traffic goes
 * through the BFF proxy at `/api/pb/*`, which forwards cookies and relays the
 * server's `Set-Cookie` responses onto the dashboard origin.
 */

/** Base URL of paperboat-server. Required — no hardcoded fallback in prod paths. */
export function serverBaseUrl(): string {
  const url = process.env.PAPERBOAT_SERVER_URL;
  if (!url) {
    throw new Error(
      "PAPERBOAT_SERVER_URL is not set — the dashboard cannot reach paperboat-server.",
    );
  }
  return url.replace(/\/$/, "");
}

/** Cookies owned by the server that the BFF relays between browser and server. */
export const SESSION_COOKIE = "paperboat_session";
export const CSRF_COOKIE = "paperboat_csrf";
export const OAUTH_STATE_COOKIE = "paperboat_oauth_state";

const SAFE_READ_ATTEMPTS = 3;
const SAFE_READ_ATTEMPT_TIMEOUT_MS = 5_000;

/**
 * Fetch the control plane. Safe reads retry bounded network failures because no
 * mutation can become uncertain. Mutations are attempted exactly once.
 */
export async function fetchPaperboatServer(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
): Promise<Response> {
  const method = (
    input instanceof Request ? input.method : (init?.method ?? "GET")
  ).toUpperCase();
  const safeRead = method === "GET" || method === "HEAD";
  const attempts = safeRead ? SAFE_READ_ATTEMPTS : 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const attemptSignal = safeRead
      ? AbortSignal.timeout(SAFE_READ_ATTEMPT_TIMEOUT_MS)
      : undefined;
    try {
      if (input instanceof Request) {
        const request = input.clone();
        return await fetch(
          attemptSignal ? new Request(request, { signal: attemptSignal }) : request,
        );
      }
      return await fetch(input, {
        ...init,
        signal: attemptSignal ?? init?.signal,
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

/** Request/response headers we forward through the proxy (allowlist, lowercased). */
export const FORWARDED_REQUEST_HEADERS = [
  "content-type",
  "accept",
  "x-csrf-token",
  "idempotency-key",
  "request-id",
  "authorization",
];

/**
 * Build the outbound request to the server for a given proxied path.
 * `path` already includes the leading `/v1/...` segment.
 */
export function buildServerRequest(
  path: string,
  incoming: Request,
  body: BodyInit | null,
): Request {
  const target = serverBaseUrl() + path;
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = incoming.headers.get(name);
    if (value) headers.set(name, value);
  }
  // Forward the browser's cookies (dashboard origin) so the server sees its own
  // session/csrf/oauth-state cookies.
  const cookie = incoming.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);

  return new Request(target, {
    method: incoming.method,
    headers,
    body,
    redirect: "manual",
  });
}

/**
 * Copy the server response (status, body, content-type) into a Response for the
 * browser, relaying every `Set-Cookie` header verbatim so session rotation and
 * login/logout cookie changes persist on the dashboard origin.
 */
export function relayResponse(serverRes: Response, body: BodyInit | null): Response {
  const headers = new Headers();
  const contentType = serverRes.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const requestId = serverRes.headers.get("request-id");
  if (requestId) headers.set("request-id", requestId);

  const res = new Response(body, { status: serverRes.status, headers });
  // `getSetCookie` returns each Set-Cookie header separately (Node/undici).
  for (const cookie of serverRes.headers.getSetCookie()) {
    // The production API correctly emits Secure cookies. A local HTTP
    // dashboard can only persist them during the explicitly enabled dev-login
    // workflow, so remove Secure in development only. Production and preview
    // builds always relay the cookie unchanged.
    const relayedCookie =
      process.env.NODE_ENV === "development" &&
      process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === "true"
        ? cookie.replace(/;\s*Secure(?=;|$)/gi, "")
        : cookie;
    res.headers.append("set-cookie", relayedCookie);
  }
  return res;
}
