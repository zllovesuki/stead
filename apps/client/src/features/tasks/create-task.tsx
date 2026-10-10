import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, ChartNoAxesCombined, Search, Shapes } from "lucide-react";
import { Button } from "@stead/ui";
import type { TaskKind, UploadFile } from "@stead/contracts";
import { api } from "@/lib/api";
import { refreshWorkspace } from "@/lib/queries";
import { ErrorNotice, fieldClass } from "@/app/feedback";
import { UploadInput } from "@/features/artifacts/upload";
const kinds = [
  { id: "research", label: "Research", icon: Search },
  { id: "analysis", label: "Analyze", icon: ChartNoAxesCombined },
  { id: "create", label: "Create", icon: Shapes },
] as const;
export function CreateTask({ onCreated }: { onCreated: (id: string) => void }) {
  const [id] = useState(() => crypto.randomUUID());
  const [kind, setKind] = useState<TaskKind>("research");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [files, setFiles] = useState<UploadFile[]>([]);
  const create = useMutation({
    mutationFn: () => api.createTask({ id, kind, title, instructions, files }),
    onSuccess: async () => {
      await refreshWorkspace();
      onCreated(id);
    },
  });
  return (
    <form
      className="space-y-6 p-5 sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      <div>
        <h2 className="font-serif text-2xl">Make room for a task.</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Give Stead a clear outcome. You can keep talking in your main
          conversation while it works.
        </p>
      </div>
      <fieldset disabled={create.isPending}>
        <legend className="mb-2 text-sm font-medium">Kind of work</legend>
        <div className="flex gap-1 rounded-lg bg-canvas p-1">
          {kinds.map(({ id: option, label, icon: Icon }) => (
            <label
              key={option}
              className={`flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md text-xs font-medium has-focus-visible:outline-2 has-focus-visible:outline-accent ${kind === option ? "bg-surface text-accent" : "text-muted"}`}
            >
              <input
                type="radio"
                name="kind"
                value={option}
                checked={kind === option}
                onChange={() => setKind(option)}
                className="sr-only"
              />
              <Icon size={14} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="task-title" className="mb-2 block text-sm font-medium">
          Task name
        </label>
        <input
          id="task-title"
          disabled={create.isPending}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          maxLength={120}
          placeholder="A useful name for this work"
          className={fieldClass}
        />
      </div>
      <div>
        <label
          htmlFor="task-instructions"
          className="mb-2 block text-sm font-medium"
        >
          What should Stead do?
        </label>
        <textarea
          id="task-instructions"
          disabled={create.isPending}
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          required
          maxLength={16000}
          rows={6}
          placeholder="Describe the question or result you need, and what a good outcome looks like."
          className={`${fieldClass} resize-y leading-6`}
        />
      </div>
      <UploadInput
        files={files}
        onChange={setFiles}
        disabled={create.isPending}
      />
      {create.error ? <ErrorNotice error={create.error} /> : null}
      <Button
        type="submit"
        disabled={create.isPending || !title.trim() || !instructions.trim()}
        className="w-full"
      >
        {create.isPending ? "Starting work…" : "Start task"}
        <ArrowRight size={16} />
      </Button>
    </form>
  );
}
