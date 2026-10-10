import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  FileText,
  Pause,
  Play,
  Send,
  Upload,
} from "lucide-react";
import { Button, Badge } from "@stead/ui";
import type { UploadFile } from "@stead/contracts";
import { api } from "@/lib/api";
import { taskOptions, refreshWorkspace } from "@/lib/queries";
import { formatDate, formatBytes } from "@/lib/format";
import { ErrorNotice, fieldClass, Loading } from "@/app/feedback";
import { TaskStatusBadge } from "@/features/tasks/task-status";
import { UploadInput } from "@/features/artifacts/upload";

export function TaskDetail({
  id,
  onFile,
}: {
  id: string;
  onFile: (path: string) => void;
}) {
  const query = useQuery(taskOptions(id));
  const [correction, setCorrection] = useState("");
  const [correctionId, setCorrectionId] = useState(() => crypto.randomUUID());
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const action = useMutation({
    mutationFn: (value: "stop" | "resume") => api.taskAction(id, value),
    onSuccess: () => refreshWorkspace(id),
  });
  const steer = useMutation({
    mutationFn: (input: { id: string; text: string }) =>
      api.steerTask(id, input),
    onSuccess: async () => {
      setCorrection("");
      setCorrectionId(crypto.randomUUID());
      await refreshWorkspace(id);
    },
  });
  const upload = useMutation({
    mutationFn: async () => {
      for (const file of files) await api.upload(id, file);
    },
    onSuccess: async () => {
      setFiles([]);
      setShowUpload(false);
      await refreshWorkspace(id);
    },
  });
  if (query.isPending) return <Loading label="Opening this task…" />;
  if (query.isError)
    return (
      <div className="p-5">
        <ErrorNotice error={query.error} retry={() => void query.refetch()} />
      </div>
    );
  const task = query.data;
  const active = task.status === "running" || task.status === "queued";
  const canUpload = !active && task.status !== "completed";
  const resumable = [
    "needs-resume",
    "stopped",
    "failed",
    "awaiting-input",
  ].includes(task.status);
  return (
    <div className="p-5 sm:p-6">
      <div className="mb-4">
        <TaskStatusBadge status={task.status} />
        <h2 className="mt-4 text-balance font-serif text-2xl leading-tight">
          {task.title}
        </h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">
          {task.summary || task.instructions}
        </p>
        <p className="mt-3 text-xs text-muted">
          Updated {formatDate(task.updatedAt)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {active ? (
          <Button
            variant="secondary"
            disabled={action.isPending}
            onClick={() => action.mutate("stop")}
          >
            <Pause size={14} />
            {action.isPending ? "Stopping…" : "Stop task"}
          </Button>
        ) : null}
        {resumable ? (
          <Button
            disabled={action.isPending}
            onClick={() => action.mutate("resume")}
          >
            <Play size={14} />
            {action.isPending ? "Resuming…" : "Resume task"}
          </Button>
        ) : null}
        <Button
          variant="quiet"
          onClick={() => setShowUpload(!showUpload)}
          disabled={!canUpload}
        >
          <Upload size={14} />
          Add files
        </Button>
      </div>
      {active ? (
        <p className="mt-2 text-xs leading-5 text-muted">
          Stop the task before adding files. Corrections are applied at a safe
          boundary.
        </p>
      ) : null}
      {task.status === "completed" ? (
        <p className="mt-2 text-xs leading-5 text-muted">
          Send direction to reopen this task before replacing its files.
        </p>
      ) : null}
      {action.error || upload.error ? (
        <div className="mt-4">
          <ErrorNotice error={action.error || upload.error} />
        </div>
      ) : null}
      {showUpload && canUpload ? (
        <div className="mt-4 rounded-lg border border-line p-3">
          <UploadInput
            files={files}
            onChange={setFiles}
            disabled={upload.isPending}
          />
          <Button
            className="mt-3"
            disabled={!files.length || upload.isPending}
            onClick={() => upload.mutate()}
          >
            {upload.isPending ? "Saving files…" : "Save files"}
          </Button>
        </div>
      ) : null}
      <section className="mt-7 border-t border-line pt-5">
        <h3 className="mb-3 text-sm font-semibold">
          Files{" "}
          <span className="ml-1 font-normal text-muted">
            {task.files.length}
          </span>
        </h3>
        {task.files.length ? (
          <div className="space-y-1">
            {task.files.map((file) => (
              <button
                key={file.path}
                onClick={() => onFile(file.path)}
                className="flex min-h-13 w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-canvas"
              >
                <FileText size={18} className="shrink-0 text-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {file.name}
                  </span>
                  <span className="text-xs text-muted">
                    {formatBytes(file.size)}
                    {task.artifacts.some(
                      (artifact) => artifact.path === file.path,
                    )
                      ? " · Published result"
                      : " · Saved file"}
                  </span>
                </span>
                <ArrowUpRight size={15} className="text-muted" />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm leading-6 text-muted">
            Files will appear here as the task saves its work.
          </p>
        )}
      </section>
      <section className="mt-6 border-t border-line pt-5">
        <h3 className="mb-3 text-sm font-semibold">Give direction</h3>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (correction.trim())
              steer.mutate({
                id: correctionId,
                text: correction.trim(),
              });
          }}
        >
          <label htmlFor="correction" className="sr-only">
            Correction for this task
          </label>
          <textarea
            id="correction"
            disabled={steer.isPending}
            rows={3}
            maxLength={8000}
            value={correction}
            onChange={(event) => setCorrection(event.target.value)}
            placeholder="Add context, change the approach, or answer a question…"
            className={`${fieldClass} resize-y leading-6`}
          />
          <Button
            type="submit"
            variant="secondary"
            disabled={!correction.trim() || steer.isPending}
            className="mt-2"
          >
            <Send size={14} />
            {steer.isPending ? "Sending…" : "Send direction"}
          </Button>
          {steer.error ? (
            <div className="mt-3">
              <ErrorNotice error={steer.error} />
            </div>
          ) : null}
        </form>
        {task.corrections.length ? (
          <div className="mt-4 space-y-3">
            {task.corrections.toReversed().map((item) => (
              <div key={item.id} className="rounded-lg bg-canvas p-3">
                <p className="whitespace-pre-wrap text-sm leading-6">
                  {item.text}
                </p>
                <Badge
                  className="mt-2"
                  tone={item.status === "applied" ? "positive" : "warning"}
                >
                  {item.status === "applied"
                    ? "Applied"
                    : item.status === "pending"
                      ? "Waiting for a safe boundary"
                      : "Saved · resume to apply"}
                </Badge>
              </div>
            ))}
          </div>
        ) : null}
      </section>
      <section className="mt-6 border-t border-line pt-5">
        <h3 className="mb-4 text-sm font-semibold">Activity</h3>
        {task.activity.length ? (
          <ol className="space-y-4">
            {task.activity.toReversed().map((event) => (
              <li key={event.id} className="flex gap-3">
                <span
                  className={`mt-1.5 size-1.5 shrink-0 rounded-full ${event.kind === "error" ? "bg-danger" : "bg-line"}`}
                />
                <div className="min-w-0">
                  <p className="whitespace-pre-wrap break-words text-sm leading-6">
                    {event.text}
                  </p>
                  <time className="text-[11px] text-muted" dateTime={event.at}>
                    {formatDate(event.at)}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted">Waiting for the first update.</p>
        )}
      </section>
      <details className="mt-6 border-t border-line pt-4">
        <summary className="text-xs font-medium text-muted">
          Original instructions
        </summary>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
          {task.instructions}
        </p>
      </details>
    </div>
  );
}
