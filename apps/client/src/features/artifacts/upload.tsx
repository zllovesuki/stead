import { useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { MAX_FILE_BYTES, type UploadFile } from "@stead/contracts";
import { Button, IconButton } from "@stead/ui";
import { ErrorNotice } from "@/app/feedback";

export function UploadInput({
  files,
  onChange,
  disabled = false,
}: {
  files: UploadFile[];
  onChange: (files: UploadFile[]) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<Error | null>(null);
  const [reading, setReading] = useState(false);
  async function add(selected: FileList | null) {
    if (!selected?.length) return;
    setError(null);
    setReading(true);
    try {
      if (files.length + selected.length > 4)
        throw new Error("Attach up to four text or CSV files.");
      const additions = await Promise.all(
        Array.from(selected, async (file) => {
          if (file.size > MAX_FILE_BYTES)
            throw new Error(
              `${file.name} is too large. Use a file under 256 KB.`,
            );
          const content = await file.text();
          if (content.includes("\0"))
            throw new Error(`${file.name} is not a supported text file.`);
          return { path: file.name, content };
        }),
      );
      if (
        new Set([...files, ...additions].map((file) => file.path)).size !==
        files.length + additions.length
      )
        throw new Error("A file with this name is already attached.");
      onChange([...files, ...additions]);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause : new Error("Could not read this file."),
      );
    } finally {
      setReading(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <div>
      <input
        ref={input}
        type="file"
        accept=".csv,.txt,.md,.json,.js,.ts,.html,.css"
        multiple
        onChange={(event) => void add(event.target.files)}
        className="sr-only"
        tabIndex={-1}
      />
      <Button
        variant="quiet"
        disabled={disabled || reading || files.length >= 4}
        onClick={() => input.current?.click()}
        className="-ml-3"
      >
        <Paperclip size={15} />
        {reading ? "Reading files…" : "Attach CSV or text"}
      </Button>
      <p className="text-xs text-muted">Up to 4 files · 256 KB each</p>
      {files.map((file) => (
        <div
          key={file.path}
          className="mt-2 flex items-center justify-between rounded-lg bg-canvas pl-3 text-xs"
        >
          <span className="truncate">{file.path}</span>
          <IconButton
            label={`Remove ${file.path}`}
            disabled={disabled}
            onClick={() =>
              onChange(files.filter((item) => item.path !== file.path))
            }
          >
            <X size={14} />
          </IconButton>
        </div>
      ))}
      {error ? (
        <div className="mt-3">
          <ErrorNotice error={error} />
        </div>
      ) : null}
    </div>
  );
}
