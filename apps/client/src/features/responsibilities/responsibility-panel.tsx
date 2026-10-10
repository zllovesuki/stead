import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowUpRight, CalendarClock, Pause, Plus } from "lucide-react";
import type { Responsibility } from "@stead/contracts";
import { Badge, Button } from "@stead/ui";
import { api } from "@/lib/api";
import { refreshWorkspace } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { ErrorNotice, fieldClass } from "@/app/feedback";
export function ResponsibilityPanel({
  responsibilities,
  onTask,
}: {
  responsibilities: Responsibility[];
  onTask: (id: string) => void;
}) {
  const active = responsibilities.some((item) => item.status === "active");
  return (
    <div className="p-5 sm:p-6">
      <CalendarClock size={25} strokeWidth={1.5} className="mb-4 text-accent" />
      <h2 className="font-serif text-2xl">Keep an eye on it.</h2>
      <p className="mb-6 mt-3 text-sm leading-6 text-muted">
        Give Stead an ongoing responsibility. Each scheduled check becomes a
        task you can inspect.
      </p>
      <div className="space-y-6">
        {responsibilities.map((item) => (
          <ResponsibilityItem key={item.id} item={item} onTask={onTask} />
        ))}
      </div>
      {!active ? (
        <ResponsibilityForm />
      ) : (
        <p className="mt-6 text-xs leading-6 text-muted">
          This preview supports one active responsibility. Stop it to schedule
          another.
        </p>
      )}
    </div>
  );
}
function ResponsibilityItem({
  item,
  onTask,
}: {
  item: Responsibility;
  onTask: (id: string) => void;
}) {
  const stop = useMutation({
    mutationFn: () => api.stopResponsibility(item.id),
    onSuccess: () => refreshWorkspace(),
  });
  return (
    <article className="border-b border-line pb-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{item.title}</h3>
        <Badge tone={item.status === "active" ? "positive" : "neutral"}>
          {item.status === "active" ? "Scheduled" : "Stopped"}
        </Badge>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">
        {item.instructions}
      </p>
      <p className="mt-3 text-xs text-muted">
        Every{" "}
        {item.intervalMinutes >= 60
          ? `${item.intervalMinutes / 60} hours`
          : `${item.intervalMinutes} minutes`}
      </p>
      {item.nextRunAt ? (
        <p className="mt-1 text-xs text-muted">
          Next check {formatDate(item.nextRunAt)}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {item.lastTaskId ? (
          <Button variant="secondary" onClick={() => onTask(item.lastTaskId!)}>
            Latest task
            <ArrowUpRight size={14} />
          </Button>
        ) : null}
        {item.status === "active" ? (
          <Button
            variant="quiet"
            disabled={stop.isPending}
            onClick={() => stop.mutate()}
          >
            <Pause size={14} />
            {stop.isPending ? "Stopping…" : "Stop schedule"}
          </Button>
        ) : null}
      </div>
      {stop.error ? (
        <div className="mt-3">
          <ErrorNotice error={stop.error} />
        </div>
      ) : null}
    </article>
  );
}
function ResponsibilityForm() {
  const [id] = useState(() => crypto.randomUUID());
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState(1440);
  const create = useMutation({
    mutationFn: () =>
      api.createResponsibility({ id, title, instructions, intervalMinutes }),
    onSuccess: () => refreshWorkspace(),
  });
  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      <div>
        <label
          htmlFor="schedule-title"
          className="mb-2 block text-sm font-medium"
        >
          Responsibility
        </label>
        <input
          id="schedule-title"
          disabled={create.isPending}
          required
          maxLength={120}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Watch a topic or public source"
          className={fieldClass}
        />
      </div>
      <div>
        <label
          htmlFor="schedule-instructions"
          className="mb-2 block text-sm font-medium"
        >
          What should Stead check?
        </label>
        <textarea
          id="schedule-instructions"
          disabled={create.isPending}
          required
          maxLength={8000}
          rows={5}
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          placeholder="Include the source and the changes that would matter to you."
          className={`${fieldClass} resize-y leading-6`}
        />
      </div>
      <div>
        <label
          htmlFor="schedule-interval"
          className="mb-2 block text-sm font-medium"
        >
          Check in
        </label>
        <select
          id="schedule-interval"
          disabled={create.isPending}
          value={intervalMinutes}
          onChange={(event) => setIntervalMinutes(Number(event.target.value))}
          className={fieldClass}
        >
          <option value={15}>Every 15 minutes</option>
          <option value={60}>Every hour</option>
          <option value={360}>Every 6 hours</option>
          <option value={1440}>Every day</option>
          <option value={10080}>Every week</option>
        </select>
        <p className="mt-2 text-xs leading-5 text-muted">
          Checks can use model and search resources even when you’re away.
        </p>
      </div>
      {create.error ? <ErrorNotice error={create.error} /> : null}
      <Button
        type="submit"
        disabled={create.isPending || !title.trim() || !instructions.trim()}
      >
        <Plus size={15} />
        {create.isPending ? "Scheduling…" : "Schedule responsibility"}
      </Button>
    </form>
  );
}
