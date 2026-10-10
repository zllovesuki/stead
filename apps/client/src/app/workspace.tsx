import { useState } from "react";
import { Leaf, Menu, X } from "lucide-react";
import { IconButton } from "@stead/ui";
import { workspaceRoute, type WorkspaceSearch } from "@/app/router";
import { WorkspaceRail } from "@/app/workspace-rail";
import { DetailPane } from "@/app/detail-pane";
import { SessionGate } from "@/features/auth/session";
import { Conversation } from "@/features/chat/conversation";
export function Workspace() {
  return (
    <SessionGate>
      <WorkspaceContent />
    </SessionGate>
  );
}
function WorkspaceContent() {
  const search = workspaceRoute.useSearch();
  const navigate = workspaceRoute.useNavigate();
  const [railOpen, setRailOpen] = useState(false);
  const hasDetail = Boolean(search.task || search.panel);
  function select(next: WorkspaceSearch) {
    void navigate({ search: next });
    setRailOpen(false);
  }
  return (
    <div
      className="flex h-dvh min-h-0 flex-col overflow-hidden"
      onKeyDown={(event) => {
        if (event.key === "Escape") setRailOpen(false);
      }}
    >
      <a
        href="#conversation"
        className="fixed left-4 top-2 z-50 -translate-y-20 rounded-lg bg-accent px-4 py-2 text-white focus:translate-y-0"
      >
        Skip to conversation
      </a>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-rail px-3 md:hidden">
        <IconButton
          label={
            railOpen
              ? "Close workspace navigation"
              : "Open workspace navigation"
          }
          aria-expanded={railOpen}
          onClick={() => setRailOpen(!railOpen)}
        >
          {railOpen ? <X size={19} /> : <Menu size={19} />}
        </IconButton>
        <Leaf size={19} className="text-accent" />
        <span className="font-serif text-2xl">stead</span>
        <span className="ml-auto text-xs text-muted">Personal workspace</span>
      </header>
      <div className="relative flex min-h-0 flex-1">
        {railOpen ? (
          <button
            aria-label="Close workspace navigation"
            className="absolute inset-0 z-20 bg-ink/20 md:hidden"
            onClick={() => setRailOpen(false)}
          />
        ) : null}
        <WorkspaceRail search={search} select={select} railOpen={railOpen} />
        <main
          id="conversation"
          className={`min-h-0 min-w-0 flex-1 ${hasDetail ? "hidden lg:block" : "block"}`}
        >
          <Conversation onNewTask={() => select({ panel: "new" })} />
        </main>
        {hasDetail ? <DetailPane search={search} select={select} /> : null}
      </div>
    </div>
  );
}
