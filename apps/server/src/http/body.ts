import type { z } from "zod";
import { DomainError } from "./errors";

export async function parseBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  limit = 32 * 1024,
): Promise<T> {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  ) {
    throw new DomainError("invalid_content_type", 415, "Use application/json.");
  }
  const declared = Number(request.headers.get("content-length"));
  if (declared > limit)
    throw new DomainError("body_too_large", 413, "The request is too large.");
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > limit) {
          await reader.cancel();
          throw new DomainError(
            "body_too_large",
            413,
            "The request is too large.",
          );
        }
        chunks.push(part.value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new DomainError(
      "invalid_json",
      400,
      "The request must contain valid JSON.",
    );
  }
  const result = schema.safeParse(json);
  if (!result.success)
    throw new DomainError(
      "invalid_input",
      400,
      result.error.issues[0]?.message ?? "Invalid input.",
    );
  return result.data;
}
