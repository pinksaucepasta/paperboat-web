import { serverBaseUrl } from "@/lib/api/server";
import {
  AUTH_RETURN_COOKIE,
  authReturnCookie,
  cliAuthorizePath,
  readCookieValue,
} from "@/lib/auth-return";

const REAUTH_PURPOSE_COOKIE = "paperboat_reauth_purpose";

/**
 * WorkOS redirects here with `?code&state`. We hand both to the server's
 * `/api/auth/workos/callback` (forwarding the `paperboat_oauth_state` cookie it
 * set at sign-in). The server validates state, exchanges the code, and returns
 * `Set-Cookie` for the session + CSRF, which we relay onto the dashboard origin.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const redirectUri = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;
	const cookieHeader = req.headers.get("cookie") ?? "";
	const reauthPurpose = readCookieValue(cookieHeader, REAUTH_PURPOSE_COOKIE);
	if (reauthPurpose) {
		const serverRes = await fetch(serverBaseUrl() + "/api/auth/workos/reauth/callback", { method: "POST", headers: { "content-type": "application/json", cookie: cookieHeader }, body: JSON.stringify({ code, state, redirect_uri: redirectUri, purpose: reauthPurpose }), cache: "no-store" });
		const location = serverRes.ok ? "/dashboard/configuration?reauthenticated=" + encodeURIComponent(reauthPurpose) : "/dashboard/configuration?error=reauthentication";
		const res = new Response(null, { status: 302, headers: { location: new URL(location, req.url).toString() } });
		for (const cookie of serverRes.headers.getSetCookie()) res.headers.append("set-cookie", cookie);
		res.headers.append("set-cookie", `${REAUTH_PURPOSE_COOKIE}=; Path=/callback; HttpOnly; SameSite=Lax; Max-Age=0`);
		return res;
	}

  if (!code || !state) {
    return Response.redirect(new URL("/login?error=oauth", req.url), 302);
  }

  const serverRes = await fetch(serverBaseUrl() + "/api/auth/workos/callback", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader,
    },
    body: JSON.stringify({ code, state, redirect_uri: redirectUri }),
    cache: "no-store",
  });

  const returnPath = cliAuthorizePath(
    readCookieValue(req.headers.get("cookie") ?? "", AUTH_RETURN_COOKIE),
  );
  const location = serverRes.ok ? (returnPath ?? "/dashboard") : "/login?error=auth";
  const res = new Response(null, {
    status: 302,
    headers: { location: new URL(location, req.url).toString() },
  });
  for (const cookie of serverRes.headers.getSetCookie()) {
    res.headers.append("set-cookie", cookie);
  }
  res.headers.append(
    "set-cookie",
    authReturnCookie(null, url.protocol === "https:"),
  );
  return res;
}
