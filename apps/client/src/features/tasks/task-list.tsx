import { Check, Circle, FileText, Pause, ArrowUpRight } from "lucide-react";
import type { TaskSummary } from "@stead/contracts";
import { statusLabels } from "@/features/tasks/status-labels";
export function TaskList({
  tasks,
  selected,
  onSelect,
}: {
  tasks: TaskSummary[];
  selected?: string;
  onSelect: (id: string) => void;
}) {
  if (!tasks.length)
    return (
      <div className="px-4 py-6">
        <p className="text-sm text-muted">A little room for what’s next.</p>
        <p className="mt-2 text-xs leading-6 text-muted">
          Hand off a task and follow its progress here.
        </p>
      </div>
    );
  return (
    <div className="space-y-1 px-2">
      {tasks.map((task) => (
        <button
          key={task.id}
          onClick={() => onSelect(task.id)}
          aria-current={selected === task.id ? "true" : undefined}
          className={`group flex w-full gap-2.5 rounded-lg px-3 py-3 text-left transition-colors ${selected === task.id ? "bg-surface" : "hover:bg-hover"}`}
        >
          <span
            className={`mt-1 shrink-0 ${task.status === "running" || task.status === "completed" ? "text-accent" : "text-muted"}`}
          >
            {task.status === "completed" ? (
              <Check size={14} />
            ) : task.status === "needs-resume" || task.status === "stopped" ? (
              <Pause size={14} />
            ) : (
              <Circle
                size={12}
                fill={task.status === "running" ? "currentColor" : "none"}
              />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {task.title}
            </span>
            <span className="mt-1.5 flex items-center gap-2 text-xs text-muted">
              {statusLabels[task.status]}
              {task.artifacts.length ? (
                <>
                  <span aria-hidden="true">·</span>
                  <FileText size={11} />
                  {task.artifacts.length}
                </>
              ) : null}
            </span>
          </span>
          <ArrowUpRight
            size={13}
            className="mt-1 shrink-0 text-muted opacity-0 group-hover:opacity-100"
          />
        </button>
      ))}
    </div>
  );
}
