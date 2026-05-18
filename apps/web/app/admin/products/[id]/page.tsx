import type React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import {
  adminGet,
  AdminLinkButton,
  NetworkBadge,
  PageHeader,
  StatusPill
} from "../../../../components/admin/ui";
import { type AffiliateNetwork } from "../../../../lib/admin/constants";
import { ProductEditForm } from "./edit-form";

export const dynamic = "force-dynamic";

interface ProductDetail {
  id: string;
  name: string;
  slug: string | null;
  network: AffiliateNetwork;
  isPublic: boolean;
  affiliateUrl: string;
  scrapedData: Record<string, unknown>;
  niche: { id: string; slug: string; name: string };
}

interface NicheLite {
  id: string;
  slug: string;
  name: string;
}

async function safeAdminGet<T>(path: string): Promise<T | null> {
  try {
    return await adminGet<T>(path);
  } catch (err) {
    if (err instanceof Error && /not found|404/i.test(err.message)) return null;
    throw err;
  }
}

export default async function ProductEditPage({
  params
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  const [product, niches] = await Promise.all([
    safeAdminGet<ProductDetail>(`/admin/products/${id}`),
    adminGet<NicheLite[]>("/admin/niches")
  ]);
  if (!product) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-1 text-xs text-admin-mute hover:text-admin-ink"
      >
        <ArrowLeft className="size-3" /> Tất cả sản phẩm
      </Link>
      <PageHeader
        eyebrow="Sửa sản phẩm"
        title={product.name}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <NetworkBadge network={product.network} />
            {product.isPublic ? (
              <StatusPill tone="success" dot>
                Hiển thị public
              </StatusPill>
            ) : (
              <StatusPill tone="neutral" dot>
                Đang ẩn
              </StatusPill>
            )}
            <span className="text-admin-mute">Niche: {product.niche.name}</span>
          </span>
        }
        actions={
          product.isPublic && product.slug ? (
            <AdminLinkButton
              href={`/categories/${product.niche.slug}/${product.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              variant="outline"
              size="md"
              iconRight={<ExternalLink />}
            >
              Xem storefront
            </AdminLinkButton>
          ) : null
        }
      />
      <ProductEditForm product={product} niches={niches} />
    </div>
  );
}
