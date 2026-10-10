import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, KeyRound, Leaf } from "lucide-react";
import { Button } from "@stead/ui";
import { api } from "@/lib/api";
import { queryClient, sessionOptions } from "@/lib/queries";
import { ErrorNotice, fieldClass, Loading } from "@/app/feedback";

export function SessionGate({ children }: { children: ReactNode }) {
  const session = useQuery(sessionOptions);
  if (session.isPending)
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loading label="Opening your workspace…" />
      </div>
    );
  if (session.isError)
    return (
      <div className="mx-auto mt-20 max-w-md p-6">
        <ErrorNotice
          error={session.error}
          retry={() => void session.refetch()}
        />
      </div>
    );
  return session.data.authenticated ? (
    children
  ) : (
    <SignIn configured={session.data.configured} />
  );
}
function SignIn({ configured }: { configured: boolean }) {
  const [token, setToken] = useState("");
  const login = useMutation({
    mutationFn: () => api.login(token),
    onSuccess: async () => {
      setToken("");
      await queryClient.invalidateQueries({ queryKey: ["session"] });
    },
  });
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="flex flex-col justify-between bg-rail p-8 sm:p-14 lg:p-20">
        <a href="/" className="flex w-fit items-center gap-2.5 text-accent">
          <Leaf size={27} strokeWidth={1.5} />
          <span className="font-serif text-4xl tracking-tight">stead</span>
        </a>
        <div className="max-w-lg py-16 lg:py-24">
          <h1 className="text-balance font-serif text-5xl leading-[1.12] tracking-tight sm:text-6xl">
            A little continuity.
            <br />A lot of possibility.
          </h1>
          <p className="mt-7 max-w-sm text-lg leading-relaxed text-muted">
            One assistant to think with. A place for work to continue, and for
            you to pick up where you left off.
          </p>
        </div>
        <p className="text-sm text-muted">
          Your conversation, work, and useful context. Together.
        </p>
      </section>
      <section className="flex items-center justify-center px-7 py-14 sm:p-14">
        <form
          className="w-full max-w-sm"
          onSubmit={(event) => {
            event.preventDefault();
            if (token.trim()) login.mutate();
          }}
        >
          <KeyRound size={24} strokeWidth={1.5} className="mb-6 text-accent" />
          <h2 className="font-serif text-3xl">Come on in.</h2>
          <p className="mb-8 mt-3 text-sm leading-relaxed text-muted">
            Enter your operator access token to open your personal workspace.
          </p>
          {!configured ? (
            <ErrorNotice
              error={
                new Error(
                  "This workspace needs an operator token configured on the server before you can sign in.",
                )
              }
            />
          ) : null}
          <label
            htmlFor="access-token"
            className="mb-2 block text-sm font-medium"
          >
            Access token
          </label>
          <input
            id="access-token"
            name="token"
            type="password"
            autoComplete="current-password"
            required
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className={fieldClass}
            disabled={!configured || login.isPending}
          />
          {login.error ? (
            <div className="mt-4">
              <ErrorNotice error={login.error} />
            </div>
          ) : null}
          <Button
            type="submit"
            disabled={!configured || !token.trim() || login.isPending}
            className="mt-5 w-full"
          >
            {login.isPending ? "Opening workspace…" : "Open workspace"}
            <ArrowRight size={16} />
          </Button>
          <p className="mt-6 text-xs leading-relaxed text-muted">
            Your access token is used to establish a private session.
          </p>
        </form>
      </section>
    </main>
  );
}
