import type React from "react";
import ReactMarkdown from "react-markdown";

interface Props {
  markdown: string;
  /** Section đầu tiên hoặc đoạn mở section → font hơi lớn + medium weight để dẫn mắt. */
  lead?: boolean;
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

/**
 * Tự bold giá tiền + spec quan trọng để user scan-friendly. Pattern affiliate VN:
 * con số kèm đơn vị (8 triệu, 5500mAh, 90W) phải đập vào mắt → bold.
 * Negative lookbehind/ahead để khỏi double-bold khi writer đã ** sẵn.
 *
 * Không match trong code fence ```...``` (split theo backtick fence trước khi xử lý).
 */
const SPEC_PATTERN =
  /(?<!\*)(\b\d+(?:[.,]\d+)?\s*(?:triệu|tr|nghìn|đ|VND|mAh|Wh|GHz|MHz|W|MP|inch|fps|Hz|kg|°C|GB|TB|MB|RPM|cm|mm|nits|lumens|BTU|lít|L|ml|km|m²)\b)(?!\*)/gi;

function autoBoldSpecs(md: string): string {
  if (!md) return md;
  // Split theo code fence; chỉ apply replace ngoài fence.
  const segments = md.split(/(```[\s\S]*?```)/g);
  return segments
    .map((seg) => (seg.startsWith("```") ? seg : seg.replace(SPEC_PATTERN, "**$1**")))
    .join("");
}

export function ProseBlock({ markdown, lead }: Props): React.ReactElement {
  const transformed = autoBoldSpecs(reflowParagraphs(markdown));

  // Lead-in: font 18.5px, medium weight, màu ink (đậm hơn body) — dẫn mắt vào section.
  // Body thường: 17px desktop, leading 1.78, tracking nhẹ +0.005em cho TV (TV cần thoáng hơn EN).
  const sizeCls = lead
    ? "text-[18.5px] sm:text-[19px] font-medium text-ink leading-[1.7]"
    : "text-[16.5px] sm:text-[17px] leading-[1.78] tracking-[0.005em] text-ink-soft";

  return (
    <div
      className={`prose prose-slate max-w-none ${sizeCls} prose-headings:mt-8 prose-headings:font-semibold prose-headings:text-ink prose-h2:text-[22px] prose-h2:tracking-tight prose-h3:text-[19px] prose-h3:mt-7 prose-p:my-5 prose-p:leading-[inherit] prose-a:text-primary-700 prose-a:font-medium prose-a:no-underline hover:prose-a:underline prose-strong:text-ink prose-strong:font-semibold prose-ul:my-5 prose-ul:space-y-2 prose-ol:my-5 prose-ol:space-y-2 prose-li:leading-[1.7] prose-li:marker:text-primary-500 prose-blockquote:border-l-4 prose-blockquote:border-primary-300 prose-blockquote:bg-card prose-blockquote:px-5 prose-blockquote:py-3 prose-blockquote:my-6 prose-blockquote:not-italic prose-blockquote:text-ink-soft prose-blockquote:rounded-r-lg`}
    >
      <ReactMarkdown>{transformed}</ReactMarkdown>
    </div>
  );
}
