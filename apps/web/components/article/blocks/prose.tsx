import type React from "react";
import ReactMarkdown from "react-markdown";

interface Props {
  markdown: string;
}

/**
 * AI hay sinh prose là 1 cục text liền không xuống dòng (đặc biệt DeepSeek/Qwen).
 * Khi không có `\n\n` mà text dài > 400 chars → tự break sau mỗi 3-4 câu để khỏi
 * thành tường chữ. Detect câu Việt qua `.`, `!`, `?` + space. Không đụng nếu markdown
 * đã có paragraph (writer tốt đã `\n\n`).
 */
function reflowParagraphs(md: string): string {
  if (!md) return md;
  if (md.includes("\n\n")) return md;
  if (md.length < 400) return md;
  const sentences = md.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (!sentences || sentences.length < 4) return md;
  const groups: string[] = [];
  for (let i = 0; i < sentences.length; i += 3) {
    groups.push(sentences.slice(i, i + 3).join("").trim());
  }
  return groups.join("\n\n");
}

export function ProseBlock({ markdown }: Props): React.ReactElement {
  const reflowed = reflowParagraphs(markdown);
  // Typography tối ưu cho đọc dài: cỡ 17px (tiếng Việt cần nhỉnh hơn Anh), line-height 1.75,
  // paragraph spacing rộng hơn, max-width ~700 char cho mỗi dòng (qua wrapper bên ngoài đã cap),
  // chỉ tô đậm + heading dùng màu đậm; body dùng ink-soft cho mắt đỡ mỏi.
  return (
    <div className="prose prose-slate max-w-none text-[17px] leading-[1.78] tracking-[0.005em] text-ink-soft prose-headings:mt-8 prose-headings:font-semibold prose-headings:text-ink prose-h2:text-[22px] prose-h2:tracking-tight prose-h3:text-[19px] prose-h3:mt-7 prose-p:my-5 prose-p:leading-[1.78] prose-a:text-brand-700 prose-a:font-medium prose-a:no-underline hover:prose-a:underline prose-strong:text-ink prose-strong:font-semibold prose-ul:my-5 prose-ul:space-y-2 prose-ol:my-5 prose-ol:space-y-2 prose-li:leading-[1.7] prose-li:marker:text-brand-500 prose-blockquote:border-l-4 prose-blockquote:border-brand-300 prose-blockquote:bg-card prose-blockquote:px-5 prose-blockquote:py-3 prose-blockquote:my-6 prose-blockquote:not-italic prose-blockquote:text-ink-soft prose-blockquote:rounded-r-lg">
      <ReactMarkdown>{reflowed}</ReactMarkdown>
    </div>
  );
}
