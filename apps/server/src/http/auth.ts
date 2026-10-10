import { DomainError } from "./errors";

const COOKIE = "stead_session";
const MAX_AGE = 60 * 60 * 24 * 7;
const encoder = new TextEncoder();

async function signingKey(token: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(token),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
function decode64(value: string): Uint8Array {
  return Uint8Array.from(
    atob(value.replaceAll("-", "+").replaceAll("_", "/")),
    (c) => c.charCodeAt(0),
  );
}
async function sameSecret(actual: string, expected: string): Promise<boolean> {
  const key = await signingKey(expected);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(expected),
  );
  return crypto.subtle.verify("HMAC", key, signature, encoder.encode(actual));
}
export async function authenticate(
  request: Request,
  token: string | undefined,
): Promise<"bearer" | "cookie" | null> {
  if (!token) return null;
  const authorization = request.headers.get("authorization");
  if (
    authorization?.startsWith("Bearer ") &&
    (await sameSecret(authorization.slice(7), token))
  )
    return "bearer";
  const value = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (!value) return null;
  const [expires, signature, extra] = value.split(".");
  if (
    !expires ||
    !signature ||
    extra ||
    !/^\d+$/.test(expires) ||
    Number(expires) <= Date.now()
  )
    return null;
  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await signingKey(token),
      decode64(signature),
      encoder.encode(`stead-session:${expires}`),
    );
    return valid ? "cookie" : null;
  } catch {
    return null;
  }
}
export async function loginCookie(
  request: Request,
  actual: string,
  expected: string | undefined,
): Promise<string> {
  if (!expected)
    throw new DomainError(
      "not_configured",
      503,
      "Operator access has not been configured.",
    );
  if (!(await sameSecret(actual, expected)))
    throw new DomainError(
      "unauthorized",
      401,
      "The access token is incorrect.",
    );
  const expires = String(Date.now() + MAX_AGE * 1000);
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(expected),
    encoder.encode(`stead-session:${expires}`),
  );
  return `${COOKIE}=${expires}.${base64url(new Uint8Array(signature))}; ${cookieAttributes(request)}; Max-Age=${MAX_AGE}`;
}
function cookieAttributes(request: Request): string {
  return `Path=/; HttpOnly; SameSite=Strict${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
export function logoutCookie(request: Request): string {
  return `${COOKIE}=; ${cookieAttributes(request)}; Max-Age=0`;
}
export function requireOrigin(
  request: Request,
  authentication: "bearer" | "cookie" | null,
): void {
  const origin = request.headers.get("origin");
  if (origin === new URL(request.url).origin) return;
  // Non-browser test and operator clients use an explicit bearer credential.
  if (origin === null && authentication === "bearer") return;
  throw new DomainError(
    "invalid_origin",
    403,
    "This action must come from the Stead application.",
  );
}
