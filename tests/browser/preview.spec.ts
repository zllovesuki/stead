import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const operatorToken = "stead-test-preview-password";
const authorization = { Authorization: `Bearer ${operatorToken}` };

async function signIn(page: Page) {
  await page.goto("/");
  await page.getByLabel("Access token", { exact: true }).fill(operatorToken);
  await page
    .getByRole("button", { name: "Open workspace", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Main conversation" }),
  ).toBeVisible();
  await expect(page.getByText("Connected", { exact: true })).toBeVisible();
}

async function expectNoOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test("a private conversation and uploaded analysis survive direction, downloads, and reload", async ({
  page,
}) => {
  const errors = collectPageErrors(page);
  await page.setViewportSize({ width: 1440, height: 950 });
  expect((await page.request.get("/api/workspace")).status()).toBe(401);
  expect(
    (
      await page.request.get("/api/tasks/private/files?path=result.json")
    ).status(),
  ).toBe(401);
  await signIn(page);

  const conversation = page.getByRole("region", { name: "Main conversation" });
  await page
    .getByLabel("Message Stead", { exact: true })
    .fill(
      "What is six times seven? Keep this conversation while my work continues.",
    );
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(conversation.getByText(/The answer is 42/).last()).toBeVisible();

  const title = `Uploaded values ${randomUUID().slice(0, 8)}`;
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await page.getByText("Analyze", { exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "Analyze", exact: true }),
  ).toBeChecked();
  await page.getByLabel("Task name", { exact: true }).fill(title);
  await page
    .getByLabel("What should Stead do?", { exact: true })
    .fill(
      "Add the values in input.csv and save the checked result as result.json.",
    );
  await page.locator('input[type="file"]').setInputFiles({
    name: "input.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("value\n5\n7\n"),
  });
  await expect(page.getByText("input.csv", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start task", exact: true }).click();
  const details = page.getByRole("complementary", {
    name: "Task details",
    exact: true,
  });
  await expect(
    details.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await expect(details.getByText("Completed", { exact: true })).toBeVisible();
  const taskId = new URL(page.url()).searchParams.get("task")!;
  await expect(
    details.getByRole("button", { name: /input\.csv/ }),
  ).toBeVisible();
  await details.getByRole("button", { name: /result\.json/ }).click();
  await expect
    .poll(
      async () => JSON.parse(await page.locator("pre code").innerText()).sum,
    )
    .toBe(12);

  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "Download result.json", exact: true })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("result.json");
  expect(
    JSON.parse(await readFile((await download.path())!, "utf8")),
  ).toMatchObject({ sum: 12, count: 2 });

  await page.getByRole("button", { name: "Back to task", exact: true }).click();
  await page
    .getByLabel("Correction for this task", { exact: true })
    .fill("Multiply the result by 3");
  await page
    .getByRole("button", { name: "Send direction", exact: true })
    .click();
  await expect(
    details.getByText("Saved · resume to apply", { exact: true }),
  ).toBeVisible();
  await expect(
    details.getByText("Needs resume", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Resume task", exact: true }).click();
  await expect(details.getByText("Completed", { exact: true })).toBeVisible();
  await expect(details.getByText("Applied", { exact: true })).toBeVisible();
  await details.getByRole("button", { name: /result\.json/ }).click();
  await expect
    .poll(
      async () => JSON.parse(await page.locator("pre code").innerText()).sum,
    )
    .toBe(36);
  await page.reload();
  await expect
    .poll(
      async () => JSON.parse(await page.locator("pre code").innerText()).sum,
    )
    .toBe(36);
  await expect(conversation.getByText(/The answer is 42/).last()).toBeVisible();
  await expectNoOverflow(page);
  await mkdir(".local/screenshots", { recursive: true });
  await page.screenshot({
    path: ".local/screenshots/desktop.png",
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/?task=${taskId}`);
  await expect(
    details.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await expectNoOverflow(page);
  await page
    .getByRole("button", { name: "Open workspace navigation", exact: true })
    .click();
  const navigation = page.getByRole("complementary", {
    name: "Workspace navigation",
    exact: true,
  });
  await expect(navigation).toBeVisible();
  await navigation
    .getByRole("button", { name: "Conversation", exact: true })
    .click();
  await expect(conversation).toBeVisible();
  await expect(navigation).toBeHidden();
  await expectNoOverflow(page);
  await page.screenshot({
    path: ".local/screenshots/mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("personal notes can be corrected and removed and a responsibility can be stopped", async ({
  page,
}) => {
  const errors = collectPageErrors(page);
  await page.setViewportSize({ width: 1440, height: 950 });
  await signIn(page);
  await page.getByRole("button", { name: /^Personal notes/ }).click();
  await page.getByRole("button", { name: "Add a note", exact: true }).click();
  const original = `Prefer concise summaries ${randomUUID().slice(0, 8)}`;
  const revised = `${original}; include source links.`;
  await page.getByLabel("New note", { exact: true }).fill(original);
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  const note = page.getByRole("article").filter({ hasText: original });
  await expect(note).toBeVisible();
  await note.getByRole("button", { name: "Edit note", exact: true }).click();
  await page.getByLabel("Edit note", { exact: true }).fill(revised);
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(note.getByText(revised, { exact: true })).toBeVisible();
  await note.getByRole("button", { name: "Delete note", exact: true }).click();
  await note.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByText(revised, { exact: true })).toBeHidden();

  await page
    .getByRole("button", { name: "Responsibilities", exact: true })
    .click();
  const title = `Watch public releases ${randomUUID().slice(0, 8)}`;
  await page.getByLabel("Responsibility", { exact: true }).fill(title);
  await page
    .getByLabel("What should Stead check?", { exact: true })
    .fill(
      "Check https://example.com for a meaningful public change and cite the source.",
    );
  await page.getByLabel("Check in", { exact: true }).selectOption("10080");
  await page
    .getByRole("button", { name: "Schedule responsibility", exact: true })
    .click();
  const responsibility = page.getByRole("article").filter({ hasText: title });
  await expect(
    responsibility.getByText("Scheduled", { exact: true }),
  ).toBeVisible();
  await expect(responsibility.getByText(/Next check/)).toBeVisible();
  await responsibility
    .getByRole("button", { name: "Stop schedule", exact: true })
    .click();
  await expect(
    responsibility.getByText("Stopped", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    responsibility.getByText("Stopped", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("generated HTML remains interactive without parent DOM or fetch access", async ({
  page,
}) => {
  const errors = collectPageErrors(page);
  await page.setViewportSize({ width: 1440, height: 950 });
  await signIn(page);
  const id = randomUUID();
  const created = await page.request.post("/api/tasks", {
    headers: authorization,
    data: {
      id,
      title: "Isolated interactive artifact [fixture:no-result]",
      instructions:
        "[fixture:no-result] Save an interactive artifact for inspection.",
      kind: "create",
      files: [],
    },
  });
  expect(created.status()).toBe(201);
  await expect
    .poll(
      async () =>
        (
          await (
            await page.request.get(`/api/tasks/${id}`, {
              headers: authorization,
            })
          ).json()
        ).status,
    )
    .toBe("needs-resume");
  const content = `<!doctype html><html><body>
    <h1>Isolated counter</h1><button id="increment">Add one</button><output id="count">0</output>
    <p id="parent-status">Checking parent</p><p id="fetch-status">Checking fetch</p>
    <script>
      document.querySelector('#increment').onclick = () => { document.querySelector('#count').textContent = String(Number(document.querySelector('#count').textContent) + 1); };
      try { parent.document.body; document.querySelector('#parent-status').textContent = 'Parent exposed'; }
      catch { document.querySelector('#parent-status').textContent = 'Parent blocked'; }
      fetch('/api/workspace?sandbox-probe=1').then(() => { document.querySelector('#fetch-status').textContent = 'Fetch allowed'; }).catch(() => { document.querySelector('#fetch-status').textContent = 'Fetch blocked'; });
    </script></body></html>`;
  const upload = await page.request.put(`/api/tasks/${id}/files`, {
    headers: authorization,
    data: { path: "artifact.html", content },
  });
  expect(upload.ok()).toBe(true);
  await page.goto(`/?task=${id}&file=artifact.html`);
  await page.getByRole("button", { name: "Open preview", exact: true }).click();
  const frame = page.frameLocator('iframe[title="Preview of artifact.html"]');
  await expect(
    frame.getByRole("heading", { name: "Isolated counter" }),
  ).toBeVisible();
  await frame.getByRole("button", { name: "Add one", exact: true }).click();
  await expect(frame.locator("output")).toHaveText("1");
  await expect(
    frame.getByText("Parent blocked", { exact: true }),
  ).toBeVisible();
  await expect(frame.getByText("Fetch blocked", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Main conversation" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
