import type React from "react";
import ReactMarkdown from "react-markdown";

interface Props {
  markdown: string;
}

export function ProseBlock({ markdown }: Props): React.ReactElement {
  return (
    <div className="prose prose-slate max-w-none prose-headings:mt-6 prose-headings:font-semibold prose-h2:text-2xl prose-h2:tracking-tight prose-h3:text-xl prose-p:leading-7 prose-a:text-brand-700 prose-a:no-underline hover:prose-a:underline prose-strong:text-ink prose-li:marker:text-brand-500 prose-blockquote:border-l-4 prose-blockquote:border-brand-300 prose-blockquote:bg-card prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:not-italic prose-blockquote:text-ink-soft">
      <ReactMarkdown>{markdown}</ReactMarkdown>
    </div>
  );
}
