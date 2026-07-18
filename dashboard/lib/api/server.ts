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
 * `path` already includes the leading `/api/...` segment.
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
    res.headers.append("set-cookie", cookie);
  }
  return res;
}
