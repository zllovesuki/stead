import { useEffect, useRef, useState } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/think/react";
import { ArrowUp, Check, Circle, Leaf, Square, Wrench } from "lucide-react";
import { Button, IconButton } from "@stead/ui";
import { ErrorNotice } from "@/app/feedback";
import { Markdown } from "@/features/chat/markdown";
import { refreshWorkspace } from "@/lib/queries";

type Connection = "connecting" | "connected" | "disconnected";
export function Conversation({ onNewTask }: { onNewTask: () => void }) {
  const [connection, setConnection] = useState<Connection>("connecting");
  const agent = useAgent({
    agent: "personal-agent",
    name: "main",
    onOpen: () => {
      setConnection("connected");
      void refreshWorkspace();
    },
    onClose: () => setConnection("disconnected"),
    onError: () => setConnection("disconnected"),
  });
  const chat = useAgentChat({
    agent,
    credentials: "same-origin",
    onFinish: () => {
      void refreshWorkspace();
    },
  });
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<Error | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const busy =
    chat.isStreaming || chat.status === "submitted" || chat.isRecovering;
  useEffect(() => {
    if (nearBottom.current)
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "instant",
      });
  }, [chat.messages, busy]);
  async function send() {
    const text = draft.trim();
    if (!text || busy || connection !== "connected") return;
    setSendError(null);
    setDraft("");
    try {
      await chat.sendMessage({ text });
    } catch (error) {
      setDraft((current) => current || text);
      setSendError(
        error instanceof Error
          ? error
          : new Error("Message could not be sent."),
      );
    }
  }
  return (
    <section
      aria-label="Main conversation"
      className="flex h-full min-h-0 min-w-0 flex-col bg-surface"
    >
      <header className="flex h-18 shrink-0 items-center justify-between border-b border-line px-5 sm:px-8">
        <div>
          <h1 className="text-base font-semibold">Conversation</h1>
          <p className="mt-0.5 text-xs text-muted">
            The same assistant. Room to keep going.
          </p>
        </div>
        <div
          role="status"
          className="flex items-center gap-1.5 text-xs text-muted"
        >
          <Circle
            size={7}
            fill="currentColor"
            className={
              connection === "connected" ? "text-accent" : "text-warning"
            }
          />
          {connection === "connected"
            ? "Connected"
            : connection === "connecting"
              ? "Connecting"
              : "Reconnecting"}
        </div>
      </header>
      <div
        ref={scrollRef}
        onScroll={() => {
          const element = scrollRef.current;
          if (element)
            nearBottom.current =
              element.scrollHeight - element.scrollTop - element.clientHeight <
              120;
        }}
        className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8"
      >
        <div className="mx-auto max-w-2xl">
          {chat.messages.length === 0 ? (
            <div className="flex min-h-72 flex-col justify-center py-10">
              <Leaf size={30} strokeWidth={1.25} className="mb-6 text-accent" />
              <h2 className="max-w-sm text-balance font-serif text-4xl leading-tight tracking-tight">
                What’s on your mind?
              </h2>
              <p className="mt-4 max-w-md text-sm leading-7 text-muted">
                Think something through, hand off a task, or tell me what to
                remember. We can keep talking while your work continues.
              </p>
              <div className="mt-8 border-t border-line pt-4">
                <button
                  onClick={onNewTask}
                  className="flex min-h-11 items-center gap-2 text-sm font-medium text-accent hover:underline"
                >
                  Start a piece of work{" "}
                  <ArrowUp size={15} className="rotate-45" />
                </button>
                <p className="text-xs leading-6 text-muted">
                  Research a question, explore a dataset, or make something.
                </p>
              </div>
            </div>
          ) : (
            chat.messages.map((message) => (
              <article
                key={message.id}
                className={`mb-7 ${message.role === "user" ? "ml-8 rounded-xl bg-canvas px-4 py-2 sm:ml-12" : ""}`}
              >
                <p className="mb-1 flex items-center gap-2 text-xs font-medium text-muted">
                  {message.role === "user" ? (
                    "You"
                  ) : (
                    <>
                      <Leaf size={13} />
                      Stead
                    </>
                  )}
                </p>
                {message.parts.map((part, index) => {
                  if (part.type === "text")
                    return <Markdown key={index}>{part.text}</Markdown>;
                  if (
                    part.type.startsWith("tool-") ||
                    part.type === "dynamic-tool"
                  ) {
                    const tool = part as {
                      type: string;
                      toolName?: string;
                      state?: string;
                      errorText?: string;
                    };
                    const done = tool.state === "output-available";
                    return (
                      <div
                        key={index}
                        className="my-2 flex items-center gap-2 rounded-lg bg-canvas px-3 py-2 text-xs text-muted"
                      >
                        {done ? <Check size={13} /> : <Wrench size={13} />}
                        <span>
                          {tool.toolName ||
                            tool.type.replace("tool-", "").replaceAll("_", " ")}
                        </span>
                        <span className="ml-auto">
                          {done
                            ? "Done"
                            : tool.state === "output-error"
                              ? "Failed"
                              : "Working"}
                        </span>
                      </div>
                    );
                  }
                  return null;
                })}
              </article>
            ))
          )}
          {busy ? (
            <p
              role="status"
              className="flex items-center gap-2 py-2 text-sm text-muted"
            >
              <span className="size-1.5 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
              {chat.isRecovering
                ? "Restoring the current turn…"
                : "Stead is thinking…"}
            </p>
          ) : null}
        </div>
      </div>
      <div className="shrink-0 px-4 pb-4 sm:px-8 sm:pb-6">
        <div className="mx-auto max-w-2xl">
          {chat.error || chat.connectionError || sendError ? (
            <div className="mb-3">
              <ErrorNotice
                error={sendError || chat.error || chat.connectionError}
              />
            </div>
          ) : null}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
            className="rounded-xl border border-line bg-canvas p-3 focus-within:border-accent"
          >
            <label htmlFor="message" className="sr-only">
              Message Stead
            </label>
            <textarea
              id="message"
              rows={2}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  void send();
                }
              }}
              placeholder="Tell Stead what you’re thinking…"
              className="block max-h-40 min-h-15 w-full resize-y border-0 bg-transparent px-1 py-1 text-sm leading-6 outline-none!"
            />
            <div className="mt-1 flex items-center justify-between">
              <span className="pl-1 text-xs text-muted">
                {busy
                  ? "Background work continues independently"
                  : "Enter to send · Shift + Enter for a new line"}
              </span>
              {busy ? (
                <IconButton
                  label="Stop this reply"
                  onClick={() => void chat.stop()}
                >
                  <Square size={15} fill="currentColor" />
                </IconButton>
              ) : (
                <Button
                  type="submit"
                  disabled={!draft.trim() || connection !== "connected"}
                  aria-label="Send message"
                  className="size-10 !px-0"
                >
                  <ArrowUp size={19} />
                </Button>
              )}
            </div>
          </form>
          <p className="mt-2 text-center text-[11px] text-muted">
            Work and files stay here when you step away.
          </p>
        </div>
      </div>
    </section>
  );
}
