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

  return (
    <div className="space-y-10">
      {safeBlocks.map((block, i) => {
        if (!block || typeof block !== "object") return null;
        return (
          <BlockSwitch
            key={i}
            block={block}
            productMap={productMap}
            schemaConfig={schemaConfig}
          />
        );
      })}
    </div>
  );
}

function BlockSwitch({
  block,
  productMap,
  schemaConfig
}: {
  block: ArticleBlock;
  productMap: Map<string, ProductItem>;
  schemaConfig?: Record<string, unknown>;
}): React.ReactElement | null {
  // AI có thể trả block thiếu field. Mọi access vào array đều dùng ?? [] để khỏi crash.
  switch (block.type) {
    case "hero_quote":
      return <HeroQuoteBlock text={block.text ?? ""} attribution={block.attribution} />;
    case "criteria_grid":
      return <CriteriaGridBlock title={block.title ?? ""} items={block.items ?? []} />;
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
    case "prose":
      return <ProseBlock markdown={block.markdown ?? ""} />;
    case "comparison": {
      const ids = Array.isArray(block.productIds) ? block.productIds : [];
      const ps = ids.map((id) => productMap.get(id)).filter((p): p is ProductItem => Boolean(p));
      if (ps.length < 2) return null;
      return <ComparisonBlock products={ps} schemaConfig={schemaConfig} />;
    }
    case "pros_cons":
      return <ProsConsBlock pros={block.pros ?? []} cons={block.cons ?? []} />;
    case "faq":
      return <FaqBlock items={block.items ?? []} />;
    case "verdict":
      return (
        <VerdictBlock
          summary={block.summary ?? ""}
          bestFor={block.bestFor ?? []}
          notFor={block.notFor ?? []}
        />
      );
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
