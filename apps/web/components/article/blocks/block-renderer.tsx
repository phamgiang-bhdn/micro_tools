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
  const productMap = new Map(products.map((p) => [p.id, p]));

  return (
    <div className="space-y-10">
      {blocks.map((block, i) => (
        <BlockSwitch
          key={i}
          block={block}
          productMap={productMap}
          schemaConfig={schemaConfig}
        />
      ))}
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
  switch (block.type) {
    case "hero_quote":
      return <HeroQuoteBlock text={block.text} attribution={block.attribution} />;
    case "criteria_grid":
      return <CriteriaGridBlock title={block.title} items={block.items} />;
    case "product_spotlight": {
      const product = productMap.get(block.productId);
      if (!product) return null;
      return (
        <ProductSpotlightBlock
          product={product}
          angle={block.angle}
          pros={block.pros}
          cons={block.cons}
          imageUrl={block.imageUrl}
        />
      );
    }
    case "callout":
      return <CalloutBlock tone={block.tone} title={block.title} body={block.body} />;
    case "prose":
      return <ProseBlock markdown={block.markdown} />;
    case "comparison": {
      const ps = block.productIds.map((id) => productMap.get(id)).filter((p): p is ProductItem => Boolean(p));
      if (ps.length < 2) return null;
      return <ComparisonBlock products={ps} schemaConfig={schemaConfig} />;
    }
    case "pros_cons":
      return <ProsConsBlock pros={block.pros} cons={block.cons} />;
    case "faq":
      return <FaqBlock items={block.items} />;
    case "verdict":
      return <VerdictBlock summary={block.summary} bestFor={block.bestFor} notFor={block.notFor} />;
  }
}
