import type React from "react";
import type { ProductItem } from "../../../lib/types";
import { ComparisonTable } from "../comparison-table";

interface Props {
  products: ProductItem[];
  schemaConfig?: Record<string, unknown>;
}

export function ComparisonBlock({ products, schemaConfig }: Props): React.ReactElement {
  return <ComparisonTable products={products} schemaConfig={schemaConfig} />;
}
