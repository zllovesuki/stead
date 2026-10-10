import {
  apiErrorSchema,
  sessionSchema,
  taskDetailSchema,
  taskFileSchema,
  workspaceSnapshotSchema,
  type CreateTask,
  type CreateResponsibility,
  type WriteNote,
  type UploadFile,
} from "@stead/contracts";
import type { z } from "zod";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = apiErrorSchema.safeParse(body);
    throw new ApiError(
      response.status,
      error.success ? error.data.error.code : "request_failed",
      error.success
        ? error.data.error.message
        : `Request failed (${response.status}). Try again.`,
    );
  }
  return body;
}
async function read<T>(
  path: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
): Promise<T> {
  return schema.parse(await request(path, { signal }));
}
function command(path: string, body: unknown, method = "POST") {
  return request(path, { method, body: JSON.stringify(body) });
}
const taskPath = (id: string) => `/api/tasks/${encodeURIComponent(id)}`;
export const api = {
  session: (signal?: AbortSignal) =>
    read("/api/session", sessionSchema, signal),
  login: (token: string) => command("/api/login", { token }),
  logout: () => command("/api/logout", {}),
  workspace: (signal?: AbortSignal) =>
    read("/api/workspace", workspaceSnapshotSchema, signal),
  task: (id: string, signal?: AbortSignal) =>
    read(taskPath(id), taskDetailSchema, signal),
  createTask: (input: CreateTask) => command("/api/tasks", input),
  steerTask: (task: string, input: { id: string; text: string }) =>
    command(`${taskPath(task)}/steer`, input),
  taskAction: (id: string, action: "stop" | "resume") =>
    command(`${taskPath(id)}/${action}`, {}),
  file: (id: string, path: string, signal?: AbortSignal) =>
    read(
      `${taskPath(id)}/files?${new URLSearchParams({ path })}`,
      taskFileSchema,
      signal,
    ),
  fileUrl: (id: string, path: string, mode: "download" | "preview") =>
    `${taskPath(id)}/files?${new URLSearchParams({ path, [mode]: "1" })}`,
  upload: (id: string, file: UploadFile) =>
    command(`${taskPath(id)}/files`, file, "PUT"),
  writeNote: (input: WriteNote, id?: string) =>
    command(
      id ? `/api/notes/${encodeURIComponent(id)}` : "/api/notes",
      input,
      id ? "PUT" : "POST",
    ),
  deleteNote: (id: string) =>
    request(`/api/notes/${encodeURIComponent(id)}`, { method: "DELETE" }),
  createResponsibility: (input: CreateResponsibility) =>
    command("/api/responsibilities", input),
  stopResponsibility: (id: string) =>
    command(`/api/responsibilities/${encodeURIComponent(id)}/stop`, {}),
};
export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Try again.";
}
