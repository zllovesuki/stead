import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseBody } from "./body";
import { artifactResponse } from "./artifacts";
import { createTaskSchema, filePathSchema } from "@stead/contracts";

describe("public request and file boundaries", () => {
  it("rejects oversized streamed bodies without relying on content-length", async () => {
    const request = new Request("https://stead.test/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "x".repeat(100) }),
    });
    await expect(parseBody(request, z.unknown(), 32)).rejects.toMatchObject({
      status: 413,
    });
  });
  it("requires valid JSON and rejects unexpected command fields", async () => {
    const request = new Request("https://stead.test/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    await expect(parseBody(request, z.unknown())).rejects.toMatchObject({
      status: 400,
    });
    expect(
      createTaskSchema.safeParse({
        id: "task-1",
        title: "Test",
        instructions: "Test",
        kind: "create",
        secret: "no",
      }).success,
    ).toBe(false);
  });
  it("rejects absolute, traversal, empty-segment, and control-character paths", () => {
    for (const path of [
      "/file",
      "../file",
      "a/../b",
      "a//b",
      "a\\b",
      "a\n.html",
    ])
      expect(filePathSchema.safeParse(path).success).toBe(false);
    expect(filePathSchema.safeParse("outputs/chart.html").success).toBe(true);
  });
  it("gives generated HTML an opaque sandbox origin and blocks fetches and external subresources", () => {
    const file = {
      path: "chart.html",
      content: "<script>fetch('/api/workspace')</script>",
      mediaType: "text/html",
      size: 52,
    };
    const response = artifactResponse(
      file,
      new URL(
        "https://stead.test/api/tasks/one/files?path=chart.html&preview=1",
      ),
    );
    const csp = response.headers.get("Content-Security-Policy")!;
    expect(csp).toContain("sandbox allow-scripts;");
    expect(csp).not.toContain("allow-same-origin");
    expect(csp).toContain("connect-src 'none'");
    const download = artifactResponse(
      file,
      new URL(
        "https://stead.test/api/tasks/one/files?path=chart.html&download=1",
      ),
    );
    expect(download.headers.get("Content-Type")).toBe(
      "application/octet-stream",
    );
    expect(download.headers.get("Content-Disposition")).toContain(
      "attachment;",
    );
  });
});
