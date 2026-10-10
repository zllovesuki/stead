import type { TaskFile } from "@stead/contracts";
import { DomainError } from "./errors";

export function artifactResponse(file: TaskFile, url: URL): Response {
  if (url.searchParams.has("preview")) {
    if (file.mediaType !== "text/html")
      throw new DomainError(
        "unsupported_preview",
        415,
        "Only HTML files have an interactive preview.",
      );
    return new Response(file.content, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy":
          "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'",
      },
    });
  }
  if (url.searchParams.has("download")) {
    const name = file.path.split("/").at(-1) ?? "artifact.txt";
    return new Response(file.content, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Content-Security-Policy": "sandbox; default-src 'none'",
      },
    });
  }
  return Response.json(file);
}

export function secureResponse(
  response: Response,
  privateContent: boolean,
): Response {
  if (response.status === 101) return response;
  const secured = new Response(response.body, response);
  secured.headers.set("X-Content-Type-Options", "nosniff");
  secured.headers.set("Referrer-Policy", "no-referrer");
  if (privateContent) secured.headers.set("Cache-Control", "no-store");
  return secured;
}
