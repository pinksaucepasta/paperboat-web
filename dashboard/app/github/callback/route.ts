import { serverBaseUrl, CSRF_COOKIE } from "@/lib/api/server";

/**
 * GitHub redirects here with `?code&state` after the user authorizes. We forward
 * both to the server's CSRF-protected `/api/github/oauth/callback` (relaying the
 * session, oauth-state, and CSRF cookies), then return to Settings.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const redirectUri = url.origin + "/github/callback";
  const settings = new URL("/dashboard/settings", req.url);

  if (!code || !state) {
    settings.searchParams.set("github", "error");
    return Response.redirect(settings, 302);
  }

  const cookieHeader = req.headers.get("cookie") ?? "";
  const csrf = cookieHeader
    .split("; ")
    .find((c) => c.startsWith(CSRF_COOKIE + "="))
    ?.slice(CSRF_COOKIE.length + 1);

  const serverRes = await fetch(serverBaseUrl() + "/api/github/oauth/callback", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader,
      ...(csrf ? { "x-csrf-token": decodeURIComponent(csrf) } : {}),
    },
    body: JSON.stringify({ code, state, redirect_uri: redirectUri }),
    cache: "no-store",
  });

  settings.searchParams.set("github", serverRes.ok ? "connected" : "error");
  const res = new Response(null, {
    status: 302,
    headers: { location: settings.toString() },
  });
  for (const cookie of serverRes.headers.getSetCookie()) {
    res.headers.append("set-cookie", cookie);
  }
  return res;
}
