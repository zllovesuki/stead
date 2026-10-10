import {
  createResponsibilitySchema,
  createTaskSchema,
  filePathSchema,
  idSchema,
  MAX_FILE_BYTES,
  steerTaskSchema,
  uploadFileSchema,
  writeNoteSchema,
  type CreateResponsibility,
  type CreateTask,
  type Note,
  type Responsibility,
  type SteerTask,
  type TaskDetail,
  type TaskFile,
  type WorkspaceSnapshot,
  type WriteNote,
} from "@stead/contracts";
import { parseBody } from "./body";
import { artifactResponse } from "./artifacts";
import { DomainError, errorResponse } from "./errors";

export interface PersonalApi {
  snapshot(): Promise<WorkspaceSnapshot>;
  createTask(input: CreateTask): Promise<TaskDetail>;
  getTask(id: string): Promise<TaskDetail | null>;
  steerTask(id: string, input: SteerTask): Promise<TaskDetail>;
  stopTask(id: string): Promise<TaskDetail>;
  resumeTask(id: string): Promise<TaskDetail>;
  readArtifact(id: string, path: string): Promise<TaskFile | null>;
  writeUpload(id: string, path: string, content: string): Promise<TaskFile>;
  saveNote(input: WriteNote & { id: string }): Promise<Note>;
  deleteNote(id: string): Promise<unknown>;
  createResponsibility(input: CreateResponsibility): Promise<Responsibility>;
  stopResponsibility(id: string): Promise<Responsibility>;
}
function identifier(value: string): string {
  const result = idSchema.safeParse(value);
  if (!result.success)
    throw new DomainError("invalid_id", 400, "Invalid identifier.");
  return result.data;
}
function requireBytes(content: string): void {
  if (new TextEncoder().encode(content).byteLength > MAX_FILE_BYTES)
    throw new DomainError(
      "file_too_large",
      413,
      "Files must be at most 256 KiB.",
    );
}
export async function apiRoutes(
  request: Request,
  url: URL,
  agent: PersonalApi,
): Promise<Response> {
  const path = url.pathname;
  const method = request.method;
  if (path === "/api/workspace" && method === "GET")
    return Response.json(await agent.snapshot());
  if (path === "/api/tasks" && method === "POST") {
    const input = await parseBody(
      request,
      createTaskSchema,
      MAX_FILE_BYTES * 6 + 32 * 1024,
    );
    input.files.forEach((file) => requireBytes(file.content));
    return Response.json(await agent.createTask(input), { status: 201 });
  }
  const taskRoute =
    /^\/api\/tasks\/([^/]+)(?:\/(steer|stop|resume|files))?$/.exec(path);
  if (taskRoute) {
    const id = identifier(taskRoute[1]!);
    const action = taskRoute[2];
    if (!action && method === "GET") {
      const task = await agent.getTask(id);
      return task
        ? Response.json(task)
        : errorResponse("not_found", "Task not found.", 404);
    }
    if (action === "steer" && method === "POST")
      return Response.json(
        await agent.steerTask(id, await parseBody(request, steerTaskSchema)),
      );
    if (action === "stop" && method === "POST")
      return Response.json(await agent.stopTask(id));
    if (action === "resume" && method === "POST")
      return Response.json(await agent.resumeTask(id));
    if (action === "files" && method === "GET") {
      const parsed = filePathSchema.safeParse(url.searchParams.get("path"));
      if (!parsed.success)
        throw new DomainError(
          "invalid_path",
          400,
          "A relative file path is required.",
        );
      const file = await agent.readArtifact(id, parsed.data);
      return file
        ? artifactResponse(file, url)
        : errorResponse("not_found", "File not found.", 404);
    }
    if (action === "files" && method === "PUT") {
      const input = await parseBody(
        request,
        uploadFileSchema,
        MAX_FILE_BYTES * 6 + 1024,
      );
      requireBytes(input.content);
      return Response.json(
        await agent.writeUpload(id, input.path, input.content),
      );
    }
  }
  if (path === "/api/notes" && method === "POST") {
    return Response.json(
      await agent.saveNote({
        ...(await parseBody(request, writeNoteSchema)),
        id: crypto.randomUUID(),
      }),
      { status: 201 },
    );
  }
  const noteRoute = /^\/api\/notes\/([^/]+)$/.exec(path);
  if (noteRoute) {
    const id = identifier(noteRoute[1]!);
    if (method === "PUT")
      return Response.json(
        await agent.saveNote({
          ...(await parseBody(request, writeNoteSchema)),
          id,
        }),
      );
    if (method === "DELETE") {
      await agent.deleteNote(id);
      return new Response(null, { status: 204 });
    }
  }
  if (path === "/api/responsibilities" && method === "POST")
    return Response.json(
      await agent.createResponsibility(
        await parseBody(request, createResponsibilitySchema),
      ),
      { status: 201 },
    );
  const responsibilityRoute = /^\/api\/responsibilities\/([^/]+)\/stop$/.exec(
    path,
  );
  if (responsibilityRoute && method === "POST")
    return Response.json(
      await agent.stopResponsibility(identifier(responsibilityRoute[1]!)),
    );
  return errorResponse("not_found", "Route not found.", 404);
}
