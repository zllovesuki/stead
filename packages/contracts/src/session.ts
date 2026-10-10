import { z } from "zod";

export const sessionSchema = z.object({
  authenticated: z.boolean(),
  configured: z.boolean(),
});
export const loginSchema = z
  .object({ token: z.string().min(1).max(4096) })
  .strict();
export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
export type Session = z.infer<typeof sessionSchema>;
