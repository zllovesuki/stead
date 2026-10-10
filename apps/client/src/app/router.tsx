import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { Workspace } from "@/app/workspace";
export type WorkspaceSearch = {
  task?: string;
  file?: string;
  panel?: "new" | "notes" | "responsibilities";
};
const rootRoute = createRootRoute({ component: () => <Outlet /> });
export const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: (search: Record<string, unknown>): WorkspaceSearch => ({
    task: typeof search.task === "string" ? search.task : undefined,
    file: typeof search.file === "string" ? search.file : undefined,
    panel:
      search.panel === "new" ||
      search.panel === "notes" ||
      search.panel === "responsibilities"
        ? search.panel
        : undefined,
  }),
  component: Workspace,
});
export const router = createRouter({
  routeTree: rootRoute.addChildren([workspaceRoute]),
  defaultNotFoundComponent: () => (
    <main className="grid min-h-dvh place-content-center gap-4 p-8">
      <h1 className="font-serif text-3xl">This page isn’t here.</h1>
      <a href="/" className="text-accent underline">
        Return to your workspace
      </a>
    </main>
  ),
});
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
