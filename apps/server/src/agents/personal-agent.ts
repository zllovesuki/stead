import { Think } from "@cloudflare/think";
import {
  MAX_ACTIVE_TASKS,
  MAX_FILE_BYTES,
  createTaskSchema,
  createResponsibilitySchema,
  idSchema,
  steerTaskSchema,
  writeNoteSchema,
  type CreateTask,
  type CreateResponsibility,
  type Note,
  type Responsibility,
  type SteerTask,
  type WriteNote,
  type WorkspaceSnapshot,
} from "@stead/contracts";
import type { Env } from "../env";
import { DomainError } from "../http/errors";
import { createSteadModel } from "@/server/model";
import { TaskAgent } from "./task-agent";
import { isActive } from "./task-state";
import { personalTools } from "./personal-tools";

interface SavedResponsibility {
  value: Responsibility;
  scheduleId?: string;
}

export class PersonalAgent extends Think<Env> {
  maxSteps = 6;
  sendReasoning = false;
  workspaceBash = false as const;
  chatRecovery = { maxAttempts: 1, maxRecoveryWork: 1 };
  private admission: Promise<unknown> = Promise.resolve();

  /** Admission is serialized locally; retained child records remain the source of task truth. */
  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const pending = this.admission.then(work, work);
    this.admission = pending.catch(() => undefined);
    return pending;
  }

  private async ids() {
    return (await this.ctx.storage.get<string[]>("taskIds")) ?? [];
  }
  private async child(id: string) {
    idSchema.parse(id);
    if (!(await this.ids()).includes(id))
      throw new DomainError("task_missing", 404, "Task not found");
    return this.subAgent(TaskAgent, id);
  }

  async snapshot(): Promise<WorkspaceSnapshot> {
    const tasks = await Promise.all(
      (await this.ids()).map((id) => this.getTask(id)),
    );
    return {
      tasks: tasks
        .filter((value) => value !== null)
        .map(
          ({
            activity: _activity,
            corrections: _corrections,
            files: _files,
            ...summary
          }) => summary,
        )
        .reverse(),
      notes: [
        ...(await this.ctx.storage.list<Note>({ prefix: "note:" })).values(),
      ],
      responsibilities: [
        ...(
          await this.ctx.storage.list<SavedResponsibility>({
            prefix: "responsibility:",
          })
        ).values(),
      ].map((saved) => saved.value),
      limits: {
        maxActiveTasks: MAX_ACTIVE_TASKS,
        maxFileBytes: MAX_FILE_BYTES,
      },
    };
  }

  async getTask(id: string) {
    if (!(await this.ids()).includes(id)) return null;
    return (await this.child(id)).inspect();
  }

  async createTask(input: CreateTask) {
    return this.serialize(() => this.acceptTask(createTaskSchema.parse(input)));
  }

  private async acceptTask(input: CreateTask) {
    const ids = await this.ids();
    if (ids.includes(input.id)) {
      const existing = await (await this.child(input.id)).inspect();
      if (
        existing.title !== input.title ||
        existing.instructions !== input.instructions ||
        existing.kind !== input.kind
      )
        throw new DomainError(
          "task_conflict",
          409,
          "This task id was already used for different work",
        );
      return existing;
    }
    if (
      (await this.snapshot()).tasks.filter((task) => isActive(task.status))
        .length >= MAX_ACTIVE_TASKS
    )
      throw new DomainError(
        "task_limit",
        409,
        "Three tasks are already active. Stop one before starting another.",
      );
    const child = await this.subAgent(TaskAgent, input.id);
    const notes = [
      ...(await this.ctx.storage.list<Note>({ prefix: "note:" })).values(),
    ]
      .map((note) => `${note.text} (source: ${note.source})`)
      .join("\n");
    await child.initialize(input, notes);
    await this.ctx.storage.put("taskIds", [...ids, input.id]);
    return child.start();
  }

  async steerTask(id: string, input: SteerTask) {
    return (await this.child(id)).correct(steerTaskSchema.parse(input));
  }
  async stopTask(id: string) {
    return (await this.child(id)).stop();
  }
  async resumeTask(id: string) {
    return this.serialize(async () => {
      const child = await this.child(id);
      const current = await child.inspect();
      if (isActive(current.status) || current.status === "completed")
        return current;
      if (
        (await this.snapshot()).tasks.filter((task) => isActive(task.status))
          .length >= MAX_ACTIVE_TASKS
      )
        throw new DomainError(
          "task_limit",
          409,
          "Three tasks are already active. Stop one before resuming another.",
        );
      return child.start();
    });
  }

  async readArtifact(id: string, path: string) {
    return (await this.child(id)).readArtifact(path);
  }
  async writeUpload(id: string, path: string, content: string) {
    return (await this.child(id)).writeUpload(path, content);
  }

  async saveNote(input: WriteNote & { id: string }): Promise<Note> {
    const id = idSchema.parse(input.id);
    const value = writeNoteSchema.parse({
      text: input.text,
      source: input.source,
    });
    const prior = await this.ctx.storage.get<Note>(`note:${id}`);
    const now = new Date().toISOString();
    const note = {
      ...value,
      id,
      createdAt: prior?.createdAt ?? now,
      updatedAt: now,
    };
    await this.ctx.storage.put(`note:${id}`, note);
    return note;
  }

  async deleteNote(id: string) {
    return this.ctx.storage.delete(`note:${idSchema.parse(id)}`);
  }

  async createResponsibility(input: CreateResponsibility) {
    input = createResponsibilitySchema.parse(input);
    return this.serialize(async () => {
      const existing = await this.ctx.storage.get<SavedResponsibility>(
        `responsibility:${input.id}`,
      );
      if (existing) {
        if (existing.value.status === "active" && !existing.scheduleId) {
          const schedule = await this.scheduleEvery(
            existing.value.intervalMinutes * 60,
            "runResponsibility",
            { id: input.id },
            { retry: { maxAttempts: 1 } },
          );
          existing.scheduleId = schedule.id;
          await this.ctx.storage.put(`responsibility:${input.id}`, existing);
        }
        return existing.value;
      }
      const all = await this.ctx.storage.list<SavedResponsibility>({
        prefix: "responsibility:",
      });
      if ([...all.values()].some((item) => item.value.status === "active"))
        throw new DomainError(
          "responsibility_limit",
          409,
          "Stop the current responsibility before adding another.",
        );
      const value: Responsibility = {
        ...input,
        status: "active",
        nextRunAt: new Date(
          Date.now() + input.intervalMinutes * 60_000,
        ).toISOString(),
        lastTaskId: null,
        createdAt: new Date().toISOString(),
      };
      await this.ctx.storage.put(`responsibility:${input.id}`, {
        value,
      } satisfies SavedResponsibility);
      const schedule = await this.scheduleEvery(
        input.intervalMinutes * 60,
        "runResponsibility",
        { id: input.id },
        { retry: { maxAttempts: 1 } },
      );
      await this.ctx.storage.put(`responsibility:${input.id}`, {
        value,
        scheduleId: schedule.id,
      } satisfies SavedResponsibility);
      return value;
    });
  }

  async stopResponsibility(id: string) {
    return this.serialize(async () => {
      const key = `responsibility:${idSchema.parse(id)}`;
      const saved = await this.ctx.storage.get<SavedResponsibility>(key);
      if (!saved)
        throw new DomainError(
          "responsibility_missing",
          404,
          "Responsibility not found",
        );
      saved.value.status = "stopped";
      saved.value.nextRunAt = null;
      await this.ctx.storage.put(key, saved);
      if (saved.scheduleId) await this.cancelSchedule(saved.scheduleId);
      return saved.value;
    });
  }

  async runResponsibility({ id }: { id: string }) {
    return this.serialize(async () => {
      const key = `responsibility:${id}`;
      const saved = await this.ctx.storage.get<SavedResponsibility>(key);
      if (!saved || saved.value.status !== "active") return;
      const value = saved.value;
      // A missed/failed occurrence is not retried automatically. The next interval is a new observation.
      const previous = value.lastTaskId
        ? await this.getTask(value.lastTaskId)
        : null;
      if (!previous || !isActive(previous.status)) {
        try {
          const priorFile = previous?.artifacts[0]
            ? await this.readArtifact(previous.id, previous.artifacts[0].path)
            : null;
          const task = await this.acceptTask({
            id: crypto.randomUUID(),
            title: value.title,
            kind: "research",
            files: [],
            instructions: `${value.instructions}\nThis is a scheduled observation. Report meaningful changes with cited evidence; state when no meaningful change was established.\nPrevious observation: ${previous?.summary ?? "None"}\nPrevious saved evidence: ${priorFile?.content.slice(0, 12000) ?? "None"}`,
          });
          value.lastTaskId = task.id;
        } catch (error) {
          if (!(error instanceof DomainError && error.code === "task_limit"))
            console.error("responsibility_run_failed", { id });
        }
      }
      // Re-read so a concurrent Stop cannot be overwritten by this callback.
      const current = await this.ctx.storage.get<SavedResponsibility>(key);
      if (!current || current.value.status !== "active") return;
      current.value.lastTaskId = value.lastTaskId;
      current.value.nextRunAt = new Date(
        Date.now() + value.intervalMinutes * 60_000,
      ).toISOString();
      await this.ctx.storage.put(key, current);
    });
  }

  getSystemPrompt() {
    return "You are Stead, an enduring personal assistant for one operator. Keep the main conversation short and available while independent retained tasks work. Delegate substantive research, dataset analysis and artifact creation through delegate_task; answer small questions directly. Inspect current work before discussing task state. Never claim a task is complete without its checked outcome. Save personal notes only when explicitly asked, and treat them as context rather than permission. Schedule a recurring public responsibility only when explicitly requested. Corrections pause a task and require explicit Resume; explain that saved work remains available. Never automatically resume interrupted tasks. Available capabilities are public web research, bounded JavaScript, uploaded text/CSV and self-contained artifacts; do not promise private account or browser automation.";
  }
  getTools() {
    return personalTools(this);
  }
  getModel() {
    return createSteadModel(this.env, async () => {
      const requestId = this.activeTurn?.requestId;
      if (!requestId) throw new Error("No admitted conversation turn");
      await this.ctx.storage.transaction(async (txn) => {
        const budget = await txn.get<{ requestId: string; calls: number }>(
          "mainBudget",
        );
        const calls = budget?.requestId === requestId ? budget.calls + 1 : 1;
        if (calls > 6) throw new Error("Conversation turn budget reached");
        await txn.put("mainBudget", { requestId, calls });
      });
    });
  }
  async beforeTurn() {
    const snapshot = await this.snapshot();
    const work = snapshot.tasks
      .slice(0, 20)
      .map(({ id, title, status, summary }) => ({
        id,
        title,
        status,
        summary,
      }));
    return {
      instructions: `${this.getSystemPrompt()}\nPersonal notes: ${JSON.stringify(snapshot.notes)}\nCurrent work: ${JSON.stringify(work)}\nResponsibilities: ${JSON.stringify(snapshot.responsibilities)}`,
      activeTools: Object.keys(this.getTools()),
      maxSteps: 6,
      maxOutputTokens: 4096,
      maxRetries: 0,
      providerOptions: { "workers-ai": { reasoning_effort: "low" } },
    };
  }
  async onChatRecovery() {
    return { continue: false };
  }
}
