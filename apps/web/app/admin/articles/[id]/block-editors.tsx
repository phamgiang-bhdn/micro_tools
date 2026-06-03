"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, X, Code, Info, ShoppingBag } from "lucide-react";

/**
 * Per-type form editors cho từng loại ArticleBlock.
 * Mỗi block type có UI riêng — admin không phải sửa JSON tay.
 * Fallback JSON cho block type lạ + advanced toggle (collapsed) cho block type biết.
 *
 * Style guideline: label font-semibold + text-admin-ink; value font-normal + text-admin-ink.
 * KHÔNG dùng text-mute cho content thật, chỉ cho hint/helper.
 */

type AnyBlock = { type: string } & Record<string, unknown>;

interface DispatcherProps {
  block: AnyBlock;
  onChange: (next: AnyBlock) => void;
}

export function BlockFormDispatcher({ block, onChange }: DispatcherProps) {
  switch (block.type) {
    case "prose":
      return <ProseEditor block={block} onChange={onChange} />;
    case "image":
      return <ImageEditor block={block} onChange={onChange} />;
    case "callout":
      return <CalloutEditor block={block} onChange={onChange} />;
    case "pros_cons":
      return <ProsConsEditor block={block} onChange={onChange} />;
    case "verdict":
      return <VerdictEditor block={block} onChange={onChange} />;
    case "faq":
      return <FaqEditor block={block} onChange={onChange} />;
    case "hero_quote":
      return <HeroQuoteEditor block={block} onChange={onChange} />;
    case "review_quote":
      return <ReviewQuoteEditor block={block} onChange={onChange} />;
    case "citation":
      return <CitationEditor block={block} onChange={onChange} />;
    case "criteria_grid":
      return <CriteriaGridEditor block={block} onChange={onChange} />;
    case "product_slot":
      return <ProductSlotReadOnly block={block} />;
    case "product_spotlight":
      return <ProductSpotlightReadOnly block={block} />;
    case "comparison":
      return <ComparisonReadOnly block={block} />;
    default:
      return <JsonFallback block={block} onChange={onChange} />;
  }
}

// ─── Shared field primitives ───
function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-[11.5px] font-bold uppercase tracking-wider text-admin-ink">
        {children}
      </span>
      {hint ? <span className="mt-0.5 block text-[11px] text-admin-mute">{hint}</span> : null}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  autoFocus
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "url" | "number";
  autoFocus?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className="w-full rounded-md border border-admin-line bg-white px-3 py-2 text-[13px] text-admin-ink placeholder:text-admin-mute focus:border-admin-accent focus:outline-none"
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
  mono = false
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  mono?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={`w-full rounded-md border border-admin-line bg-white px-3 py-2 text-[13px] leading-relaxed text-admin-ink placeholder:text-admin-mute focus:border-admin-accent focus:outline-none ${mono ? "font-mono text-[12.5px]" : ""}`}
    />
  );
}

function Select({
  value,
  onChange,
  options
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-admin-line bg-white px-3 py-2 text-[13px] text-admin-ink focus:border-admin-accent focus:outline-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function StringListField({
  value,
  onChange,
  placeholder
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const arr = Array.isArray(value) ? value : [];
  return (
    <div className="space-y-1.5">
      {arr.map((item, i) => (
        <div key={i} className="flex gap-1.5">
          <TextInput
            value={item}
            onChange={(v) => onChange(arr.map((x, j) => (j === i ? v : x)))}
            placeholder={placeholder}
          />
          <button
            type="button"
            onClick={() => onChange(arr.filter((_, j) => j !== i))}
            className="grid size-9 shrink-0 place-items-center rounded-md border border-admin-line bg-white text-admin-mute hover:border-admin-danger hover:text-admin-danger"
            aria-label="Xoá"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...arr, ""])}
        className="inline-flex items-center gap-1 rounded-md border border-dashed border-admin-line bg-white px-2.5 py-1 text-[12px] font-medium text-admin-ink transition hover:border-admin-accent hover:text-admin-accent"
      >
        <Plus className="size-3" /> Thêm dòng
      </button>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5">{children}</div>;
}

function FieldGrid({ children, cols = 2 }: { children: React.ReactNode; cols?: 1 | 2 | 3 }) {
  const cls = cols === 3 ? "sm:grid-cols-3" : cols === 2 ? "sm:grid-cols-2" : "";
  return <div className={`grid grid-cols-1 gap-3 ${cls}`}>{children}</div>;
}

// ─── Per-type editors ───

function ProseEditor({ block, onChange }: DispatcherProps) {
  const md = typeof block.markdown === "string" ? block.markdown : "";
  return (
    <Row>
      <Label hint="Markdown — **đậm**, *nghiêng*, [link](url), `- bullet`, `## heading`">
        Nội dung đoạn văn
      </Label>
      <TextArea
        value={md}
        onChange={(v) => onChange({ ...block, type: "prose", markdown: v })}
        rows={Math.min(20, Math.max(5, md.split("\n").length + 1))}
        placeholder="Viết nội dung markdown..."
      />
    </Row>
  );
}

function ImageEditor({ block, onChange }: DispatcherProps) {
  const src = typeof block.src === "string" ? block.src : "";
  const alt = typeof block.alt === "string" ? block.alt : "";
  const caption = typeof block.caption === "string" ? block.caption : "";
  const attribution = typeof block.attribution === "string" ? block.attribution : "";
  const attributionUrl = typeof block.attributionUrl === "string" ? block.attributionUrl : "";
  const validSrc = /^https?:\/\//.test(src);
  return (
    <div className="space-y-3">
      <FieldGrid cols={2}>
        <Row>
          <Label hint="Paste URL ảnh từ cellphones, tinhte, shopee...">URL ảnh</Label>
          <TextInput type="url" value={src} onChange={(v) => onChange({ ...block, src: v })} placeholder="https://..." />
        </Row>
        <Row>
          <Label>Alt text (SEO)</Label>
          <TextInput value={alt} onChange={(v) => onChange({ ...block, alt: v })} placeholder="Mô tả ngắn cho SEO" />
        </Row>
      </FieldGrid>
      <Row>
        <Label hint="Hiển thị dưới ảnh ở storefront">Caption</Label>
        <TextInput value={caption} onChange={(v) => onChange({ ...block, caption: v })} placeholder="VD: Cụm camera 200MP của Redmi Turbo 5" />
      </Row>
      <FieldGrid cols={2}>
        <Row>
          <Label>Nguồn (attribution)</Label>
          <TextInput value={attribution} onChange={(v) => onChange({ ...block, attribution: v })} placeholder="VD: tinhte.vn" />
        </Row>
        <Row>
          <Label>Link nguồn (clickable)</Label>
          <TextInput type="url" value={attributionUrl} onChange={(v) => onChange({ ...block, attributionUrl: v })} placeholder="https://tinhte.vn/..." />
        </Row>
      </FieldGrid>
      {validSrc ? (
        <div className="overflow-hidden rounded-md border border-admin-line bg-admin-subtle">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt || caption} className="block max-h-64 w-full object-contain" />
        </div>
      ) : null}
    </div>
  );
}

const CALLOUT_TONES = [
  { value: "info", label: "Thông tin" },
  { value: "warning", label: "Cảnh báo" },
  { value: "tip", label: "Mẹo" },
  { value: "success", label: "Thành công" }
];

function CalloutEditor({ block, onChange }: DispatcherProps) {
  const tone = typeof block.tone === "string" ? block.tone : "info";
  const title = typeof block.title === "string" ? block.title : "";
  const body = typeof block.body === "string" ? block.body : "";
  return (
    <div className="space-y-3">
      <FieldGrid cols={2}>
        <Row>
          <Label>Loại</Label>
          <Select value={tone} onChange={(v) => onChange({ ...block, tone: v })} options={CALLOUT_TONES} />
        </Row>
        <Row>
          <Label>Tiêu đề</Label>
          <TextInput value={title} onChange={(v) => onChange({ ...block, title: v })} placeholder="VD: Lưu ý khi mua online" />
        </Row>
      </FieldGrid>
      <Row>
        <Label hint="≤ 60 từ — ngắn gọn, súc tích">Nội dung callout</Label>
        <TextArea value={body} onChange={(v) => onChange({ ...block, body: v })} rows={3} placeholder="Nội dung..." />
      </Row>
    </div>
  );
}

function ProsConsEditor({ block, onChange }: DispatcherProps) {
  const pros = Array.isArray(block.pros) ? (block.pros as string[]) : [];
  const cons = Array.isArray(block.cons) ? (block.cons as string[]) : [];
  return (
    <FieldGrid cols={2}>
      <Row>
        <Label hint="Mỗi dòng ≤ 15 từ">Ưu điểm</Label>
        <StringListField value={pros} onChange={(v) => onChange({ ...block, pros: v })} placeholder="VD: Pin 5500mAh dùng cả ngày" />
      </Row>
      <Row>
        <Label hint="Có context, không gay gắt">Nhược điểm</Label>
        <StringListField value={cons} onChange={(v) => onChange({ ...block, cons: v })} placeholder="VD: Camera tele yếu hơn flagship" />
      </Row>
    </FieldGrid>
  );
}

function VerdictEditor({ block, onChange }: DispatcherProps) {
  const summary = typeof block.summary === "string" ? block.summary : "";
  const bestFor = Array.isArray(block.bestFor) ? (block.bestFor as string[]) : [];
  const notFor = Array.isArray(block.notFor) ? (block.notFor as string[]) : [];
  return (
    <div className="space-y-3">
      <Row>
        <Label hint='Nghiêng "đáng mua nếu..." — KHÔNG lửng lơ "tùy bạn"'>Kết luận (2-3 câu)</Label>
        <TextArea value={summary} onChange={(v) => onChange({ ...block, summary: v })} rows={3} placeholder="VD: Redmi Turbo 5 là lựa chọn tốt nhất tầm 8 triệu cho game thủ casual..." />
      </Row>
      <FieldGrid cols={2}>
        <Row>
          <Label>Nên mua nếu bạn...</Label>
          <StringListField value={bestFor} onChange={(v) => onChange({ ...block, bestFor: v })} placeholder="VD: Cần pin trâu chơi game cấu hình cao" />
        </Row>
        <Row>
          <Label>Cân nhắc nếu...</Label>
          <StringListField value={notFor} onChange={(v) => onChange({ ...block, notFor: v })} placeholder="VD: Ưu tiên camera chân dung đỉnh" />
        </Row>
      </FieldGrid>
    </div>
  );
}

function FaqEditor({ block, onChange }: DispatcherProps) {
  const items = Array.isArray(block.items)
    ? (block.items as Array<{ q?: string; a?: string }>)
    : [];

  const update = (idx: number, patch: { q?: string; a?: string }) => {
    onChange({
      ...block,
      items: items.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    });
  };
  const remove = (idx: number) => {
    onChange({ ...block, items: items.filter((_, i) => i !== idx) });
  };
  const add = () => {
    onChange({ ...block, items: [...items, { q: "", a: "" }] });
  };

  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i} className="rounded-md border border-admin-line bg-white p-3">
          <div className="flex items-center gap-2">
            <span className="rounded bg-admin-subtle px-2 py-0.5 text-[11px] font-bold text-admin-ink">
              Q{i + 1}
            </span>
            <input
              type="text"
              value={it.q ?? ""}
              onChange={(e) => update(i, { q: e.target.value })}
              placeholder="Câu hỏi..."
              className="flex-1 rounded-md border border-admin-line bg-white px-2.5 py-1.5 text-[13px] font-semibold text-admin-ink placeholder:text-admin-mute focus:border-admin-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="grid size-7 place-items-center rounded text-admin-mute hover:bg-admin-danger-soft hover:text-admin-danger"
              aria-label="Xoá câu hỏi"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <textarea
            value={it.a ?? ""}
            onChange={(e) => update(i, { a: e.target.value })}
            placeholder="Câu trả lời (2-3 câu)"
            rows={2}
            className="mt-2 w-full rounded-md border border-admin-line bg-white px-2.5 py-1.5 text-[13px] leading-relaxed text-admin-ink placeholder:text-admin-mute focus:border-admin-accent focus:outline-none"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1 rounded-md border border-dashed border-admin-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-admin-ink transition hover:border-admin-accent hover:text-admin-accent"
      >
        <Plus className="size-3.5" /> Thêm câu hỏi
      </button>
    </div>
  );
}

function HeroQuoteEditor({ block, onChange }: DispatcherProps) {
  const text = typeof block.text === "string" ? block.text : "";
  const attribution = typeof block.attribution === "string" ? block.attribution : "";
  return (
    <div className="space-y-3">
      <Row>
        <Label hint="Câu mở bài mạnh, ≤ 50 từ">Câu quote</Label>
        <TextArea value={text} onChange={(v) => onChange({ ...block, text: v })} rows={2} placeholder='VD: "Pin 5500mAh chơi game 8 tiếng không lo hết"' />
      </Row>
      <Row>
        <Label>Người nói (optional)</Label>
        <TextInput value={attribution} onChange={(v) => onChange({ ...block, attribution: v })} placeholder="VD: Reviewer Tinhte" />
      </Row>
    </div>
  );
}

function ReviewQuoteEditor({ block, onChange }: DispatcherProps) {
  const body = typeof block.body === "string" ? block.body : "";
  const author = typeof block.author === "string" ? block.author : "";
  const rating = typeof block.rating === "number" ? block.rating : "";
  const sourceUrl = typeof block.sourceUrl === "string" ? block.sourceUrl : "";
  const sourceName = typeof block.sourceName === "string" ? block.sourceName : "";
  const verifiedBuyer = block.verifiedBuyer === true;
  return (
    <div className="space-y-3">
      <Row>
        <Label hint="Trích nguyên văn, không bịa">Nội dung review</Label>
        <TextArea value={body} onChange={(v) => onChange({ ...block, body: v })} rows={3} placeholder="VD: Pin trâu thực sự, mình dùng 2 ngày không sạc..." />
      </Row>
      <FieldGrid cols={3}>
        <Row>
          <Label>Người review</Label>
          <TextInput value={author} onChange={(v) => onChange({ ...block, author: v })} placeholder="Tên / nickname" />
        </Row>
        <Row>
          <Label hint="0-5">Rating</Label>
          <TextInput
            type="number"
            value={String(rating)}
            onChange={(v) => onChange({ ...block, rating: v === "" ? undefined : Number(v) })}
            placeholder="4.5"
          />
        </Row>
        <Row>
          <Label>Nguồn (tên)</Label>
          <TextInput value={sourceName} onChange={(v) => onChange({ ...block, sourceName: v })} placeholder="VD: shopee.vn" />
        </Row>
      </FieldGrid>
      <Row>
        <Label>Link nguồn</Label>
        <TextInput type="url" value={sourceUrl} onChange={(v) => onChange({ ...block, sourceUrl: v })} placeholder="https://..." />
      </Row>
      <label className="flex items-center gap-2 text-[13px] text-admin-ink">
        <input
          type="checkbox"
          checked={verifiedBuyer}
          onChange={(e) => onChange({ ...block, verifiedBuyer: e.target.checked })}
          className="size-4 rounded border-admin-line accent-admin-accent"
        />
        <span className="font-semibold">Người mua đã xác thực</span>
      </label>
    </div>
  );
}

function CitationEditor({ block, onChange }: DispatcherProps) {
  const claim = typeof block.claim === "string" ? block.claim : "";
  const sourceUrl = typeof block.sourceUrl === "string" ? block.sourceUrl : "";
  const sourceTitle = typeof block.sourceTitle === "string" ? block.sourceTitle : "";
  const fetchedAt = typeof block.fetchedAt === "string" ? block.fetchedAt : "";
  return (
    <div className="space-y-3">
      <Row>
        <Label>Tuyên bố (claim)</Label>
        <TextArea value={claim} onChange={(v) => onChange({ ...block, claim: v })} rows={2} placeholder="VD: Pin Redmi Turbo 5 là 5500mAh" />
      </Row>
      <FieldGrid cols={2}>
        <Row>
          <Label>Tên nguồn</Label>
          <TextInput value={sourceTitle} onChange={(v) => onChange({ ...block, sourceTitle: v })} placeholder="VD: Redmi official spec" />
        </Row>
        <Row>
          <Label>Link nguồn</Label>
          <TextInput type="url" value={sourceUrl} onChange={(v) => onChange({ ...block, sourceUrl: v })} placeholder="https://..." />
        </Row>
      </FieldGrid>
      <Row>
        <Label>Ngày fetch (YYYY-MM-DD)</Label>
        <TextInput value={fetchedAt} onChange={(v) => onChange({ ...block, fetchedAt: v })} placeholder="2026-05-20" />
      </Row>
    </div>
  );
}

function CriteriaGridEditor({ block, onChange }: DispatcherProps) {
  const title = typeof block.title === "string" ? block.title : "";
  const items = Array.isArray(block.items)
    ? (block.items as Array<{ icon?: string; title?: string; body?: string }>)
    : [];

  const update = (idx: number, patch: Partial<{ icon: string; title: string; body: string }>) => {
    onChange({
      ...block,
      items: items.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    });
  };
  const remove = (idx: number) => {
    onChange({ ...block, items: items.filter((_, i) => i !== idx) });
  };
  const add = () => {
    onChange({ ...block, items: [...items, { icon: "sparkle", title: "", body: "" }] });
  };

  return (
    <div className="space-y-3">
      <Row>
        <Label>Tiêu đề bảng (optional)</Label>
        <TextInput value={title} onChange={(v) => onChange({ ...block, title: v })} placeholder="VD: Tiêu chí chọn mua robot hút bụi" />
      </Row>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="rounded-md border border-admin-line bg-white p-3">
            <div className="flex items-center gap-2">
              <span className="rounded bg-admin-subtle px-2 py-0.5 text-[11px] font-bold text-admin-ink">
                #{i + 1}
              </span>
              <input
                type="text"
                value={it.icon ?? ""}
                onChange={(e) => update(i, { icon: e.target.value })}
                placeholder="icon (battery/filter/noise/smart/money/shield/clock/wifi/sparkle)"
                className="w-44 rounded-md border border-admin-line bg-white px-2.5 py-1.5 text-[12.5px] text-admin-ink placeholder:text-admin-mute focus:border-admin-accent focus:outline-none"
              />
              <input
                type="text"
                value={it.title ?? ""}
                onChange={(e) => update(i, { title: e.target.value })}
                placeholder="Tiêu đề tiêu chí"
                className="flex-1 rounded-md border border-admin-line bg-white px-2.5 py-1.5 text-[13px] font-semibold text-admin-ink placeholder:text-admin-mute focus:border-admin-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                className="grid size-7 place-items-center rounded text-admin-mute hover:bg-admin-danger-soft hover:text-admin-danger"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <textarea
              value={it.body ?? ""}
              onChange={(e) => update(i, { body: e.target.value })}
              placeholder="Body ≤ 40 từ"
              rows={2}
              className="mt-2 w-full rounded-md border border-admin-line bg-white px-2.5 py-1.5 text-[13px] leading-relaxed text-admin-ink placeholder:text-admin-mute focus:border-admin-accent focus:outline-none"
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1 rounded-md border border-dashed border-admin-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-admin-ink transition hover:border-admin-accent hover:text-admin-accent"
      >
        <Plus className="size-3.5" /> Thêm tiêu chí
      </button>
    </div>
  );
}

function ProductSlotReadOnly({ block }: { block: AnyBlock }) {
  const slotKey = typeof block.slotKey === "string" ? block.slotKey : "";
  const hint = typeof block.hint === "string" ? block.hint : "";
  const productId = typeof block.productId === "string" ? block.productId : "";
  return (
    <div className="rounded-md border border-primary-200 bg-primary-50/40 p-3">
      <div className="flex items-start gap-2">
        <ShoppingBag className="size-4 text-primary-600" />
        <div className="flex-1 min-w-0 space-y-1.5 text-[13px]">
          <div>
            <span className="font-bold text-admin-ink">Slot:</span>{" "}
            <span className="font-mono text-admin-ink">{slotKey || "(chưa có key)"}</span>
          </div>
          {hint ? (
            <div>
              <span className="font-bold text-admin-ink">AI gợi ý:</span>{" "}
              <span className="text-admin-ink">{hint}</span>
            </div>
          ) : null}
          <div>
            <span className="font-bold text-admin-ink">Sản phẩm gắn:</span>{" "}
            {productId ? (
              <span className="rounded bg-admin-success-soft px-1.5 py-0.5 font-mono text-[11.5px] text-admin-success">
                {productId.slice(0, 8)}…
              </span>
            ) : (
              <span className="rounded bg-admin-warning-soft px-1.5 py-0.5 text-[11.5px] font-medium text-admin-warning">
                Chưa gắn
              </span>
            )}
          </div>
          <p className="text-[11.5px] text-admin-mute">
            Mở tab <strong>Gắn sản phẩm</strong> để chọn / đổi product cho slot này.
          </p>
        </div>
      </div>
    </div>
  );
}

function ProductSpotlightReadOnly({ block }: { block: AnyBlock }) {
  const productId = typeof block.productId === "string" ? block.productId : "";
  const angle = typeof block.angle === "string" ? block.angle : "";
  return (
    <div className="rounded-md border border-admin-line bg-admin-surface p-3">
      <div className="flex items-start gap-2">
        <Info className="size-4 text-admin-info" />
        <div className="flex-1 min-w-0 space-y-1 text-[13px]">
          <div>
            <span className="font-bold text-admin-ink">Spotlight product:</span>{" "}
            <span className="font-mono text-admin-ink">{productId || "(chưa có ID)"}</span>
          </div>
          {angle ? (
            <div>
              <span className="font-bold text-admin-ink">Góc nhìn:</span>{" "}
              <span className="text-admin-ink">{angle}</span>
            </div>
          ) : null}
          <p className="text-[11.5px] text-admin-mute">
            Block này cần product trong DB. Quản lý qua tab Gắn sản phẩm (chỉnh productId / pros / cons qua JSON nếu cần).
          </p>
        </div>
      </div>
    </div>
  );
}

function ComparisonReadOnly({ block }: { block: AnyBlock }) {
  const ids = Array.isArray(block.productIds) ? (block.productIds as string[]) : [];
  return (
    <div className="rounded-md border border-admin-line bg-admin-surface p-3">
      <div className="flex items-start gap-2">
        <Info className="size-4 text-admin-info" />
        <div className="flex-1 min-w-0 space-y-1 text-[13px]">
          <div>
            <span className="font-bold text-admin-ink">So sánh {ids.length} sản phẩm:</span>{" "}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ids.map((id) => (
              <span key={id} className="rounded bg-admin-subtle px-1.5 py-0.5 font-mono text-[11px] text-admin-ink">
                {id.slice(0, 8)}…
              </span>
            ))}
            {ids.length === 0 ? (
              <span className="text-admin-mute">(chưa chọn product)</span>
            ) : null}
          </div>
          <p className="text-[11.5px] text-admin-mute">
            Quản lý product qua tab Gắn sản phẩm.
          </p>
        </div>
      </div>
    </div>
  );
}

function JsonFallback({ block, onChange }: DispatcherProps) {
  const [open, setOpen] = useState(false);
  const [jsonText, setJsonText] = useState(() => JSON.stringify(block, null, 2));
  const [err, setErr] = useState<string | null>(null);

  const apply = (txt: string) => {
    setJsonText(txt);
    try {
      const parsed = JSON.parse(txt);
      if (!parsed || typeof parsed !== "object" || typeof parsed.type !== "string") {
        throw new Error('Block phải có field "type" (string)');
      }
      setErr(null);
      onChange(parsed);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50/40 p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-[12.5px] font-semibold text-admin-ink"
      >
        <Code className="size-3.5" /> Block dạng <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11.5px]">{block.type}</code>{" "}
        — chưa có UI form, sửa JSON
        {open ? <ChevronUp className="ml-auto size-3.5" /> : <ChevronDown className="ml-auto size-3.5" />}
      </button>
      {open ? (
        <div className="mt-2">
          <textarea
            value={jsonText}
            onChange={(e) => apply(e.target.value)}
            rows={Math.min(20, Math.max(6, jsonText.split("\n").length + 1))}
            className={`w-full rounded-md border bg-white px-3 py-2 font-mono text-[11.5px] leading-relaxed text-admin-ink focus:outline-none ${err ? "border-admin-danger" : "border-admin-line focus:border-admin-accent"}`}
          />
          {err ? <p className="mt-1 text-[11px] text-admin-danger">JSON lỗi: {err}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
