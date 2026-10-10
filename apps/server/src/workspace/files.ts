import {
  MAX_FILE_BYTES,
  filePathSchema,
  type Artifact,
  type TaskFile,
} from "@stead/contracts";
import type { WorkspaceClient } from "@cloudflare/computer";

export const WORKSPACE_ROOT = "/workspace";
export const MAX_WORKSPACE_BYTES = 4 * 1024 * 1024;
export const MAX_WORKSPACE_ENTRIES = 64;
type Filesystem = WorkspaceClient["fs"];
const encoder = new TextEncoder();

export function workspacePath(path: string): string {
  const relative = path.startsWith(`${WORKSPACE_ROOT}/`)
    ? path.slice(WORKSPACE_ROOT.length + 1)
    : path;
  const parsed = filePathSchema.parse(relative);
  if (parsed.split("/").length > 8)
    throw new Error("Workspace paths may have at most eight components.");
  return `${WORKSPACE_ROOT}/${parsed}`;
}

export function mediaType(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase();
  return (
    (
      {
        html: "text/html",
        htm: "text/html",
        md: "text/markdown",
        csv: "text/csv",
        json: "application/json",
        js: "text/javascript",
        css: "text/css",
        txt: "text/plain",
      } as Record<string, string>
    )[extension ?? ""] ?? "text/plain"
  );
}

function missing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function safeComponents(fs: Filesystem, path: string): Promise<void> {
  let current = "";
  for (const part of path.split("/").filter(Boolean)) {
    current += `/${part}`;
    try {
      if ((await fs.lstat(current)).isSymbolicLink)
        throw new Error("Symbolic links are not supported in this workspace.");
    } catch (error) {
      if (missing(error)) return;
      throw error;
    }
  }
}

/** One mutation queue per underlying filesystem keeps quota checks and writes together. */
const guarded = new WeakMap<Filesystem, Filesystem>();
export function boundedFilesystem(fs: Filesystem): Filesystem {
  const previous = guarded.get(fs);
  if (previous) return previous;
  let tail = Promise.resolve();
  const mutate = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = tail.then(operation);
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
  const directoryPath = (path: string) =>
    path === WORKSPACE_ROOT ? path : workspacePath(path);
  async function capacity(path: string, bytes: number | null) {
    await safeComponents(fs, path);
    const entries = await fs.find(WORKSPACE_ROOT, "**/*", {
      limit: MAX_WORKSPACE_ENTRIES + 1,
    });
    const paths = new Set(entries.map((entry) => entry.path));
    let total = 0;
    for (const entry of entries) {
      if (entry.path !== path && entry.type === "file")
        total += (await fs.stat(entry.path)).size;
    }
    const parts = path.slice(WORKSPACE_ROOT.length + 1).split("/");
    for (let index = 1; index <= parts.length; index++)
      paths.add(`${WORKSPACE_ROOT}/${parts.slice(0, index).join("/")}`);
    if (paths.size > MAX_WORKSPACE_ENTRIES)
      throw new Error(
        "Workspace entry limit reached (64 files and directories).",
      );
    if (bytes !== null && total + bytes > MAX_WORKSPACE_BYTES)
      throw new Error("Workspace storage limit reached (4 MiB).");
  }
  const proxy = new Proxy(fs, {
    get(target, property) {
      if (property === "writeFile")
        return (
          input: string,
          content: unknown,
          options?: { exclusive?: boolean; mode?: number },
        ) =>
          mutate(async () => {
            const path = workspacePath(input);
            // Stream writes are deliberately excluded: every admitted write has a known byte bound.
            const bytes =
              typeof content === "string"
                ? encoder.encode(content)
                : content instanceof Uint8Array
                  ? content
                  : null;
            if (!bytes)
              throw new Error("Workspace writes must contain text or bytes.");
            if (bytes.byteLength > MAX_FILE_BYTES)
              throw new Error("File exceeds the 256 KiB limit.");
            await capacity(path, bytes.byteLength);
            await fs.mkdir(path.slice(0, path.lastIndexOf("/")), {
              recursive: true,
            });
            await fs.writeFile(path, bytes, options);
          });
      if (property === "mkdir")
        return (input: string, options?: { recursive?: boolean }) =>
          mutate(async () => {
            const path = directoryPath(input);
            if (path !== WORKSPACE_ROOT) await capacity(path, null);
            return fs.mkdir(path, options);
          });
      if (property === "symlink" || property === "rename")
        return () => {
          throw new Error("Workspace links and renames are not supported.");
        };
      if (property === "rm" || property === "chmod")
        return (input: string, options: never) =>
          mutate(async () => {
            const path = workspacePath(input);
            await safeComponents(fs, path);
            return property === "rm"
              ? fs.rm(path, options)
              : fs.chmod(path, options);
          });
      if (
        [
          "readFile",
          "stat",
          "lstat",
          "readlink",
          "readdir",
          "find",
          "ls",
        ].includes(String(property))
      ) {
        return async (input: string, ...args: unknown[]) => {
          const path = directoryPath(input);
          await safeComponents(fs, path);
          const method = Reflect.get(target, property) as (
            ...arguments_: unknown[]
          ) => unknown;
          return method.call(target, path, ...args);
        };
      }
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  guarded.set(fs, proxy);
  guarded.set(proxy, proxy);
  return proxy;
}

export async function readWorkspaceFile(
  workspace: WorkspaceClient,
  input: string,
): Promise<TaskFile | null> {
  const path = workspacePath(input);
  const fs = boundedFilesystem(workspace.fs);
  try {
    const stat = await fs.stat(path);
    if (!stat.isFile) return null;
    if (stat.size > MAX_FILE_BYTES)
      throw new Error("File exceeds the 256 KiB limit.");
    const bytes = new Uint8Array(
      await new Response(await fs.readFile(path)).arrayBuffer(),
    );
    if (bytes.byteLength > MAX_FILE_BYTES)
      throw new Error("File exceeds the 256 KiB limit.");
    const content = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: false,
    }).decode(bytes);
    return {
      path: path.slice(WORKSPACE_ROOT.length + 1),
      content,
      mediaType: mediaType(path),
      size: bytes.byteLength,
    };
  } catch (error) {
    if (missing(error)) return null;
    throw error;
  }
}

export async function writeWorkspaceFile(
  workspace: WorkspaceClient,
  path: string,
  content: string,
): Promise<TaskFile> {
  await boundedFilesystem(workspace.fs).writeFile(workspacePath(path), content);
  const result = await readWorkspaceFile(workspace, path);
  if (!result) throw new Error("File was not saved.");
  return result;
}

export async function listWorkspaceFiles(
  workspace: WorkspaceClient,
): Promise<Artifact[]> {
  const fs = boundedFilesystem(workspace.fs);
  const entries = await fs.find(WORKSPACE_ROOT, "**/*", {
    limit: MAX_WORKSPACE_ENTRIES,
  });
  return Promise.all(
    entries
      .filter((entry) => entry.type === "file")
      .map(async (entry) => ({
        path: entry.path.slice(WORKSPACE_ROOT.length + 1),
        name: entry.path.split("/").pop()!,
        mediaType: mediaType(entry.path),
        size: (await fs.stat(entry.path)).size,
      })),
  );
}

export async function checkArtifact(
  workspace: WorkspaceClient,
  path: string,
  name?: string,
): Promise<Artifact> {
  const file = await readWorkspaceFile(workspace, path);
  if (!file || !file.content.trim())
    throw new Error("Publish requires an existing, nonempty UTF-8 file.");
  return {
    path: file.path,
    name: name?.trim().slice(0, 120) || file.path.split("/").pop()!,
    mediaType: file.mediaType,
    size: file.size,
  };
}
