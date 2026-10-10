import { z } from "zod";

export const MAX_FILE_BYTES = 256 * 1024;
export const artifactSchema = z.object({
  path: z.string(),
  name: z.string(),
  mediaType: z.string(),
  size: z.number().int().nonnegative(),
});
export const filePathSchema = z
  .string()
  .min(1)
  .max(240)
  .refine(
    (value) =>
      !value.startsWith("/") &&
      !value.includes("\\") &&
      !value
        .split("/")
        .some((part) => !part || part === "." || part === "..") &&
      !Array.from(value).some(
        (character) =>
          character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      ),
    "Use a relative workspace file path without traversal.",
  );
export const uploadFileSchema = z
  .object({ path: filePathSchema, content: z.string().max(MAX_FILE_BYTES) })
  .strict();
export const taskFileSchema = z.object({
  path: z.string(),
  content: z.string(),
  mediaType: z.string(),
  size: z.number(),
});

export type Artifact = z.infer<typeof artifactSchema>;
export type TaskFile = z.infer<typeof taskFileSchema>;
export type UploadFile = z.infer<typeof uploadFileSchema>;
