import { abortAllDurableObjects, runInDurableObject } from "cloudflare:test";
import { env, exports as worker } from "cloudflare:workers";
import { afterEach, describe, expect, it } from "vitest";
import type { TaskDetail, TaskFile, WorkspaceSnapshot } from "@stead/contracts";
import { holdModel, releaseModels } from "../fixtures/gate";

const origin = "https://stead.test";
const token = "stead-test-preview-password";

function request(
  path: string,
  data?: unknown,
  headers: Record<string, string> = {},
) {
  return worker.default.fetch(`${origin}${path}`, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...headers,
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}

async function task(id: string): Promise<TaskDetail> {
  const response = await request(`/api/tasks/${id}`);
  expect(response.status).toBe(200);
  return response.json();
}

async function create(id: string, marker = id) {
  const response = await request("/api/tasks", {
    id,
    title: marker,
    kind: "analysis",
    instructions:
      "Read input.csv, calculate the total, and save the checked result as result.json.",
    files: [{ path: "input.csv", content: "value\n2\n3\n5\n" }],
  });
  expect(response.status).toBe(201);
  return response.json<TaskDetail>();
}

async function completed(id: string) {
  await expect
    .poll(async () => (await task(id)).status, {
      timeout: 15_000,
      interval: 100,
    })
    .toBe("completed");
  return task(id);
}

async function result(id: string) {
  const response = await request(`/api/tasks/${id}/files?path=result.json`);
  expect(response.status).toBe(200);
  return JSON.parse((await response.json<TaskFile>()).content) as {
    sum: number;
    count: number;
    multiplier: number;
  };
}

afterEach(async () => {
  await releaseModels();
  await abortAllDurableObjects();
});

describe("the authenticated personal agent", () => {
  it("protects HTTP and live chat admission and routes the configured main conversation", async () => {
    expect((await worker.default.fetch(`${origin}/api/workspace`)).status).toBe(
      401,
    );
    expect(
      (
        await worker.default.fetch(`${origin}/agents/personal-agent/main`, {
          headers: { upgrade: "websocket" },
        })
      ).status,
    ).toBe(401);
    expect(
      (await request("/agents/personal-agent/other/get-messages")).status,
    ).toBe(404);
    expect(
      (
        await request(
          "/agents/personal-agent/main/sub/task-agent/guessed/get-messages",
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await request("/agents/personal-agent/main", undefined, {
          upgrade: "websocket",
          origin: "https://unrelated.test",
        })
      ).status,
    ).toBe(403);

    const messages = await request("/agents/personal-agent/main/get-messages");
    expect(messages.status).toBe(200);
    const socket = await request("/agents/personal-agent/main", undefined, {
      upgrade: "websocket",
      origin,
    });
    expect(socket.status).toBe(101);
    expect(socket.webSocket).not.toBeNull();
    socket.webSocket!.accept();
    socket.webSocket!.close(1000, "Test completed");
  });

  it("executes generated JavaScript on uploaded data and preserves checked files across native reset", async () => {
    await create("durable-analysis");
    const detail = await completed("durable-analysis");
    expect(detail.artifacts).toHaveLength(1);
    expect(detail.artifacts[0]?.path).toBe("result.json");
    expect(await result("durable-analysis")).toEqual({
      sum: 10,
      count: 3,
      multiplier: 1,
    });
    const overwrite = await worker.default.fetch(
      `${origin}/api/tasks/durable-analysis/files`,
      {
        method: "PUT",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ path: "result.json", content: "" }),
      },
    );
    expect(overwrite.status).toBe(409);
    expect(await result("durable-analysis")).toEqual({
      sum: 10,
      count: 3,
      multiplier: 1,
    });

    await abortAllDurableObjects();

    const restored = await task("durable-analysis");
    expect(restored.status).toBe("completed");
    expect(restored.artifacts).toEqual(detail.artifacts);
    expect(await result("durable-analysis")).toEqual({
      sum: 10,
      count: 3,
      multiplier: 1,
    });
    const input = await request(
      "/api/tasks/durable-analysis/files?path=input.csv",
    );
    expect((await input.json<TaskFile>()).content).toBe("value\n2\n3\n5\n");
  });

  it("answers the main conversation while two retained tasks wait independently", async () => {
    const first = await holdModel(env.MODEL_GATE, "[fixture:first]");
    const second = await holdModel(env.MODEL_GATE, "[fixture:second]");
    await create("first", "[fixture:first]");
    await create("second", "[fixture:second]");
    await expect
      .poll(
        async () => ({
          first: await first.entered(),
          second: await second.entered(),
          firstStatus: (await task("first")).status,
          secondStatus: (await task("second")).status,
        }),
        { timeout: 5000 },
      )
      .toEqual({
        first: true,
        second: true,
        firstStatus: "running",
        secondStatus: "running",
      });

    const main = env.PERSONAL_AGENT.getByName("main");
    const answer = await main.saveMessages([
      {
        id: crypto.randomUUID(),
        role: "user",
        parts: [{ type: "text", text: "What is six times seven?" }],
      },
    ]);
    expect(answer.status).toBe("completed");
    expect(
      await (await request("/agents/personal-agent/main/get-messages")).text(),
    ).toContain("42");
    expect((await task("first")).status).toBe("running");
    expect((await task("second")).status).toBe("running");

    await first.release();
    await second.release();
    await Promise.all([completed("first"), completed("second")]);
    expect(await result("first")).toEqual(await result("second"));
  });

  it("keeps Stop distinct from a correction and applies the correction on explicit Resume", async () => {
    const gate = await holdModel(env.MODEL_GATE, "[fixture:control]");
    await create("controlled", "[fixture:control]");
    await expect.poll(() => gate.entered(), { timeout: 5000 }).toBe(true);
    const stopped = await request("/api/tasks/controlled/stop", {});
    expect((await stopped.json<TaskDetail>()).status).toBe("stopped");
    await gate.release();
    await expect
      .poll(async () => (await task("controlled")).status)
      .toBe("stopped");
    expect(
      (await request("/api/tasks/controlled/files?path=result.json")).status,
    ).toBe(404);

    const correction = {
      id: "correction-1",
      text: "Multiply the result by 3.",
    };
    const steered = await request("/api/tasks/controlled/steer", correction);
    const paused = await steered.json<TaskDetail>();
    expect(paused.status).toBe("needs-resume");
    expect(paused.corrections).toMatchObject([
      { ...correction, status: "requires-resume" },
    ]);
    await request("/api/tasks/controlled/steer", correction);
    expect((await task("controlled")).corrections).toHaveLength(1);

    expect((await request("/api/tasks/controlled/resume", {})).status).toBe(
      200,
    );
    const finished = await completed("controlled");
    expect(finished.corrections[0]?.status).toBe("applied");
    expect(await result("controlled")).toEqual({
      sum: 30,
      count: 3,
      multiplier: 3,
    });
  });

  it("shows needs-resume when a model turn ends without a checked artifact", async () => {
    await create("unfinished", "[fixture:no-result]");
    await expect
      .poll(async () => (await task("unfinished")).status)
      .toBe("needs-resume");
    const detail = await task("unfinished");
    expect(detail.artifacts).toEqual([]);
    expect(detail.summary).toMatch(/without|interrupted/i);
  });

  it("preserves interrupted task inputs and resumes only after the operator asks", async () => {
    const gate = await holdModel(env.MODEL_GATE, "[fixture:interrupted]");
    await create("interrupted", "[fixture:interrupted]");
    await expect.poll(() => gate.entered(), { timeout: 5000 }).toBe(true);
    expect((await task("interrupted")).status).toBe("running");

    await abortAllDurableObjects();
    await gate.release();

    await expect
      .poll(async () => (await task("interrupted")).status, { timeout: 10_000 })
      .toBe("needs-resume");
    const input = await request("/api/tasks/interrupted/files?path=input.csv");
    expect((await input.json<TaskFile>()).content).toBe("value\n2\n3\n5\n");
    expect((await task("interrupted")).artifacts).toEqual([]);
    expect((await request("/api/tasks/interrupted/resume", {})).status).toBe(
      200,
    );
    await completed("interrupted");
    expect(await result("interrupted")).toEqual({
      sum: 10,
      count: 3,
      multiplier: 1,
    });
  });

  it("dispatches a responsibility through the SDK alarm callback and honors Stop", async () => {
    const before = await (
      await request("/api/workspace")
    ).json<WorkspaceSnapshot>();
    const previousTasks = new Set(before.tasks.map((value) => value.id));
    const response = await request("/api/responsibilities", {
      id: "watch",
      title: "[fixture:no-result]",
      instructions: "Observe a public source and record the outcome.",
      intervalMinutes: 15,
    });
    expect(response.status).toBe(201);
    const main = env.PERSONAL_AGENT.getByName("main");
    // Invoke the registered callback through an immediately due SDK schedule,
    // without sleeping fifteen minutes or rewriting SDK private tables.
    const wakeId = await runInDurableObject(main, async (agent) => {
      const schedule = await agent.schedule(0, "runResponsibility", {
        id: "watch",
      });
      return schedule.id;
    });
    await expect
      .poll(async () => await main.getScheduleById(wakeId), { timeout: 5000 })
      .toBeUndefined();
    await expect
      .poll(
        async () => (await main.snapshot()).responsibilities[0]?.lastTaskId,
        { timeout: 5000 },
      )
      .not.toBeNull();
    const first = await main.snapshot();
    const taskId = first.responsibilities[0]!.lastTaskId!;
    expect(
      first.tasks.filter((value) => !previousTasks.has(value.id)),
    ).toHaveLength(1);
    expect((await task(taskId)).kind).toBe("research");
    expect((await request("/api/responsibilities/watch/stop", {})).status).toBe(
      200,
    );
    const stoppedWakeId = await runInDurableObject(main, async (agent) => {
      const schedule = await agent.schedule(0, "runResponsibility", {
        id: "watch",
      });
      return schedule.id;
    });
    await expect
      .poll(async () => await main.getScheduleById(stoppedWakeId), {
        timeout: 5000,
      })
      .toBeUndefined();
    const stopped = await (
      await request("/api/workspace")
    ).json<WorkspaceSnapshot>();
    expect(stopped.responsibilities[0]).toMatchObject({
      status: "stopped",
      nextRunAt: null,
      lastTaskId: taskId,
    });
    expect(stopped.tasks.map((value) => value.id)).toEqual(
      first.tasks.map((value) => value.id),
    );
  });
});
