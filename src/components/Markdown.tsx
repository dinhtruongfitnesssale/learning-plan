import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Render markdown bài học với phong cách editorial của brand.
export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-4 text-ink/85 leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => (
            <h2 className="font-serif text-2xl text-ink mt-8 mb-1 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-serif text-xl text-ink mt-6 mb-1">{children}</h3>
          ),
          p: ({ children }) => <p>{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc pl-5 space-y-1.5 marker:text-amber">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 space-y-1.5 marker:text-amber marker:font-mono">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-amber pl-4 italic text-ink/70 my-5">
              {children}
            </blockquote>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-ink">{children}</strong>
          ),
          em: ({ children }) => <em className="text-amber not-italic">{children}</em>,
          a: ({ children, href }) => (
            <a href={href} className="link" target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="font-mono text-sm bg-paper-2 rounded px-1.5 py-0.5">
              {children}
            </code>
          ),
          // Ảnh / bảng / khối code: giữ trong bề ngang màn hình, bảng dài thì
          // tự có thanh cuộn riêng thay vì kéo lệch cả trang.
          img: ({ src, alt }) => (
            <img
              src={typeof src === "string" ? src : undefined}
              alt={alt ?? ""}
              className="w-full h-auto rounded-[var(--radius-card)] border border-ink/10"
            />
          ),
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-lg bg-paper-2 p-3 text-sm">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full text-sm border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-ink/10 bg-paper-2 px-2.5 py-1.5 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-ink/10 px-2.5 py-1.5 align-top">
              {children}
            </td>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
