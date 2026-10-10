import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
export function Markdown({ children }: { children: string }) {
  return (
    <div className="break-words text-sm leading-7 [&_a]:text-accent [&_a]:underline [&_blockquote]:border-l [&_blockquote]:border-line [&_blockquote]:pl-4 [&_blockquote]:text-muted [&_code]:rounded [&_code]:bg-hover [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs [&_h1]:mb-4 [&_h1]:mt-7 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-3 [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-rail [&_pre]:p-4 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_ul]:list-disc [&_ul]:pl-5 [&_table]:my-4 [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_td]:border [&_td]:border-line [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-line [&_th]:bg-rail [&_th]:px-3 [&_th]:py-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children: label, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer">
              {label}
            </a>
          ),
          img: ({ alt }) => (
            <span className="text-muted">[Image: {alt || "attachment"}]</span>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
