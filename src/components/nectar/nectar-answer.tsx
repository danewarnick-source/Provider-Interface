import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders a NECTAR answer as clean markdown with compact citation tags.
 * - Bullets, bold section labels, italic notes render naturally.
 * - Inline `code` spans are styled as small "source tag" chips (e.g. `SOW · 1.8`).
 * - No raw "###" or "**" should ever leak through.
 */
export function NectarAnswer({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-[var(--hive-text)] [&_strong]:font-semibold [&_em]:text-muted-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="my-1.5 list-disc space-y-1 pl-5 marker:text-[var(--hive-accent-text)]">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-1.5 list-decimal space-y-1 pl-5">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-snug">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-[var(--hive-text)]">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="not-italic text-xs text-muted-foreground">{children}</em>
          ),
          a: ({ children, href }) => (
            <a href={href} className="text-[var(--hive-accent-text)] underline underline-offset-2 hover:text-accd">
              {children}
            </a>
          ),
          // Citation chips: `SOW · 1.8`
          code: ({ children }) => (
            <span className="ml-1 inline-flex items-center rounded border border-pt2 bg-pt px-1.5 py-0.5 align-baseline text-[10px] font-medium uppercase tracking-wide text-pri">
              {children}
            </span>
          ),
          h1: ({ children }) => <p className="font-semibold">{children}</p>,
          h2: ({ children }) => <p className="font-semibold">{children}</p>,
          h3: ({ children }) => <p className="font-semibold">{children}</p>,
          hr: () => <hr className="my-2 border-pt2" />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
