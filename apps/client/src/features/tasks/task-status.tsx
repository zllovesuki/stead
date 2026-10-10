import { Badge } from "@stead/ui";
import type { TaskStatus } from "@stead/contracts";
import { statusLabels } from "@/features/tasks/status-labels";
export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge
      tone={
        status === "completed" || status === "running"
          ? "positive"
          : status === "failed"
            ? "danger"
            : status === "awaiting-input" || status === "needs-resume"
              ? "warning"
              : "neutral"
      }
    >
      {status === "running" ? (
        <span className="size-1.5 rounded-full bg-current" />
      ) : null}
      {statusLabels[status]}
    </Badge>
  );
}
