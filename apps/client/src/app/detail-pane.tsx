import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, X } from "lucide-react";
import { IconButton } from "@stead/ui";
import type { WorkspaceSearch } from "@/app/router";
import { workspaceOptions } from "@/lib/queries";
import { ErrorNotice, Loading } from "@/app/feedback";
import { TaskDetail } from "@/features/tasks/task-detail";
import { CreateTask } from "@/features/tasks/create-task";
import { FileViewer } from "@/features/artifacts/file-viewer";
import { NotesPanel } from "@/features/notes/notes-panel";
import { ResponsibilityPanel } from "@/features/responsibilities/responsibility-panel";
export function DetailPane({
  search,
  select,
}: {
  search: WorkspaceSearch;
  select: (next: WorkspaceSearch) => void;
}) {
  const workspace = useQuery({
    ...workspaceOptions,
    enabled: search.panel === "notes" || search.panel === "responsibilities",
  });
  const detailTitle = search.file
    ? "File"
    : search.panel === "new"
      ? "New task"
      : search.panel === "notes"
        ? "Personal notes"
        : search.panel === "responsibilities"
          ? "Responsibilities"
          : "Task details";
  return (
    <aside
      aria-label={detailTitle}
      className={`flex min-h-0 min-w-0 flex-1 flex-col border-l border-line bg-surface lg:flex-none ${search.file ? "lg:w-[44%] 2xl:w-[48%]" : "lg:w-95 xl:w-105"}`}
    >
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-3 lg:h-18 lg:px-5">
        <div className="flex items-center gap-2">
          <IconButton
            label="Back to conversation"
            onClick={() => select({})}
            className="lg:hidden"
          >
            <ChevronLeft size={18} />
          </IconButton>
          <h2 className="text-sm font-semibold">{detailTitle}</h2>
        </div>
        <IconButton label="Close detail pane" onClick={() => select({})}>
          <X size={17} />
        </IconButton>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {search.task && search.file ? (
          <FileViewer
            key={`${search.task}:${search.file}`}
            taskId={search.task}
            path={search.file}
            onBack={() => select({ task: search.task })}
          />
        ) : search.panel === "new" ? (
          <CreateTask onCreated={(id) => select({ task: id })} />
        ) : search.panel === "notes" ? (
          workspace.data ? (
            <NotesPanel notes={workspace.data.notes} />
          ) : workspace.error ? (
            <div className="p-5">
              <ErrorNotice
                error={workspace.error}
                retry={() => void workspace.refetch()}
              />
            </div>
          ) : (
            <Loading />
          )
        ) : search.panel === "responsibilities" ? (
          workspace.data ? (
            <ResponsibilityPanel
              responsibilities={workspace.data.responsibilities}
              onTask={(id) => select({ task: id })}
            />
          ) : workspace.error ? (
            <div className="p-5">
              <ErrorNotice
                error={workspace.error}
                retry={() => void workspace.refetch()}
              />
            </div>
          ) : (
            <Loading />
          )
        ) : search.task ? (
          <TaskDetail
            key={search.task}
            id={search.task}
            onFile={(path) => select({ task: search.task, file: path })}
          />
        ) : null}
      </div>
    </aside>
  );
}
