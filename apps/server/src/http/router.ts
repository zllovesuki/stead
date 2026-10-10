import { getAgentByName, routeAgentRequest } from "agents";
import { loginSchema } from "@stead/contracts";
import type { Env } from "../env";
import { authenticate, loginCookie, logoutCookie, requireOrigin } from "./auth";
import { parseBody } from "./body";
import { secureResponse } from "./artifacts";
import { DomainError, errorResponse } from "./errors";
import { apiRoutes } from "./routes";

export async function handleRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const privateContent =
    url.pathname.startsWith("/api/") || url.pathname.startsWith("/agents/");
  try {
    return secureResponse(await dispatch(request, env, url), privateContent);
  } catch (error) {
    if (error instanceof DomainError)
      return secureResponse(
        errorResponse(error.code, error.message, error.status),
        true,
      );
    // DO RPC preserves Error.name/message but does not preserve arbitrary properties.
    const remote =
      error instanceof Error
        ? /^SteadDomainError:(\d{3}):([a-z_]+)$/.exec(error.name)
        : null;
    if (remote && error instanceof Error)
      return secureResponse(
        errorResponse(remote[2]!, error.message, Number(remote[1])),
        true,
      );
    console.error("Stead request failed", {
      path: url.pathname,
      error: error instanceof Error ? error.name : "unknown",
    });
    return secureResponse(
      errorResponse(
        "internal_error",
        "Stead could not finish this request. Please try again.",
        500,
      ),
      true,
    );
  }
}
async function dispatch(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  if (!url.pathname.startsWith("/api/") && !url.pathname.startsWith("/agents/"))
    return env.ASSETS.fetch(request);
  const authentication = await authenticate(request, env.PREVIEW_TOKEN);
  if (url.pathname === "/api/session" && request.method === "GET")
    return Response.json({
      authenticated: authentication !== null,
      configured: Boolean(env.PREVIEW_TOKEN),
    });
  if (url.pathname === "/api/login" && request.method === "POST") {
    requireOrigin(request, authentication);
    const input = await parseBody(request, loginSchema, 8192);
    return Response.json(
      { authenticated: true, configured: true },
      {
        headers: {
          "Set-Cookie": await loginCookie(
            request,
            input.token,
            env.PREVIEW_TOKEN,
          ),
        },
      },
    );
  }
  if (!env.PREVIEW_TOKEN)
    throw new DomainError(
      "not_configured",
      503,
      "Operator access has not been configured.",
    );
  if (!authentication)
    throw new DomainError(
      "unauthorized",
      401,
      "Sign in to open your workspace.",
    );
  const websocket =
    request.headers.get("upgrade")?.toLowerCase() === "websocket";
  if (!["GET", "HEAD"].includes(request.method) || websocket)
    requireOrigin(request, authentication);
  if (url.pathname === "/api/logout" && request.method === "POST")
    return new Response(null, {
      status: 204,
      headers: { "Set-Cookie": logoutCookie(request) },
    });
  if (url.pathname.startsWith("/agents/")) {
    if (
      url.searchParams.has("__agents_transport") ||
      request.method !== "GET" ||
      ![
        "/agents/personal-agent/main",
        "/agents/personal-agent/main/get-messages",
      ].includes(url.pathname)
    )
      return errorResponse("not_found", "Agent route not found.", 404);
    // Never forward caller-supplied lifecycle props to the private agent graph.
    const headers = new Headers(request.headers);
    headers.delete("x-agents-lifecycle-props");
    return (
      (await routeAgentRequest(new Request(request, { headers }), {
        PERSONAL_AGENT: env.PERSONAL_AGENT,
      })) ?? errorResponse("not_found", "Agent route not found.", 404)
    );
  }
  return apiRoutes(
    request,
    url,
    await getAgentByName(env.PERSONAL_AGENT, "main"),
  );
}
