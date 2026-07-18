import { serverBaseUrl } from "@/lib/api/server";

const PURPOSE_COOKIE = "paperboat_reauth_purpose";
const purposes = new Set(["config_recovery_export", "config_key_rotation"]);

export async function GET(req: Request): Promise<Response> {
  const requestUrl = new URL(req.url);
  const purpose = requestUrl.searchParams.get("purpose") ?? "";
  if (!purposes.has(purpose)) return new Response("Invalid reauthentication purpose.", { status: 400 });
  const clientId = process.env.WORKOS_CLIENT_ID;
  const redirectUri = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;
  const authorizeBase = process.env.WORKOS_AUTHORIZE_URL ?? "https://api.workos.com/user_management/authorize";
  if (!clientId || !redirectUri) return new Response("Auth is not configured.", { status: 500 });
  const stateRes = await fetch(serverBaseUrl() + `/api/auth/workos/reauth/state?purpose=${encodeURIComponent(purpose)}`, { headers: { cookie: req.headers.get("cookie") ?? "" }, cache: "no-store" });
  if (!stateRes.ok) return new Response("Could not start reauthentication.", { status: 502 });
  const { data } = (await stateRes.json()) as { data: { state: string } };
  const url = new URL(authorizeBase);
  url.searchParams.set("client_id", clientId); url.searchParams.set("redirect_uri", redirectUri); url.searchParams.set("response_type", "code"); url.searchParams.set("provider", "authkit"); url.searchParams.set("prompt", "login"); url.searchParams.set("state", data.state);
  const res = new Response(null, { status: 302, headers: { location: url.toString() } });
  for (const cookie of stateRes.headers.getSetCookie()) res.headers.append("set-cookie", cookie);
  res.headers.append("set-cookie", `${PURPOSE_COOKIE}=${purpose}; Path=/callback; HttpOnly; SameSite=Lax; Max-Age=600${requestUrl.protocol === "https:" ? "; Secure" : ""}`);
  return res;
}
