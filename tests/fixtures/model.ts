import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4Content,
  LanguageModelV4StreamPart,
} from "@ai-sdk/provider";
import type { ModelGate } from "./gate";

export const STEAD_MODEL = "@cf/zai-org/glm-5.3-flash";

const usage = {
  inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 0, text: 0, reasoning: 0 },
};

function textOf(options: LanguageModelV4CallOptions) {
  return options.prompt
    .map((message) =>
      typeof message.content === "string"
        ? message.content
        : message.content
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("\n"),
    )
    .join("\n");
}

function toolCall(
  name: string,
  input: Record<string, unknown>,
): LanguageModelV4Content[] {
  return [
    {
      type: "tool-call",
      toolCallId: crypto.randomUUID(),
      toolName: name,
      input: JSON.stringify(input),
    },
  ];
}

function output(options: LanguageModelV4CallOptions): LanguageModelV4Content[] {
  const text = textOf(options);
  const isTask = options.tools?.some(
    (candidate) => candidate.name === "execute_javascript",
  );
  if (!isTask)
    return [
      {
        type: "text",
        text: "The answer is 42. I can keep talking while your tasks work in the background.",
      },
    ];
  if (text.includes("[fixture:no-result]"))
    return [{ type: "text", text: "I have not saved a result." }];

  const lastUser = options.prompt.findLastIndex(
    (message) => message.role === "user",
  );
  const turn = options.prompt.slice(lastUser + 1);
  const results = turn.flatMap((message) =>
    message.role === "tool" ? message.content : [],
  );
  if (
    results.some(
      (part) =>
        part.type === "tool-result" && part.toolName === "publish_result",
    )
  )
    return [{ type: "text", text: "The checked result is saved." }];
  if (
    results.some(
      (part) =>
        part.type === "tool-result" && part.toolName === "execute_javascript",
    )
  ) {
    return toolCall("publish_result", {
      path: "result.json",
      title: "Dataset analysis",
      summary: "Calculated the uploaded values and saved the result.",
    });
  }

  const multiplier = /Multiply the result by 3/i.test(text) ? 3 : 1;
  return toolCall("execute_javascript", {
    source: `import { readFile, writeFile } from "node:fs/promises";
export default async function(input) {
  const csv = await readFile("/workspace/input.csv", "utf8");
  const values = csv.trim().split(/\\r?\\n/).slice(1).map(Number);
  const result = { sum: values.reduce((a, b) => a + b, 0) * input.multiplier, count: values.length, multiplier: input.multiplier };
  await writeFile("/workspace/result.json", JSON.stringify(result));
  return result;
}`,
    input: { multiplier },
  });
}

/** A deterministic AI SDK provider; product agents and tools remain unchanged. */
export function createSteadModel(
  environment: unknown,
  consume: () => Promise<void>,
): LanguageModelV4 {
  async function prepare(options: LanguageModelV4CallOptions) {
    await consume();
    const text = textOf(options);
    const gate = (
      environment as { MODEL_GATE?: DurableObjectNamespace<ModelGate> }
    ).MODEL_GATE;
    const marker = /\[fixture:[^\]]+\]/.exec(text)?.[0];
    if (
      gate &&
      marker &&
      options.tools?.some(
        (candidate) => candidate.name === "execute_javascript",
      )
    ) {
      // Real test-only RPC avoids sharing promises or mutable state across the
      // task facet and test runner. Deliberately do not honour abort here.
      await gate.getByName(marker).wait();
    }
    return output(options);
  }
  return {
    specificationVersion: "v4",
    provider: "stead-test",
    modelId: "deterministic-preview",
    supportedUrls: {},
    async doGenerate(options) {
      const content = await prepare(options);
      return {
        content,
        usage,
        warnings: [],
        finishReason: {
          unified: content.some((part) => part.type === "tool-call")
            ? "tool-calls"
            : "stop",
          raw: undefined,
        },
      };
    },
    async doStream(options) {
      const content = await prepare(options);
      const parts: LanguageModelV4StreamPart[] = [
        { type: "stream-start", warnings: [] },
      ];
      for (const part of content) {
        if (part.type === "text")
          parts.push(
            { type: "text-start", id: "text" },
            { type: "text-delta", id: "text", delta: part.text },
            { type: "text-end", id: "text" },
          );
        else if (part.type === "tool-call") parts.push(part);
      }
      parts.push({
        type: "finish",
        usage,
        finishReason: {
          unified: content.some((part) => part.type === "tool-call")
            ? "tool-calls"
            : "stop",
          raw: undefined,
        },
      });
      return {
        stream: new ReadableStream({
          start(controller) {
            for (const part of parts) controller.enqueue(part);
            controller.close();
          },
        }),
      };
    },
  };
}
