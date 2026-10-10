import { QueryClient, queryOptions } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      retry: (count, error) =>
        !(error instanceof ApiError && error.status < 500) && count < 1,
      refetchOnWindowFocus: true,
    },
    mutations: { retry: false },
  },
});
export const sessionOptions = queryOptions({
  queryKey: ["session"],
  queryFn: ({ signal }) => api.session(signal),
  staleTime: 60_000,
});
export const workspaceOptions = queryOptions({
  queryKey: ["workspace"],
  queryFn: ({ signal }) => api.workspace(signal),
  refetchInterval: 5_000,
});
export const taskOptions = (id: string) =>
  queryOptions({
    queryKey: ["task", id],
    queryFn: ({ signal }) => api.task(id, signal),
    refetchInterval: 4_000,
  });
export async function refreshWorkspace(id?: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["workspace"] }),
    ...(id
      ? [
          queryClient.invalidateQueries({ queryKey: ["task", id] }),
          queryClient.invalidateQueries({ queryKey: ["file", id] }),
        ]
      : []),
  ]);
}
