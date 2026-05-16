import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetailView } from "../../../../components/product-detail-view";
import type { ProductItem } from "../../../../lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Refinery preview",
  robots: { index: false, follow: false }
};

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api/v1";
const ADMIN_ROLE = process.env.ADMIN_ROLE ?? "admin";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY ?? "change-me";

interface ExtractionResponse {
  id: string;
  aiOutput: Record<string, unknown> | null;
  product: {
    id: string;
    categoryId: string;
    network: string;
    name: string;
    slug: string | null;
    affiliateUrl: string;
    scrapedData: Record<string, unknown>;
    category: { name: string; slug: string };
  };
}

async function fetchExtraction(id: string): Promise<ExtractionResponse | null> {
  const response = await fetch(`${API_BASE_URL}/admin/refinery/${id}`, {
    cache: "no-store",
    headers: {
      "x-admin-role": ADMIN_ROLE,
      "x-admin-key": ADMIN_API_KEY
    }
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to fetch extraction: ${await response.text()}`);
  }
  return (await response.json()) as ExtractionResponse;
}

interface PreviewPageProps {
  params: Promise<{ extractionId: string }>;
}

export default async function ExtractionPreviewPage({
  params
}: PreviewPageProps): Promise<React.ReactElement> {
  const { extractionId } = await params;
  const extraction = await fetchExtraction(extractionId);
  if (!extraction) notFound();

  // Hợp nhất aiOutput (đang chờ duyệt) vào scrapedData (đã publish).
  // aiOutput override scrapedData — chính là layout sẽ thấy sau khi Approve.
  const mergedScrapedData: Record<string, unknown> = {
    ...extraction.product.scrapedData,
    ...(extraction.aiOutput ?? {})
  };

  const productRaw: ProductItem = {
    id: extraction.product.id,
    categoryId: extraction.product.categoryId,
    network: extraction.product.network,
    name: extraction.product.name,
    slug: extraction.product.slug,
    affiliateUrl: extraction.product.affiliateUrl,
    scrapedData: mergedScrapedData
  };

  return (
    <div className="mx-auto max-w-5xl">
      <ProductDetailView
        productRaw={productRaw}
        category={extraction.product.category}
        previewMode
      />
    </div>
  );
}
