import { Think } from "@cloudflare/think";
import {
  getWorkspace,
  withWorkspace,
  type DurableObjectStorageLike,
  type WorkspaceClient,
  type WorkspaceModuleBackend,
  type WorkspaceOptions,
  type ThinkWorkspaceCompatibility,
} from "@cloudflare/computer";
import { WorkerJavaScriptBackend } from "@cloudflare/computer/backends/worker-javascript";
import type { Env } from "../env";
import {
  boundedFilesystem,
  readWorkspaceFile,
  writeWorkspaceFile,
  WORKSPACE_ROOT,
} from "./files";

class WorkspaceThink extends Think<Env> {
  computerOptions(): WorkspaceOptions {
    const javascript = new WorkerJavaScriptBackend({
      loader: this.env.LOADER,
      root: WORKSPACE_ROOT,
      access: "read-write",
      egress: { mode: "none" },
      allowGitNetwork: false,
      allowArtifactNetwork: false,
      maxConcurrentExecutions: 1,
      defaultTimeoutMs: 5000,
      maxTimeoutMs: 5000,
      maxSourceBytes: 32768,
      maxInputBytes: 8192,
      maxResultBytes: 8192,
      maxStdioBytes: 8192,
      maxCapabilityBytes: 1024 * 1024,
      maxCapabilityCalls: 128,
      maxCapabilityRequestBytes: 4 * 1024 * 1024,
      maxCapabilityResponseBytes: 4 * 1024 * 1024,
      maxDirectoryEntries: 64,
      maxConcurrentCapabilityCalls: 4,
      maxHostCallMs: 5000,
      maxRetainedExecutions: 4,
      retentionMs: 60000,
    });
    // The backend's mediated fs is the same bounded fs used by uploads and tools.
    // Git/artifact capabilities are outside this preview's file-only execution scope.
    const denied = new Proxy(
      {},
      {
        get() {
          return () => {
            throw new Error(
              "This capability is unavailable in task execution.",
            );
          };
        },
      },
    );
    const backend: WorkspaceModuleBackend = {
      id: javascript.id,
      type: javascript.type,
      protocol: "module",
      callable: true,
      connect: (host) =>
        javascript.connect({
          db: host.db,
          fs: boundedFilesystem(host.fs),
          git: denied as typeof host.git,
          artifacts: denied as typeof host.artifacts,
        }),
    };
    return {
      storage: this.ctx.storage as unknown as DurableObjectStorageLike,
      useThink: true,
      backends: [backend],
    };
  }
}

export class TaskWorkspaceBase extends withWorkspace(WorkspaceThink, (self) =>
  self.computerOptions(),
) {
  override workspaceBash = false;
  private computerPromise?: Promise<WorkspaceClient>;

  protected computer(): Promise<WorkspaceClient> {
    return (this.computerPromise ??= getWorkspace(this).then(
      async (workspace) => {
        await workspace.fs.mkdir(WORKSPACE_ROOT, { recursive: true });
        const fs = boundedFilesystem(workspace.fs);
        return new Proxy(workspace, {
          get: (target, property) =>
            property === "fs" ? fs : Reflect.get(target, property),
        });
      },
    ));
  }

  // Think's context and file tools use computer's files instead of creating a
  // second independent SQL workspace. TaskAgent limits the exposed tool set.
  override workspace: ThinkWorkspaceCompatibility = {
    readFile: async (path) =>
      (await readWorkspaceFile(await this.computer(), path))?.content ?? null,
    readFileBytes: async (path) => {
      const file = await readWorkspaceFile(await this.computer(), path);
      return file ? new TextEncoder().encode(file.content) : null;
    },
    writeFile: async (path, content) => {
      await writeWorkspaceFile(await this.computer(), path, content);
    },
    mkdir: async (path, options) => {
      await (await this.computer()).fs.mkdir(path, options);
    },
    rm: async (path, options) => {
      await (await this.computer()).fs.rm(path, options);
    },
    stat: async (path) => {
      const file = await readWorkspaceFile(await this.computer(), path);
      return file
        ? {
            path: file.path,
            name: file.path.split("/").pop()!,
            type: "file",
            mimeType: file.mediaType,
            size: file.size,
            createdAt: 0,
            updatedAt: 0,
          }
        : null;
    },
    readDir: async (path, options) => {
      const workspace = await this.computer();
      const entries = await workspace.fs.readdir(
        path === "/" || path === "." ? WORKSPACE_ROOT : path,
        {
          limit: Math.min(options?.limit ?? 64, 64),
          offset: options?.offset ?? 0,
        },
      );
      return entries.map((entry) => ({
        path: `${path}/${entry.name}`,
        name: entry.name,
        type: entry.isDirectory ? ("directory" as const) : ("file" as const),
        mimeType: "text/plain",
        size: entry.size,
        createdAt: entry.mtime,
        updatedAt: entry.mtime,
      }));
    },
    glob: async (pattern) => {
      const workspace = await this.computer();
      const entries = await workspace.fs.find(
        WORKSPACE_ROOT,
        pattern.replace(/^\/workspace\//, ""),
        { limit: 64 },
      );
      return Promise.all(
        entries.map(async (entry) => {
          const stat = await workspace.fs.stat(entry.path);
          return {
            path: entry.path,
            name: stat.name,
            type:
              entry.type === "dir" ? ("directory" as const) : ("file" as const),
            mimeType: "text/plain",
            size: stat.size,
            createdAt: stat.mtime,
            updatedAt: stat.mtime,
          };
        }),
      );
    },
  };
}
