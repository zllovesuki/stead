import type { TaskStatus } from "@stead/contracts";
export const statusLabels: Record<TaskStatus, string> = {
  queued: "Queued",
  running: "Working",
  "awaiting-input": "Needs your input",
  "needs-resume": "Needs resume",
  completed: "Completed",
  failed: "Failed",
  stopped: "Stopped",
};
