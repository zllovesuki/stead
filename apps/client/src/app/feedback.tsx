import { AlertCircle, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@stead/ui";
import { errorMessage } from "@/lib/api";
export function ErrorNotice({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg bg-danger-soft p-3 text-sm text-danger"
    >
      <AlertCircle size={17} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="break-words">{errorMessage(error)}</p>
        {retry ? (
          <Button variant="quiet" onClick={retry} className="mt-2 !text-danger">
            <RefreshCw size={14} />
            Try again
          </Button>
        ) : null}
      </div>
    </div>
  );
}
export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex items-center gap-2 p-5 text-sm text-muted"
    >
      <LoaderCircle
        size={16}
        className="animate-spin motion-reduce:animate-none"
      />
      {label}
    </div>
  );
}
export const fieldClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted disabled:opacity-50";
