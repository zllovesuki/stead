import type {
  ChatErrorContext,
  ChatResponseResult,
  TurnContext,
  ToolCallContext,
  ToolCallResultContext,
} from "@cloudflare/think";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type {
  Artifact,
  CreateTask,
  SteerTask,
  TaskDetail,
} from "@stead/contracts";
import { createSteadModel } from "@/server/model";
import { DomainError } from "../http/errors";
import { TaskWorkspaceBase } from "../workspace/base";
import {
  checkArtifact,
  listWorkspaceFiles,
  readWorkspaceFile,
  writeWorkspaceFile,
} from "../workspace/files";
import { createTaskTools } from "../tools/task";
import {
  addActivity,
  isActive,
  taskPrompt,
  taskRecord,
  type TaskRecord,
} from "./task-state";

/** The retained facet owns task outcomes; SDK run status only describes a turn. */
export class TaskAgent extends TaskWorkspaceBase {
  maxSteps = 12;
  sendReasoning = false;
  workspaceBash = false as const;
  chatRecovery = { maxAttempts: 1, maxRecoveryWork: 1 };
  private starting = false;
  private toolQueue: Promise<unknown> = Promise.resolve();

  private sequence<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.toolQueue.then(operation);
    this.toolQueue = result.catch(() => undefined);
    return result;
  }

  private async record() {
    const record = await this.ctx.storage.get<TaskRecord>("task");
    if (!record) throw new DomainError("task_missing", 404, "Task not found");
    return record;
  }

  private async change(update: (record: TaskRecord) => void) {
    return this.ctx.storage.transaction(async (txn) => {
      const record = await txn.get<TaskRecord>("task");
      if (!record) throw new DomainError("task_missing", 404, "Task not found");
      update(record);
      await txn.put("task", record);
      return record;
    });
  }

  async initialize(input: CreateTask, notes: string) {
    if (await this.ctx.storage.get("task")) return;
    for (const file of input.files)
      await writeWorkspaceFile(await this.computer(), file.path, file.content);
    await this.ctx.storage.put("task", taskRecord(input, notes));
  }

  async inspect(): Promise<TaskDetail> {
    let record = await this.record();
    if (isActive(record.detail.status)) {
      const run = record.runId
        ? await this.inspectAgentToolRun(record.runId)
        : null;
      if (
        (!run && !this.starting) ||
        (run && !["starting", "running"].includes(run.status))
      ) {
        record = await this.change((current) => {
          if (
            !isActive(current.detail.status) ||
            current.runId !== record.runId
          )
            return;
          current.detail.status = "needs-resume";
          current.detail.summary =
            "Execution ended without a checked result. Review saved work and resume when ready.";
          addActivity(current, "status", current.detail.summary);
        });
      }
    }
    return {
      ...record.detail,
      files: await listWorkspaceFiles(await this.computer()),
    };
  }

  async start() {
    this.starting = true;
    try {
      return await this.startExecution();
    } finally {
      this.starting = false;
    }
  }

  private async startExecution() {
    const record = await this.record();
    if (record.runId && isActive((await this.inspect()).status))
      return this.inspect();
    if (record.detail.status === "completed") return record.detail;
    const prepared = await this.change((current) => {
      current.execution++;
      current.turnRequestId = undefined;
      current.calls = current.searches = current.executions = 0;
      current.detail.status = "queued";
      current.detail.summary = "Queued for execution.";
      // The execution identity is durable before the SDK accepts its work.
      current.runId = `${current.detail.id}-${current.execution}`;
      addActivity(current, "status", "Execution requested.");
    });
    try {
      await this.startAgentToolRun(
        "Continue the task from its saved files. Apply all listed user corrections. Save and publish the requested result.",
        { runId: prepared.runId!, eventDelivery: "terminal" },
      );
    } catch (error) {
      await this.change((current) => {
        if (
          current.execution !== prepared.execution ||
          !isActive(current.detail.status)
        )
          return;
        current.detail.status = "needs-resume";
        current.detail.summary =
          "Execution could not start. Resume to try again.";
        addActivity(current, "error", current.detail.summary);
      });
      throw error;
    }
    return this.inspect();
  }

  async correct(input: SteerTask) {
    const prior = await this.record();
    const existing = prior.detail.corrections.find((c) => c.id === input.id);
    if (existing) {
      if (existing.text !== input.text)
        throw new DomainError(
          "correction_conflict",
          409,
          "This correction id was already used for different instructions",
        );
      return this.inspect();
    }
    await this.change((current) => {
      const duplicate = current.detail.corrections.find(
        (c) => c.id === input.id,
      );
      if (duplicate) {
        if (duplicate.text !== input.text)
          throw new DomainError(
            "correction_conflict",
            409,
            "This correction id was already used for different instructions",
          );
        return;
      }
      current.detail.corrections.push({
        ...input,
        createdAt: new Date().toISOString(),
        status: "requires-resume",
      });
      current.detail.status = "needs-resume";
      current.detail.summary =
        "Correction saved. Resume to apply it; an operation already underway may still finish.";
      addActivity(current, "correction", input.text);
    });
    if (prior.runId)
      await this.cancelAgentToolRun(
        prior.runId,
        "User correction saved; awaiting explicit resume",
      );
    return this.inspect();
  }

  async stop() {
    const record = await this.change((current) => {
      if (current.detail.status === "completed") return;
      current.detail.status = "stopped";
      current.detail.summary =
        "Stopped. Saved files remain available; an operation already underway may still finish.";
      addActivity(current, "status", current.detail.summary);
    });
    if (record.runId)
      await this.cancelAgentToolRun(record.runId, "Stopped by user");
    return this.inspect();
  }

  async readArtifact(path: string) {
    return readWorkspaceFile(await this.computer(), path);
  }
  async writeUpload(path: string, content: string) {
    return this.sequence(async () => {
      const status = (await this.inspect()).status;
      if (isActive(status) || status === "completed")
        throw new DomainError(
          "task_active",
          409,
          "Stop active work or add a correction to completed work before changing its files",
        );
      return writeWorkspaceFile(await this.computer(), path, content);
    });
  }

  async assertWritable() {
    const record = await this.record();
    if (
      record.detail.status !== "running" ||
      record.turnRequestId !== this.activeTurn?.requestId
    )
      throw new Error("Task is no longer running; await explicit resume");
  }

  private async consume(
    kind: "calls" | "searches" | "executions",
    limit: number,
  ) {
    await this.change((current) => {
      if (
        current.detail.status !== "running" ||
        current.turnRequestId !== this.activeTurn?.requestId
      )
        throw new Error("Task has been stopped or redirected");
      if (current[kind] >= limit)
        throw new Error(
          `${kind} budget reached; inspect the task before resuming`,
        );
      current[kind]++;
    });
  }

  getModel() {
    return createSteadModel(this.env, () => this.consume("calls", 12));
  }
  getSystemPrompt() {
    return "You are Stead's task worker. Follow the current task instructions and save a checked result.";
  }

  async beforeTurn(context: TurnContext) {
    const reserved = await this.record();
    const run = reserved.runId
      ? await this.inspectAgentToolRun(reserved.runId, { reconcile: false })
      : null;
    const record = await this.change((current) => {
      if (
        context.abortSignal?.aborted ||
        current.detail.status !== "queued" ||
        current.runId !== reserved.runId ||
        context.requestId !== run?.requestId
      )
        throw new Error("No task execution is authorized");
      current.turnRequestId = context.requestId;
      current.detail.status = "running";
      current.detail.summary = "Working in the saved workspace.";
      for (const correction of current.detail.corrections)
        correction.status = "applied";
      addActivity(current, "status", current.detail.summary);
    });
    return {
      instructions: taskPrompt(record),
      maxSteps: 12,
      maxOutputTokens: 4096,
      maxRetries: 0,
      stopWhen: async () => (await this.record()).detail.status !== "running",
      activeTools: Object.keys(this.getTools()),
      providerOptions: { "workers-ai": { reasoning_effort: "low" } },
    };
  }

  async beforeToolCall(_context: ToolCallContext) {
    await this.assertWritable();
  }
  async afterToolCall(context: ToolCallResultContext) {
    await this.change((current) =>
      addActivity(
        current,
        "tool",
        `${context.toolName}: ${context.success ? "finished" : "failed"}`,
      ),
    );
  }

  async publishArtifact(artifact: Artifact, summary: string) {
    const checked = await checkArtifact(
      await this.computer(),
      artifact.path,
      artifact.name,
    );
    await this.change((current) => {
      if (
        current.detail.status !== "running" ||
        current.turnRequestId !== this.activeTurn?.requestId
      )
        throw new Error(
          "Result saved after task control changed; resume before publishing it",
        );
      current.detail.artifacts = [
        ...current.detail.artifacts.filter(
          (item) => item.path !== checked.path,
        ),
        checked,
      ];
      current.detail.status = "completed";
      current.detail.summary = summary;
      addActivity(current, "status", `Completed: ${summary}`);
    });
    return checked;
  }

  getTools(): ToolSet {
    const tools: ToolSet = {
      ...createTaskTools({
        workspace: () => this.computer(),
        env: this.env,
        consumeSearch: () => this.consume("searches", 3),
        consumeExecution: () => this.consume("executions", 6),
        assertWritable: () => this.assertWritable(),
        publishArtifact: (artifact: Artifact, summary: string) =>
          this.publishArtifact(artifact, summary),
      }),
      request_input: tool({
        description: "Pause the task and ask for a necessary user decision.",
        inputSchema: z.object({ question: z.string().min(1).max(2000) }),
        execute: async ({ question }) => {
          await this.change((current) => {
            if (
              current.detail.status !== "running" ||
              current.turnRequestId !== this.activeTurn?.requestId
            )
              throw new Error(
                "Task control changed before the question was saved",
              );
            current.detail.status = "awaiting-input";
            current.detail.summary = question;
            addActivity(current, "status", question);
          });
          return { status: "awaiting-input", question };
        },
      }),
    };
    // AI SDK may propose parallel calls. Finish each operation before publication
    // can inspect its bytes; queued calls after completion must re-check authority.
    return Object.fromEntries(
      Object.entries(tools).map(([name, definition]) => {
        const execute = definition.execute;
        if (!execute) return [name, definition];
        return [
          name,
          {
            ...definition,
            execute: async (
              input: unknown,
              options: Parameters<typeof execute>[1],
            ) => {
              return this.sequence(async () => {
                await this.assertWritable();
                return execute(input, options);
              });
            },
          },
        ];
      }),
    );
  }

  async onChatResponse(result: ChatResponseResult) {
    await this.change((current) => {
      if (
        !isActive(current.detail.status) ||
        current.turnRequestId !== result.requestId
      )
        return;
      current.detail.status = "needs-resume";
      current.detail.summary =
        "The turn ended without publishing a checked result. Review its activity and resume.";
      addActivity(current, "status", current.detail.summary);
    });
  }

  async onChatError(_error: unknown, context?: ChatErrorContext) {
    await this.change((current) => {
      if (
        !isActive(current.detail.status) ||
        current.turnRequestId !== context?.requestId
      )
        return;
      current.detail.status = "needs-resume";
      current.detail.summary =
        "Execution was interrupted or reached a limit. Saved files remain available. Resume explicitly to continue.";
      addActivity(current, "error", current.detail.summary);
    });
  }

  async onChatRecovery() {
    return { continue: false };
  }
}
