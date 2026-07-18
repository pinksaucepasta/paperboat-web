import { serverBaseUrl } from "@/lib/api/server";
import { authReturnCookie, normalizeUserCode } from "@/lib/auth-return";

/**
 * Begin sign-in. The SERVER owns WorkOS, so we ask it to mint an OAuth `state`
 * (it sets the `paperboat_oauth_state` cookie it will later validate), relay that
 * cookie to the dashboard origin, then redirect the browser to WorkOS. WorkOS
 * sends the user back to `/callback`, which hands the code to the server.
 */
export async function GET(req: Request): Promise<Response> {
  const requestUrl = new URL(req.url);
  const returnCode = normalizeUserCode(requestUrl.searchParams.get("code"));
  const clientId = process.env.WORKOS_CLIENT_ID;
  const redirectUri = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;
  const authorizeBase =
    process.env.WORKOS_AUTHORIZE_URL ??
    "https://api.workos.com/user_management/authorize";
  if (!clientId || !redirectUri) {
    return new Response("Auth is not configured.", { status: 500 });
  }

  const stateRes = await fetch(serverBaseUrl() + "/api/auth/workos/state", {
    cache: "no-store",
  });
  if (!stateRes.ok) {
    return new Response("Could not start sign-in.", { status: 502 });
  }
  const { data } = (await stateRes.json()) as { data: { state: string } };

  const url = new URL(authorizeBase);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("provider", "authkit");
  url.searchParams.set("state", data.state);

  const res = new Response(null, {
    status: 302,
    headers: { location: url.toString() },
  });
  // Relay the server's oauth-state cookie onto the dashboard origin so it is
  // sent back with the /callback request and forwarded to the server.
  for (const cookie of stateRes.headers.getSetCookie()) {
    res.headers.append("set-cookie", cookie);
  }
  res.headers.append(
    "set-cookie",
    authReturnCookie(returnCode, requestUrl.protocol === "https:"),
  );
  return res;
}
