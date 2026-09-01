/**
 * Response relay primitives shared by the server-only BFF and deterministic
 * contract tests. Keeping this small helper free of `server-only` makes the
 * stream-preservation behavior testable without starting Next.js.
 */

export interface RelayResponseOptions {
  stripSecureCookies?: boolean;
}

/**
 * Relay an upstream response without consuming its body. In particular, an
 * event-stream body remains a live ReadableStream instead of being buffered by
 * the dashboard route handler.
 */
export function relayResponse(
  serverRes: Response,
  body: BodyInit | null,
  options: RelayResponseOptions = {},
): Response {
  const headers = new Headers();
  for (const name of [
    "content-type",
    "request-id",
    "correlation-id",
    "etag",
    "retry-after",
    "cache-control",
    "last-event-id",
  ]) {
    const value = serverRes.headers.get(name);
    if (value) headers.set(name, value);
  }

  const res = new Response(body, { status: serverRes.status, headers });
  // `getSetCookie` returns each Set-Cookie header separately in Node/undici.
  // Browser Response objects do not expose it, so the optional call keeps the
  // helper usable in the stream contract test as well.
  const getSetCookie = serverRes.headers.getSetCookie?.bind(serverRes.headers);
  for (const cookie of getSetCookie?.() ?? []) {
    const relayedCookie = options.stripSecureCookies
      ? cookie.replace(/;\s*Secure(?=;|$)/gi, "")
      : cookie;
    res.headers.append("set-cookie", relayedCookie);
  }
  return res;
}
