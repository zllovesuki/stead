import { z } from "zod";
import { idSchema, taskSummarySchema } from "./tasks";

export const noteSchema = z.object({
  id: idSchema,
  text: z.string(),
  source: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const responsibilitySchema = z.object({
  id: idSchema,
  title: z.string(),
  instructions: z.string(),
  intervalMinutes: z.number().int(),
  status: z.enum(["active", "stopped"]),
  nextRunAt: z.string().nullable(),
  lastTaskId: idSchema.nullable(),
  createdAt: z.string(),
});
export const workspaceSnapshotSchema = z.object({
  tasks: z.array(taskSummarySchema),
  notes: z.array(noteSchema),
  responsibilities: z.array(responsibilitySchema),
  limits: z.object({ maxActiveTasks: z.number(), maxFileBytes: z.number() }),
});
export const writeNoteSchema = z
  .object({
    text: z.string().trim().min(1).max(4000),
    source: z.string().trim().min(1).max(240).default("You"),
  })
  .strict();
export const createResponsibilitySchema = z
  .object({
    id: idSchema,
    title: z.string().trim().min(1).max(120),
    instructions: z.string().trim().min(1).max(8000),
    intervalMinutes: z.number().int().min(15).max(10080),
  })
  .strict();
export type Note = z.infer<typeof noteSchema>;
export type Responsibility = z.infer<typeof responsibilitySchema>;
export type WorkspaceSnapshot = z.infer<typeof workspaceSnapshotSchema>;
export type WriteNote = z.infer<typeof writeNoteSchema>;
export type CreateResponsibility = z.infer<typeof createResponsibilitySchema>;
