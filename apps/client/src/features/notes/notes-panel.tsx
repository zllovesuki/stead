import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button, IconButton } from "@stead/ui";
import type { Note } from "@stead/contracts";
import { api } from "@/lib/api";
import { refreshWorkspace } from "@/lib/queries";
import { ErrorNotice, fieldClass } from "@/app/feedback";
export function NotesPanel({ notes }: { notes: Note[] }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="p-5 sm:p-6">
      <h2 className="font-serif text-2xl">A little useful context.</h2>
      <p className="mb-6 mt-3 text-sm leading-6 text-muted">
        Preferences and decisions for Stead to remember. These notes are yours
        to correct or remove.
      </p>
      {notes.length ? (
        <div className="space-y-5">
          {notes.map((note) => (
            <NoteItem key={note.id} note={note} />
          ))}
        </div>
      ) : !adding ? (
        <p className="border-y border-line py-6 text-sm leading-6 text-muted">
          Nothing saved yet. Add how you like to work, what matters to you, or a
          decision to carry forward.
        </p>
      ) : null}
      {adding ? (
        <NoteEditor onDone={() => setAdding(false)} />
      ) : (
        <Button
          variant="secondary"
          className="mt-5"
          onClick={() => setAdding(true)}
        >
          <Plus size={15} />
          Add a note
        </Button>
      )}
    </div>
  );
}
function NoteItem({ note }: { note: Note }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const remove = useMutation({
    mutationFn: () => api.deleteNote(note.id),
    onSuccess: () => refreshWorkspace(),
  });
  if (editing)
    return <NoteEditor note={note} onDone={() => setEditing(false)} />;
  return (
    <article className="border-b border-line pb-4">
      <p className="whitespace-pre-wrap text-sm leading-7">{note.text}</p>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-muted">From {note.source}</p>
        <div className="flex">
          <IconButton label="Edit note" onClick={() => setEditing(true)}>
            <Pencil size={14} />
          </IconButton>
          <IconButton
            label="Delete note"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={14} />
          </IconButton>
        </div>
      </div>
      {confirmDelete ? (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-danger-soft p-2">
          <p className="flex-1 text-xs text-danger">Remove this note?</p>
          <Button
            variant="danger"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            Remove
          </Button>
          <IconButton label="Keep note" onClick={() => setConfirmDelete(false)}>
            <X size={15} />
          </IconButton>
        </div>
      ) : null}
      {remove.error ? <ErrorNotice error={remove.error} /> : null}
    </article>
  );
}
function NoteEditor({ note, onDone }: { note?: Note; onDone: () => void }) {
  const [text, setText] = useState(note?.text || "");
  const save = useMutation({
    mutationFn: () =>
      api.writeNote({ text, source: note?.source || "You" }, note?.id),
    onSuccess: async () => {
      await refreshWorkspace();
      onDone();
    },
  });
  return (
    <form
      className="mt-5"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <label
        htmlFor={`note-${note?.id || "new"}`}
        className="mb-2 block text-sm font-medium"
      >
        {note ? "Edit note" : "New note"}
      </label>
      <textarea
        id={`note-${note?.id || "new"}`}
        rows={4}
        disabled={save.isPending}
        required
        maxLength={4000}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Something useful to remember…"
        className={`${fieldClass} resize-y leading-6`}
      />
      <div className="mt-3 flex gap-2">
        <Button type="submit" disabled={!text.trim() || save.isPending}>
          <Check size={14} />
          {save.isPending ? "Saving…" : "Save note"}
        </Button>
        <Button variant="quiet" disabled={save.isPending} onClick={onDone}>
          Cancel
        </Button>
      </div>
      {save.error ? (
        <div className="mt-3">
          <ErrorNotice error={save.error} />
        </div>
      ) : null}
    </form>
  );
}
