import { buildServerRequest, relayResponse } from "@/lib/api/server";

/**
 * BFF proxy: forwards `/api/pb/<path>` to paperboat-server at `/<path>`,
 * relaying cookies both ways. This keeps the server origin private and lets the
 * server's `Set-Cookie` (login, logout, session rotation) persist on the
 * dashboard origin — Route Handlers can write response cookies, RSC render cannot.
 */

export const dynamic = "force-dynamic";

async function handle(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await ctx.params;
  const search = new URL(req.url).search;
  const targetPath = "/" + path.join("/") + search;

  // Buffer the body for methods that carry one so it can be forwarded.
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? await req.arrayBuffer() : null;

  const outbound = buildServerRequest(
    targetPath,
    req,
    body && body.byteLength > 0 ? body : null,
  );

  let serverRes: Response;
  try {
    serverRes = await fetch(outbound);
  } catch {
    return Response.json(
      {
        error: {
          code: "provider_unavailable",
          message: "The Paperboat control plane is unreachable.",
        },
      },
      { status: 502 },
    );
  }

  const resBody = await serverRes.arrayBuffer();
  return relayResponse(serverRes, resBody.byteLength > 0 ? resBody : null);
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
