import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  CalendarClock,
  Leaf,
  LogOut,
  MessageSquare,
  Plus,
} from "lucide-react";
import { Button, IconButton } from "@stead/ui";
import type { WorkspaceSearch } from "@/app/router";
import { api } from "@/lib/api";
import { queryClient, workspaceOptions } from "@/lib/queries";
import { ErrorNotice, Loading } from "@/app/feedback";
import { TaskList } from "@/features/tasks/task-list";
export function WorkspaceRail({
  search,
  select,
  railOpen,
}: {
  search: WorkspaceSearch;
  select: (next: WorkspaceSearch) => void;
  railOpen: boolean;
}) {
  const workspace = useQuery(workspaceOptions);
  const hasDetail = Boolean(search.task || search.panel);
  const tasks = workspace.data?.tasks || [];
  const activeCount = tasks.filter(
    (task) => task.status === "running" || task.status === "queued",
  ).length;
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      queryClient.clear();
      window.location.assign("/");
    },
  });
  return (
    <aside
      aria-label="Workspace navigation"
      className={`${railOpen ? "flex" : "hidden"} absolute inset-y-0 left-0 z-30 w-64 shrink-0 flex-col border-r border-line bg-rail md:static md:flex md:w-60 xl:w-64`}
    >
      <div className="hidden h-22 shrink-0 items-center gap-2.5 px-6 md:flex">
        <Leaf size={25} strokeWidth={1.5} className="text-accent" />
        <span className="font-serif text-4xl tracking-tight">stead</span>
        <span className="ml-auto rounded border border-line px-1.5 py-0.5 text-[10px] text-muted">
          PREVIEW
        </span>
      </div>
      <div className="px-3 pt-4 md:pt-0">
        <button
          onClick={() => select({})}
          aria-current={!hasDetail ? "page" : undefined}
          className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium ${!hasDetail ? "bg-surface text-ink" : "text-muted hover:bg-hover"}`}
        >
          <MessageSquare size={16} />
          Conversation
        </button>
        <Button
          variant="secondary"
          className="mt-4 w-full justify-start"
          onClick={() => select({ panel: "new" })}
        >
          <Plus size={16} />
          New task
        </Button>
      </div>
      <div className="mb-2 mt-7 flex items-center justify-between px-5">
        <h2 className="text-xs font-semibold text-muted">Your work</h2>
        {activeCount ? (
          <span className="text-xs text-accent">{activeCount} active</span>
        ) : (
          <span className="text-xs text-muted">{tasks.length}</span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {workspace.isPending ? (
          <Loading label="Loading work…" />
        ) : workspace.isError ? (
          <div className="p-3">
            <ErrorNotice
              error={workspace.error}
              retry={() => void workspace.refetch()}
            />
          </div>
        ) : (
          <TaskList
            tasks={tasks}
            selected={search.task}
            onSelect={(id) => select({ task: id })}
          />
        )}
      </div>
      <nav className="mt-3 border-t border-line px-3 py-3">
        <button
          onClick={() => select({ panel: "notes" })}
          aria-current={search.panel === "notes" ? "page" : undefined}
          className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm ${search.panel === "notes" ? "bg-surface font-medium" : "text-muted hover:bg-hover"}`}
        >
          <BookOpen size={16} />
          Personal notes
          <span className="ml-auto text-xs">
            {workspace.data?.notes.length || ""}
          </span>
        </button>
        <button
          onClick={() => select({ panel: "responsibilities" })}
          aria-current={
            search.panel === "responsibilities" ? "page" : undefined
          }
          className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm ${search.panel === "responsibilities" ? "bg-surface font-medium" : "text-muted hover:bg-hover"}`}
        >
          <CalendarClock size={16} />
          Responsibilities
          {workspace.data?.responsibilities.some(
            (item) => item.status === "active",
          ) ? (
            <span className="ml-auto size-1.5 rounded-full bg-accent" />
          ) : null}
        </button>
      </nav>
      <div className="flex items-center justify-between border-t border-line px-5 py-3">
        <div>
          <p className="text-xs font-medium">Your private workspace</p>
          <p className="mt-1 text-[11px] text-muted">
            A place to pick things back up.
          </p>
        </div>
        <IconButton
          label="Sign out"
          disabled={logout.isPending}
          onClick={() => logout.mutate()}
        >
          <LogOut size={15} />
        </IconButton>
      </div>
      {logout.error ? (
        <div className="p-3">
          <ErrorNotice error={logout.error} />
        </div>
      ) : null}
    </aside>
  );
}
