import { createWorkersAI } from "workers-ai-provider";
import type { Env } from "./env";

export const STEAD_MODEL = "@cf/zai-org/glm-5.3-flash";

/** Count actual provider attempts, including attempts that fail before streaming. */
export function createSteadModel(env: Env, consume: () => Promise<void>) {
  const binding = {
    async run(
      model: string,
      input: Record<string, unknown>,
      options: Record<string, unknown> = {},
    ) {
      if (model !== STEAD_MODEL || env.MODEL !== STEAD_MODEL)
        throw new Error("Unsupported model configuration");
      if (!env.GATEWAY_ID) throw new Error("AI Gateway is not configured");
      if (JSON.stringify(input).length > 180_000)
        throw new Error("Conversation context limit reached");
      await consume();
      return env.AI.run(
        STEAD_MODEL as keyof AiModels,
        {
          ...input,
          max_tokens: 4096,
          reasoning_effort: "low",
        } as never,
        { ...options, gateway: { id: env.GATEWAY_ID, skipCache: true } },
      );
    },
  } as unknown as Ai;
  return createWorkersAI({ binding })(STEAD_MODEL, { reasoning_effort: "low" });
}
