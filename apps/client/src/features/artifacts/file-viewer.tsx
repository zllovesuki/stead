import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { Button, IconButton } from "@stead/ui";
import { api } from "@/lib/api";
import { formatBytes } from "@/lib/format";
import { ErrorNotice, Loading } from "@/app/feedback";
import { Markdown } from "@/features/chat/markdown";
import { parseCsv } from "@/features/artifacts/csv";
export function FileViewer({
  taskId,
  path,
  onBack,
}: {
  taskId: string;
  path: string;
  onBack: () => void;
}) {
  const query = useQuery({
    queryKey: ["file", taskId, path],
    queryFn: ({ signal }) => api.file(taskId, path, signal),
    refetchInterval: 4_000,
  });
  const [preview, setPreview] = useState(false);
  const name = path.split("/").at(-1) || path;
  return (
    <section className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-3">
        <IconButton label="Back to task" onClick={onBack}>
          <ArrowLeft size={17} />
        </IconButton>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold" title={path}>
            {name}
          </h2>
          <p className="text-xs text-muted">
            {query.data ? formatBytes(query.data.size) : "Saved file"}
          </p>
        </div>
        <a
          href={api.fileUrl(taskId, path, "download")}
          download={name}
          aria-label={`Download ${name}`}
          title="Download file"
          className="grid size-10 place-items-center rounded-lg text-muted hover:bg-hover"
        >
          <Download size={17} />
        </a>
      </header>
      {query.isPending ? (
        <Loading label="Opening file…" />
      ) : query.isError ? (
        <div className="p-5">
          <ErrorNotice error={query.error} retry={() => void query.refetch()} />
        </div>
      ) : (
        <>
          <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-2 text-xs text-muted">
            <span className="flex min-w-0 items-center gap-2">
              <FileText size={13} />
              <span className="truncate">{query.data.mediaType}</span>
            </span>
            {/\.html?$/i.test(path) ? (
              <Button
                variant="quiet"
                className="!min-h-8 !py-1 text-xs"
                onClick={() => setPreview(!preview)}
              >
                {preview ? "View source" : "Open preview"}
              </Button>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {preview && /\.html?$/i.test(path) ? (
              <div className="flex h-full flex-col">
                <p className="bg-warning-soft px-4 py-2 text-xs leading-5 text-warning">
                  Generated preview runs in an isolated frame.
                </p>
                <iframe
                  key={query.data.content}
                  title={`Preview of ${name}`}
                  sandbox="allow-scripts"
                  referrerPolicy="no-referrer"
                  src={api.fileUrl(taskId, path, "preview")}
                  className="min-h-96 w-full flex-1 border-0 bg-white"
                />
              </div>
            ) : /\.csv$/i.test(path) ? (
              <CsvTable content={query.data.content} />
            ) : /\.md$/i.test(path) ||
              query.data.mediaType.includes("markdown") ? (
              <div className="p-5 sm:p-6">
                <Markdown>{query.data.content}</Markdown>
              </div>
            ) : (
              <pre className="p-5 font-mono text-xs leading-6">
                <code>{query.data.content}</code>
              </pre>
            )}
          </div>
        </>
      )}
    </section>
  );
}
function CsvTable({ content }: { content: string }) {
  const rows = parseCsv(content);
  const totalColumns = rows.reduce(
    (width, row) => Math.max(width, row.length),
    0,
  );
  const width = Math.min(totalColumns, 50);
  if (!rows.length)
    return <p className="p-5 text-sm text-muted">This file is empty.</p>;
  return (
    <div>
      <table className="w-full border-collapse text-left text-xs tabular-nums">
        <thead className="sticky top-0 bg-rail">
          <tr>
            {Array.from({ length: width }, (_, index) => (
              <th
                key={index}
                className="whitespace-nowrap border-b border-line px-4 py-3 font-semibold"
              >
                {rows[0]?.[index] || `Column ${index + 1}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(1, 201).map((row, index) => (
            <tr key={index} className="even:bg-canvas">
              {Array.from({ length: width }, (_, column) => (
                <td
                  key={column}
                  className="max-w-80 whitespace-pre-wrap border-b border-line px-4 py-2.5"
                >
                  {row[column] || ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 201 || totalColumns > 50 ? (
        <p className="p-4 text-xs text-muted">
          Showing up to 200 rows and 50 columns. Download the file for the full
          dataset.
        </p>
      ) : null}
    </div>
  );
}
