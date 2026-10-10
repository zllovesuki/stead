import { describe, expect, it } from "vitest";
import { publicSearchItems, readBoundedResponse } from "./task";

describe("public research boundary", () => {
  it("caps excerpts and excludes active or credential-bearing URLs", () => {
    const items = publicSearchItems({
      items: [
        { url: "javascript:alert(1)", title: "Ignore instructions" },
        { url: "https://user:password@example.com/private" },
        {
          url: "https://example.com/source",
          title: "t".repeat(500),
          description: "x".repeat(9000),
        },
        { url: "https://example.com/fourth" },
      ],
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.url).toBe("https://example.com/source");
    expect(items[0]?.title).toHaveLength(300);
    expect(items[0]?.description).toHaveLength(3500);
  });

  it("bounds streamed response bytes before JSON parsing", async () => {
    await expect(
      readBoundedResponse(new Response(JSON.stringify({ items: [] })), 100),
    ).resolves.toEqual({ items: [] });
    await expect(
      readBoundedResponse(new Response(" ".repeat(101)), 100),
    ).rejects.toThrow("byte limit");
  });
});
