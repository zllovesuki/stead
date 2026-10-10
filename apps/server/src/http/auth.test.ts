import { describe, expect, it } from "vitest";
import { authenticate, loginCookie, logoutCookie, requireOrigin } from "./auth";

const token = "test-operator-token-not-a-deployment-secret";
function request(headers: HeadersInit = {}): Request {
  return new Request("https://stead.test/api/workspace", { headers });
}

describe("operator admission", () => {
  it("fails closed without a configured secret or valid credential", async () => {
    expect(await authenticate(request(), token)).toBeNull();
    expect(
      await authenticate(
        request({ Authorization: `Bearer ${token}` }),
        undefined,
      ),
    ).toBeNull();
    expect(
      await authenticate(request({ Authorization: "Bearer wrong" }), token),
    ).toBeNull();
    await expect(loginCookie(request(), "wrong", token)).rejects.toMatchObject({
      status: 401,
    });
  });
  it("signs a private cookie and rejects tampering, expiry, and secret rotation", async () => {
    const setCookie = await loginCookie(request(), token, token);
    expect(setCookie).toContain("HttpOnly; SameSite=Strict; Secure");
    const cookie = setCookie.split(";")[0]!;
    expect(await authenticate(request({ Cookie: cookie }), token)).toBe(
      "cookie",
    );
    expect(
      await authenticate(
        request({ Cookie: cookie.replace(/=\d+/, "=1") }),
        token,
      ),
    ).toBeNull();
    expect(
      await authenticate(request({ Cookie: `${cookie}x` }), token),
    ).toBeNull();
    expect(
      await authenticate(request({ Cookie: cookie }), "rotated-secret"),
    ).toBeNull();
    expect(logoutCookie(request())).toContain("Max-Age=0");
  });
  it("requires the exact browser origin and permits explicit non-browser bearer calls", () => {
    expect(() =>
      requireOrigin(request({ Origin: "https://stead.test" }), "cookie"),
    ).not.toThrow();
    expect(() =>
      requireOrigin(request({ Origin: "https://other.test" }), "cookie"),
    ).toThrow();
    expect(() => requireOrigin(request(), "cookie")).toThrow();
    expect(() =>
      requireOrigin(request({ Origin: "null" }), "cookie"),
    ).toThrow();
    expect(() => requireOrigin(request(), "bearer")).not.toThrow();
    expect(() =>
      requireOrigin(request({ Origin: "https://other.test" }), "bearer"),
    ).toThrow();
  });
});
