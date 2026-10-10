import { z } from "zod";
import { artifactSchema, uploadFileSchema } from "./files";

export const MAX_ACTIVE_TASKS = 3;
export const idSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const taskKindSchema = z.enum(["research", "analysis", "create"]);
export const taskStatusSchema = z.enum([
  "queued",
  "running",
  "awaiting-input",
  "needs-resume",
  "completed",
  "failed",
  "stopped",
]);
export const correctionSchema = z.object({
  id: idSchema,
  text: z.string(),
  createdAt: z.string(),
  status: z.enum(["pending", "applied", "requires-resume"]),
});
export const activitySchema = z.object({
  id: idSchema,
  at: z.string(),
  kind: z.enum(["status", "tool", "message", "correction", "error"]),
  text: z.string(),
});
export const taskSummarySchema = z.object({
  id: idSchema,
  title: z.string(),
  instructions: z.string(),
  kind: taskKindSchema,
  status: taskStatusSchema,
  summary: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  artifacts: z.array(artifactSchema),
});
export const taskDetailSchema = taskSummarySchema.extend({
  files: z.array(artifactSchema),
  activity: z.array(activitySchema),
  corrections: z.array(correctionSchema),
});
export const createTaskSchema = z
  .object({
    id: idSchema,
    title: z.string().trim().min(1).max(120),
    instructions: z.string().trim().min(1).max(16000),
    kind: taskKindSchema,
    files: z.array(uploadFileSchema).max(4).default([]),
  })
  .strict();
export const steerTaskSchema = z
  .object({ id: idSchema, text: z.string().trim().min(1).max(8000) })
  .strict();
export type TaskKind = z.infer<typeof taskKindSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type Correction = z.infer<typeof correctionSchema>;
export type Activity = z.infer<typeof activitySchema>;
export type TaskSummary = z.infer<typeof taskSummarySchema>;
export type TaskDetail = z.infer<typeof taskDetailSchema>;
export type CreateTask = z.infer<typeof createTaskSchema>;
export type SteerTask = z.infer<typeof steerTaskSchema>;
