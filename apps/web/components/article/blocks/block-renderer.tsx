import type React from "react";
import type { ArticleBlock, ProductItem } from "../../../lib/types";
import { HeroQuoteBlock } from "./hero-quote";
import { CriteriaGridBlock } from "./criteria-grid";
import { ProductSpotlightBlock } from "./product-spotlight";
import { CalloutBlock } from "./callout";
import { ProseBlock } from "./prose";
import { ComparisonBlock } from "./comparison";
import { ProsConsBlock } from "./pros-cons";
import { FaqBlock } from "./faq";
import { VerdictBlock } from "./verdict";
import { ImageBlock } from "./image";
import { ReviewQuoteBlock } from "./review-quote";
import { ProductSlotBlock } from "./product-slot";

interface Props {
  blocks: ArticleBlock[];
  products: ProductItem[];
  schemaConfig?: Record<string, unknown>;
}

export function BlockRenderer({ blocks, products, schemaConfig }: Props): React.ReactElement {
  // Guard: AI/DB có thể trả blocks null hoặc product missing → tránh crash render.
  const safeBlocks = Array.isArray(blocks) ? blocks : [];
  const safeProducts = Array.isArray(products) ? products : [];
  const productMap = new Map(safeProducts.map((p) => [p.id, p]));

  // Index của prose block đầu tiên → render dạng "lead-in" (font 18.5px, medium weight)
  // để dẫn mắt vào section. Pattern editorial NYT/cellphones — đoạn mở luôn nổi hơn body.
  const firstProseIdx = safeBlocks.findIndex(
    (b) => b && typeof b === "object" && (b as ArticleBlock).type === "prose"
  );

  return (
    <div className="space-y-8">
      {safeBlocks.map((block, i) => {
        if (!block || typeof block !== "object") return null;
        return (
          <BlockSwitch
            key={i}
            block={block}
            productMap={productMap}
            schemaConfig={schemaConfig}
            isLeadProse={i === firstProseIdx}
          />
        );
      })}
    </div>
  );
}

function BlockSwitch({
  block,
  productMap,
  schemaConfig,
  isLeadProse
}: {
  block: ArticleBlock;
  productMap: Map<string, ProductItem>;
  schemaConfig?: Record<string, unknown>;
  isLeadProse?: boolean;
}): React.ReactElement | null {
  // AI có thể trả block thiếu field. Mọi access vào array đều dùng ?? [] để khỏi crash.
  // Quy tắc: AI hay sinh block với field rỗng → đừng render UI trống tuếch.
  // Mỗi case dưới đây bỏ qua sớm nếu data không đủ ý nghĩa.
  switch (block.type) {
    case "hero_quote": {
      const text = block.text ?? "";
      if (!text.trim()) return null;
      return <HeroQuoteBlock text={text} attribution={block.attribution} />;
    }
    case "criteria_grid": {
      const items = block.items ?? [];
      if (items.length === 0) return null;
      return <CriteriaGridBlock title={block.title ?? ""} items={items} />;
    }
    case "product_spotlight": {
      if (!block.productId) return renderFallback(block);
      const product = productMap.get(block.productId);
      if (!product) return null;
      return (
        <ProductSpotlightBlock
          product={product}
          angle={block.angle ?? ""}
          pros={block.pros ?? []}
          cons={block.cons ?? []}
          imageUrl={block.imageUrl}
        />
      );
    }
    case "callout":
      return <CalloutBlock tone={block.tone} title={block.title ?? ""} body={block.body ?? ""} />;
    case "prose": {
      const md = block.markdown ?? "";
      if (!md.trim()) return null;
      return <ProseBlock markdown={md} lead={isLeadProse} />;
    }
    case "comparison": {
      const ids = Array.isArray(block.productIds) ? block.productIds : [];
      const ps = ids.map((id) => productMap.get(id)).filter((p): p is ProductItem => Boolean(p));
      if (ps.length < 2) return null;
      return <ComparisonBlock products={ps} schemaConfig={schemaConfig} />;
    }
    case "pros_cons": {
      const pros = block.pros ?? [];
      const cons = block.cons ?? [];
      if (pros.length === 0 && cons.length === 0) return null;
      return <ProsConsBlock pros={pros} cons={cons} />;
    }
    case "faq": {
      const items = block.items ?? [];
      if (items.length === 0) return null;
      return <FaqBlock items={items} />;
    }
    case "verdict": {
      const summary = block.summary ?? "";
      const bestFor = block.bestFor ?? [];
      const notFor = block.notFor ?? [];
      if (!summary.trim() && bestFor.length === 0 && notFor.length === 0) return null;
      return <VerdictBlock summary={summary} bestFor={bestFor} notFor={notFor} />;
    }
    case "image": {
      const b = block as unknown as {
        src?: string;
        alt?: string;
        caption?: string;
        attribution?: string;
        attributionUrl?: string;
        width?: number;
        height?: number;
      };
      if (!b.src) return null;
      return (
        <ImageBlock
          src={b.src}
          alt={b.alt}
          caption={b.caption}
          attribution={b.attribution}
          attributionUrl={b.attributionUrl}
          width={b.width}
          height={b.height}
        />
      );
    }
    case "product_slot": {
      // Slot AI sinh khi viết bài — chỉ render khi admin đã gắn product.
      // Slot chưa gắn → ẩn hoàn toàn (không hiển thị placeholder rác cho user).
      const b = block as unknown as { productId?: string; angle?: string };
      if (!b.productId) return null;
      const product = productMap.get(b.productId);
      if (!product) return null;
      return <ProductSlotBlock product={product} angle={b.angle} />;
    }
    case "review_quote": {
      const b = block as unknown as {
        body?: string;
        author?: string;
        rating?: number;
        sourceUrl?: string;
        sourceName?: string;
        verifiedBuyer?: boolean;
      };
      if (!b.body || !b.body.trim()) return null;
      return (
        <ReviewQuoteBlock
          body={b.body}
          author={b.author}
          rating={b.rating}
          sourceUrl={b.sourceUrl}
          sourceName={b.sourceName}
          verifiedBuyer={b.verifiedBuyer}
        />
      );
    }
    default:
      return renderFallback(block);
  }
}

/**
 * AI writer có thể sinh block type ngoài 9 type chính (vd "image", "citation", "review_quote",
 * "image_gallery", "price_history", "section_tldr"). Render text-only fallback để không crash trang.
 * Phase sau implement components cho từng type nếu cần.
 */
function renderFallback(block: ArticleBlock): React.ReactElement | null {
  const raw = block as unknown as Record<string, unknown>;
  const text =
    pickString(raw, ["markdown", "body", "text", "summary", "claim", "title"]) ?? null;
  if (!text) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-sm">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
        {String(raw.type ?? "block")}
      </div>
      <p className="leading-relaxed text-ink-soft">{text}</p>
    </div>
  );
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return undefined;
}
