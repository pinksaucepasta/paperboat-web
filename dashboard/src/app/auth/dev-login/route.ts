import { serverBaseUrl } from "@/lib/api/server";

/**
 * LOCAL-ONLY sign-in shortcut for fake-provider mode.
 *
 * The real flow bounces through WorkOS; that requires a configured WorkOS app.
 * In fake-provider mode paperboat-server's FakeWorkOSVerifier accepts a
 * synthetic `subject:email:name` code, so we can complete the whole handshake
 * server-side: mint state, post the callback, and relay the session/CSRF
 * cookies onto the dashboard origin. Gated behind NEXT_PUBLIC_ENABLE_DEV_LOGIN
 * so it never ships to production.
 */
export async function GET(req: Request): Promise<Response> {
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN !== "true") {
    return new Response("Dev login is disabled.", { status: 404 });
  }

  const seededSession = process.env.PAPERBOAT_DEV_SESSION_TOKEN;
  const seededCSRF = process.env.PAPERBOAT_DEV_CSRF_TOKEN;
  if (seededSession || seededCSRF) {
    if (!seededSession || !seededCSRF) {
      return new Response("Dev login session is incomplete.", { status: 500 });
    }
    const res = new Response(null, {
      status: 302,
      headers: { location: new URL("/dashboard", req.url).toString() },
    });
    const cookieOptions = "Path=/; SameSite=Lax; Max-Age=2592000";
    res.headers.append(
      "set-cookie",
      `paperboat_session=${seededSession}; ${cookieOptions}; HttpOnly`,
    );
    res.headers.append(
      "set-cookie",
      `paperboat_csrf=${seededCSRF}; ${cookieOptions}`,
    );
    return res;
  }

  const url = new URL(req.url);
  const email = url.searchParams.get("email") ?? "demo@paperboat.dev";
  const name = url.searchParams.get("name") ?? "Demo User";
  const subject = url.searchParams.get("subject") ?? "sub_demo";
  const code = `${subject}:${email}:${name}`;

  const base = serverBaseUrl();

  // 1. Ask the server to mint an OAuth state (sets the oauth-state cookie).
  const stateRes = await fetch(base + "/v1/auth/workos/state", {
    cache: "no-store",
  });
  if (!stateRes.ok) {
    return new Response("Could not start dev sign-in.", { status: 502 });
  }
  const { data } = (await stateRes.json()) as { data: { state: string } };
  const oauthCookies = stateRes.headers.getSetCookie();

  // 2. Complete the callback with the synthetic code, forwarding the state cookie.
  const callbackRes = await fetch(base + "/v1/auth/workos/callback", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: oauthCookies.map((c) => c.split(";")[0]).join("; "),
    },
    body: JSON.stringify({
      code,
      state: data.state,
      redirect_uri: process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI,
    }),
    cache: "no-store",
  });

  if (!callbackRes.ok) {
    return new Response("Dev sign-in failed.", { status: 502 });
  }

  // 3. Relay the session + CSRF cookies onto the dashboard origin, redirect in.
  const res = new Response(null, {
    status: 302,
    headers: { location: new URL("/dashboard", req.url).toString() },
  });
  const localHTTP = url.protocol === "http:";
  for (const cookie of callbackRes.headers.getSetCookie()) {
    res.headers.append(
      "set-cookie",
      localHTTP ? cookie.replace(/;\s*Secure(?=;|$)/gi, "") : cookie,
    );
  }
  return res;
}
