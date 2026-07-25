import { serverBaseUrl, CSRF_COOKIE } from "@/lib/api/server";

/**
 * GitHub redirects here with `?code&state` after the user authorizes. We forward
 * both to the server's CSRF-protected `/v1/github/oauth/callback` (relaying the
 * session, oauth-state, and CSRF cookies), then return to the initiating
 * dashboard surface.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const returnTo = url.searchParams.get("return_to");
  const isConfiguration = returnTo === "configuration";
  const redirectUri =
    url.origin +
    "/github/callback" +
    (isConfiguration ? "?return_to=configuration" : "");
  const destination = new URL(
    isConfiguration ? "/dashboard/configuration" : "/dashboard/settings",
    req.url,
  );

  if (!code || !state) {
    destination.searchParams.set("github", "error");
    return Response.redirect(destination, 302);
  }

  const cookieHeader = req.headers.get("cookie") ?? "";
  const csrf = cookieHeader
    .split("; ")
    .find((c) => c.startsWith(CSRF_COOKIE + "="))
    ?.slice(CSRF_COOKIE.length + 1);

  const serverRes = await fetch(serverBaseUrl() + "/v1/github/oauth/callback", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader,
      ...(csrf ? { "x-csrf-token": decodeURIComponent(csrf) } : {}),
    },
    body: JSON.stringify({ code, state, redirect_uri: redirectUri }),
    cache: "no-store",
  });

  destination.searchParams.set("github", serverRes.ok ? "connected" : "error");
  const res = new Response(null, {
    status: 302,
    headers: { location: destination.toString() },
  });
  for (const cookie of serverRes.headers.getSetCookie()) {
    res.headers.append("set-cookie", cookie);
  }
  return res;
}
