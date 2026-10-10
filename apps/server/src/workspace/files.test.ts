import { describe, expect, it } from "vitest";
import type { WorkspaceClient } from "@cloudflare/computer";
import { MAX_FILE_BYTES } from "@stead/contracts";
import {
  boundedFilesystem,
  checkArtifact,
  MAX_WORKSPACE_BYTES,
  readWorkspaceFile,
  workspacePath,
  writeWorkspaceFile,
} from "./files";

function memoryWorkspace() {
  const files = new Map<string, Uint8Array>();
  const directories = new Set(["/workspace"]);
  const links = new Set<string>();
  const stat = async (path: string) => {
    if (!files.has(path) && !directories.has(path) && !links.has(path))
      throw Object.assign(new Error("missing"), { code: "ENOENT" });
    return {
      name: path.split("/").pop()!,
      isFile: files.has(path),
      isDirectory: directories.has(path),
      isSymbolicLink: links.has(path),
      size: files.get(path)?.byteLength ?? 0,
      mtime: 0,
      inode: 1,
      mode: 0,
    };
  };
  const fs = {
    lstat: stat,
    stat,
    find: async () =>
      [...directories]
        .filter((path) => path !== "/workspace")
        .map((path) => ({ path, type: "dir" }))
        .concat([...files.keys()].map((path) => ({ path, type: "file" }))),
    mkdir: async (path: string) => {
      directories.add(path);
    },
    writeFile: async (path: string, bytes: Uint8Array) => {
      files.set(path, bytes);
    },
    readFile: async (path: string) => new Response(files.get(path)).body!,
  } as unknown as WorkspaceClient["fs"];
  return { workspace: { fs } as WorkspaceClient, files, links };
}

describe("task workspace boundaries", () => {
  it("accepts relative files and the execution root, rejecting traversal and ambiguous paths", () => {
    expect(workspacePath("report.md")).toBe("/workspace/report.md");
    expect(workspacePath("/workspace/data/input.csv")).toBe(
      "/workspace/data/input.csv",
    );
    for (const path of [
      "../secret",
      "/other/file",
      "/workspace/../secret",
      "a//b",
      "a\\b",
      "a/./b",
      "a\0b",
      "a\nb",
      "/workspace",
      "a/b/c/d/e/f/g/h/i",
    ]) {
      expect(() => workspacePath(path)).toThrow();
    }
  });

  it("checks byte size rather than character count before saving", async () => {
    const { workspace, files } = memoryWorkspace();
    await expect(
      writeWorkspaceFile(workspace, "large.txt", "é".repeat(MAX_FILE_BYTES)),
    ).rejects.toThrow("256 KiB");
    expect(files.size).toBe(0);
  });

  it("serializes quota admission so concurrent writes cannot exceed total storage", async () => {
    const { workspace, files } = memoryWorkspace();
    for (
      let index = 0;
      index < MAX_WORKSPACE_BYTES / MAX_FILE_BYTES - 1;
      index++
    )
      files.set(`/workspace/${index}.txt`, new Uint8Array(MAX_FILE_BYTES));
    const fs = boundedFilesystem(workspace.fs);
    const results = await Promise.allSettled([
      fs.writeFile("one.txt", new Uint8Array(MAX_FILE_BYTES)),
      fs.writeFile("two.txt", new Uint8Array(MAX_FILE_BYTES)),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      [...files.values()].reduce((sum, bytes) => sum + bytes.byteLength, 0),
    ).toBe(MAX_WORKSPACE_BYTES);
  });

  it("counts directories and rejects links for reads and writes", async () => {
    const { workspace, files, links } = memoryWorkspace();
    for (let index = 0; index < 63; index++)
      files.set(`/workspace/${index}.txt`, new Uint8Array(1));
    await expect(
      writeWorkspaceFile(workspace, "new/file.txt", "x"),
    ).rejects.toThrow("entry limit");
    links.add("/workspace/linked");
    await expect(
      readWorkspaceFile(workspace, "linked/file.txt"),
    ).rejects.toThrow("Symbolic links");
    await expect(
      writeWorkspaceFile(workspace, "linked/file.txt", "x"),
    ).rejects.toThrow("Symbolic links");
  });

  it("publishes only existing nonempty UTF-8 files and derives media type from the path", async () => {
    const { workspace, files } = memoryWorkspace();
    await expect(checkArtifact(workspace, "missing.html")).rejects.toThrow(
      "existing",
    );
    await writeWorkspaceFile(workspace, "empty.txt", "   ");
    await expect(checkArtifact(workspace, "empty.txt")).rejects.toThrow(
      "nonempty",
    );
    files.set("/workspace/binary.txt", new Uint8Array([255]));
    await expect(checkArtifact(workspace, "binary.txt")).rejects.toThrow();
    await writeWorkspaceFile(
      workspace,
      "chart.html",
      "<!doctype html><h1>Result</h1>",
    );
    expect(await checkArtifact(workspace, "chart.html", " Chart ")).toEqual({
      path: "chart.html",
      name: "Chart",
      mediaType: "text/html",
      size: 30,
    });
    await writeWorkspaceFile(
      workspace,
      "chart.txt",
      "<script>alert(1)</script>",
    );
    expect((await checkArtifact(workspace, "chart.txt")).mediaType).toBe(
      "text/plain",
    );
  });
});
