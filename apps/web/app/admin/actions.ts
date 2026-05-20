"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api/v1";
const ADMIN_ROLE = process.env.ADMIN_ROLE ?? "admin";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY ?? "change-me";

async function adminFetch<T = unknown>(
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-admin-role": ADMIN_ROLE,
      "x-admin-key": ADMIN_API_KEY
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed ${path}: ${text}`);
  }
  if (response.status === 204) return undefined as T;
  const ct = response.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) return undefined as T;
  return (await response.json()) as T;
}

async function post(path: string, body: Record<string, unknown> = {}): Promise<void> {
  await adminFetch(path, "POST", body);
}

export async function approveExtractionAction(formData: FormData): Promise<void> {
  const extractionId = String(formData.get("extractionId") ?? "");
  const reviewer = String(formData.get("reviewer") ?? "admin");
  const aiOutputText = String(formData.get("aiOutput") ?? "{}");
  const aiOutput = JSON.parse(aiOutputText) as Record<string, unknown>;
  await post(`/admin/refinery/${extractionId}/approve`, { reviewer, aiOutput });
  revalidatePath("/admin");
}

export async function rejectExtractionAction(formData: FormData): Promise<void> {
  const extractionId = String(formData.get("extractionId") ?? "");
  const reviewer = String(formData.get("reviewer") ?? "admin");
  const reason = String(formData.get("reason") ?? "Rejected by reviewer");
  await post(`/admin/refinery/${extractionId}/reject`, { reviewer, reason });
  revalidatePath("/admin");
}

export async function retryExtractionAction(formData: FormData): Promise<void> {
  const extractionId = String(formData.get("extractionId") ?? "");
  await post(`/admin/refinery/${extractionId}/retry`, {});
  revalidatePath("/admin");
}

export async function savePromptAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "");
  const content = String(formData.get("content") ?? "");
  const createdBy = String(formData.get("createdBy") ?? "admin");
  const activateNow = String(formData.get("activateNow") ?? "") === "on";
  await post("/admin/prompts/save", { name, content, createdBy, activateNow });
  revalidatePath("/admin");
}

// ───────── Articles ─────────

export async function generateArticleAction(formData: FormData): Promise<void> {
  const type = String(formData.get("type") ?? "BUYING_GUIDE");
  const topic = String(formData.get("topic") ?? "").trim();
  const nicheId = String(formData.get("nicheId") ?? "") || undefined;
  const pinnedProductIdsRaw = formData.getAll("pinnedProductIds");
  const pinnedProductIds = pinnedProductIdsRaw.map((v) => String(v)).filter(Boolean);
  const productRef = String(formData.get("productRef") ?? "").trim() || undefined;
  const pauseAtOutline = formData.get("pauseAtOutline") === "on" || formData.get("pauseAtOutline") === "true";

  if (!topic || topic.length < 5) {
    throw new Error("Vui lòng nhập chủ đề (≥ 5 ký tự).");
  }
  if (type === "BUYING_GUIDE" && !nicheId) {
    throw new Error("Cẩm nang chọn mua cần chọn 1 niche.");
  }
  if (type === "REVIEW" && !productRef) {
    throw new Error("Review cần nhập tên / slug / URL sản phẩm.");
  }

  const created = (await adminFetch<{ id: string }>("/admin/articles/generate", "POST", {
    type,
    topic,
    nicheId,
    pinnedProductIds,
    productRef,
    pauseAtOutline
  }));

  revalidatePath("/admin/articles");
  redirect(`/admin/articles/${created.id}`);
}

export async function updateArticleAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing article id");
  const productIdsRaw = formData.getAll("productIds");
  const body: Record<string, unknown> = {
    title: String(formData.get("title") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    excerpt: String(formData.get("excerpt") ?? ""),
    body: String(formData.get("body") ?? ""),
    metaTitle: String(formData.get("metaTitle") ?? ""),
    metaDescription: String(formData.get("metaDescription") ?? ""),
    productIds: productIdsRaw.map((v) => String(v)).filter(Boolean)
  };
  const nicheIdRaw = String(formData.get("nicheId") ?? "");
  if (nicheIdRaw) body.nicheId = nicheIdRaw;

  await adminFetch(`/admin/articles/${id}`, "PUT", body);
  revalidatePath(`/admin/articles/${id}`);
  revalidatePath("/admin/articles");
}

export async function publishArticleAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const reviewer = String(formData.get("reviewer") ?? "admin");
  if (!id) throw new Error("Missing article id");
  await post(`/admin/articles/${id}/publish`, { reviewer });
  revalidatePath("/admin/articles");
  revalidatePath(`/admin/articles/${id}`);
  revalidatePath("/blog");
}

export async function archiveArticleAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const reviewer = String(formData.get("reviewer") ?? "admin");
  if (!id) throw new Error("Missing article id");
  await post(`/admin/articles/${id}/archive`, { reviewer });
  revalidatePath("/admin/articles");
  revalidatePath(`/admin/articles/${id}`);
}

// ───────── Article V2 pipeline ─────────

export async function retryArticleStageAction(articleId: string, stage: string): Promise<void> {
  await post(`/admin/articles/${articleId}/retry-stage`, { stage });
  revalidatePath(`/admin/articles/${articleId}`);
}

export async function refreshArticleEvidenceAction(articleId: string): Promise<void> {
  await post(`/admin/articles/${articleId}/refresh-evidence`, {});
  revalidatePath(`/admin/articles/${articleId}`);
}

export async function continueArticlePipelineAction(articleId: string): Promise<void> {
  await post(`/admin/articles/${articleId}/continue-pipeline`, {});
  revalidatePath(`/admin/articles/${articleId}`);
}

export async function requestArticleRevisionAction(articleId: string, reason: string, reviewer = "admin"): Promise<void> {
  await post(`/admin/articles/${articleId}/request-revision`, { reason, reviewer });
  revalidatePath(`/admin/articles/${articleId}`);
}

export async function approveArticleV2Action(articleId: string, reviewer = "admin"): Promise<void> {
  await post(`/admin/articles/${articleId}/publish`, { reviewer });
  revalidatePath("/admin/articles");
  revalidatePath(`/admin/articles/${articleId}`);
  revalidatePath("/blog");
}

export async function updateSectionAction(
  articleId: string,
  sectionId: string,
  patch: { heading?: string; summary?: string; blocks?: unknown; status?: string; evidenceRefs?: string[] }
): Promise<void> {
  await adminFetch(`/admin/articles/${articleId}/sections/${sectionId}`, "PUT", patch);
  revalidatePath(`/admin/articles/${articleId}`);
}

export async function deleteSectionAction(articleId: string, sectionId: string): Promise<void> {
  await adminFetch(`/admin/articles/${articleId}/sections/${sectionId}`, "DELETE");
  revalidatePath(`/admin/articles/${articleId}`);
}

export async function reorderSectionsAction(articleId: string, orderedIds: string[]): Promise<void> {
  await adminFetch(`/admin/articles/${articleId}/sections-order`, "PUT", { orderedIds });
  revalidatePath(`/admin/articles/${articleId}`);
}

// ──────── Product Slot Matcher ────────

export interface ArticleSlotDto {
  sectionId: string;
  sectionOrder: number;
  sectionHeading: string;
  slotKey: string;
  hint: string;
  angle?: string;
  productId?: string;
}

export interface SlotProductDto {
  id: string;
  name: string;
  slug: string | null;
  scrapedData: Record<string, unknown>;
  affiliateUrl: string;
  isPublic: boolean;
}

export async function listArticleSlotsAction(
  articleId: string
): Promise<{ slots: ArticleSlotDto[]; assignedProducts: SlotProductDto[] }> {
  const res = await fetch(`${API_BASE_URL}/admin/articles/${articleId}/slots`, {
    method: "GET",
    headers: { "x-admin-role": ADMIN_ROLE, "x-admin-key": ADMIN_API_KEY },
    cache: "no-store"
  });
  if (!res.ok) throw new Error(`listArticleSlots failed: ${await res.text()}`);
  return (await res.json()) as { slots: ArticleSlotDto[]; assignedProducts: SlotProductDto[] };
}

export async function assignArticleSlotAction(
  articleId: string,
  sectionId: string,
  slotKey: string,
  productId: string | null
): Promise<void> {
  await post(`/admin/articles/${articleId}/slots/assign`, { sectionId, slotKey, productId });
  revalidatePath(`/admin/articles/${articleId}`);
  revalidatePath(`/blog/[slug]`, "page");
}

export interface SlotProductSearchHit {
  id: string;
  name: string;
  slug: string | null;
  isPublic: boolean;
  scrapedData: Record<string, unknown>;
  affiliateUrl: string;
  niche: { id: string; slug: string; name: string } | null;
}

export async function searchProductsForSlotAction(opts: {
  search?: string;
  nicheId?: string | null;
  limit?: number;
}): Promise<SlotProductSearchHit[]> {
  const params = new URLSearchParams();
  if (opts.search) params.set("search", opts.search);
  if (opts.nicheId) params.set("nicheId", opts.nicheId);
  params.set("isPublic", "true");
  params.set("limit", String(opts.limit ?? 40));
  const res = await fetch(`${API_BASE_URL}/admin/products?${params.toString()}`, {
    method: "GET",
    headers: { "x-admin-role": ADMIN_ROLE, "x-admin-key": ADMIN_API_KEY },
    cache: "no-store"
  });
  if (!res.ok) throw new Error(`searchProducts failed: ${await res.text()}`);
  return (await res.json()) as SlotProductSearchHit[];
}

export interface ArticleProgressDto {
  article: {
    id: string;
    status: string;
    currentStageMessage: string | null;
    currentStageProgress: number | null;
    currentStageStartedAt: string | null;
    generationError: string | null;
    aiRevisionCount: number;
    wordCount: number | null;
    updatedAt: string;
  };
  runs: Array<{
    id: string;
    stage: string;
    success: boolean;
    errorReason: string | null;
    durationMs: number | null;
    startedAt: string;
    finishedAt: string | null;
  }>;
}

/** Poll mỗi 2s từ client component khi pipeline đang chạy. Không revalidate. */
export async function getArticleProgressAction(articleId: string): Promise<ArticleProgressDto> {
  const response = await fetch(`${API_BASE_URL}/admin/articles/${articleId}/progress`, {
    method: "GET",
    headers: { "x-admin-role": ADMIN_ROLE, "x-admin-key": ADMIN_API_KEY },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`Progress poll failed: ${response.status}`);
  }
  return (await response.json()) as ArticleProgressDto;
}

// ───────── Crawler ─────────

export interface CrawlerCampaignBreakdown {
  campaignId: string;
  campaignName: string;
  merchantSlug: string;
  fetched: number;
  routed: number;
  failedFilter: number;
}

export interface CrawlerCycleResult {
  fetched: number;
  passedFilter: number;
  created: number;
  updated: number;
  skipped: number;
  campaigns: CrawlerCampaignBreakdown[];
}

export async function runCrawlerNowAction(): Promise<CrawlerCycleResult> {
  const result = await adminFetch<CrawlerCycleResult>("/admin/crawler/run", "POST", {});
  revalidatePath("/admin");
  revalidatePath("/admin/crawler-logs");
  revalidatePath("/admin/products");
  return result;
}

/** Void wrapper cho `<form action>` ở dashboard — bỏ qua result, chỉ trigger + revalidate. */
export async function runCrawlerNowFormAction(): Promise<void> {
  await runCrawlerNowAction();
}

export interface CrawlerProgress {
  isRunning: boolean;
  total: number;
  done: number;
  currentLabel: string | null;
  startedAt: number | null;
  finishedAt: number | null;
  lastError: string | null;
}

export async function getCrawlerProgressAction(): Promise<CrawlerProgress> {
  const response = await fetch(`${API_BASE_URL}/admin/crawler/progress`, {
    method: "GET",
    headers: {
      "x-admin-role": ADMIN_ROLE,
      "x-admin-key": ADMIN_API_KEY
    },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`progress poll failed: ${response.status}`);
  }
  return (await response.json()) as CrawlerProgress;
}

export async function ingestUrlAction(formData: FormData): Promise<void> {
  const url = String(formData.get("url") ?? "").trim();
  const nicheSlug = String(formData.get("nicheSlug") ?? "").trim();
  const affiliateUrl = String(formData.get("affiliateUrl") ?? "").trim() || undefined;
  if (!url || !nicheSlug) throw new Error("Vui lòng nhập URL và slug niche.");
  await post("/admin/crawler/ingest", { url, nicheSlug, affiliateUrl });
  revalidatePath("/admin");
}

// ───────── Niches ─────────

export async function createNicheAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const schemaConfigRaw = String(formData.get("schemaConfig") ?? "{}").trim();
  if (!name || !slug) throw new Error("Tên và slug bắt buộc.");
  let schemaConfig: Record<string, unknown>;
  try {
    schemaConfig = JSON.parse(schemaConfigRaw);
  } catch {
    throw new Error("schemaConfig phải là JSON hợp lệ.");
  }
  await post("/admin/niches", { name, slug, schemaConfig });
  revalidatePath("/admin/niches");
}

export async function updateNicheAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Thiếu id niche.");
  const body: Record<string, unknown> = {};
  if (formData.has("name")) body.name = String(formData.get("name") ?? "").trim();
  if (formData.has("slug")) body.slug = String(formData.get("slug") ?? "").trim();
  if (formData.has("status")) body.status = String(formData.get("status") ?? "ACTIVE");
  if (formData.has("seoTitle")) {
    body.seoTitle = String(formData.get("seoTitle") ?? "").trim() || null;
  }
  if (formData.has("seoDescription")) {
    body.seoDescription = String(formData.get("seoDescription") ?? "").trim() || null;
  }
  if (formData.has("schemaConfig")) {
    const raw = String(formData.get("schemaConfig") ?? "{}").trim();
    try {
      body.schemaConfig = JSON.parse(raw);
    } catch {
      throw new Error("schemaConfig phải là JSON hợp lệ.");
    }
  }
  await adminFetch(`/admin/niches/${id}`, "PUT", body);
  revalidatePath("/admin/niches");
}

export async function deleteNicheAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Thiếu id niche.");
  await adminFetch(`/admin/niches/${id}`, "DELETE");
  revalidatePath("/admin/niches");
}

// ───────── Categories (AT taxonomy — PR2) ─────────
//
// Admin chỉ điền displayName để storefront/filter hiện tên đẹp. Slug + rawValue do crawler auto-populate.

export async function updateCategoryDisplayNameAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Thiếu id category.");
  const displayNameRaw = String(formData.get("displayName") ?? "").trim();
  const displayName = displayNameRaw || null;
  await adminFetch(`/admin/categories/${id}`, "PUT", { displayName });
  revalidatePath("/admin/categories");
}

// ───────── Sources + Brands (PR3) ─────────

export async function updateSourceDisplayNameAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Thiếu id source.");
  const displayNameRaw = String(formData.get("displayName") ?? "").trim();
  const displayName = displayNameRaw || null;
  await adminFetch(`/admin/sources/${id}`, "PUT", { displayName });
  revalidatePath("/admin/sources");
}

export async function updateBrandDisplayNameAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Thiếu id brand.");
  const displayNameRaw = String(formData.get("displayName") ?? "").trim();
  const displayName = displayNameRaw || null;
  await adminFetch(`/admin/brands/${id}`, "PUT", { displayName });
  revalidatePath("/admin/brands");
}

// ───────── Products (admin manual) ─────────

export async function createProductAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const affiliateUrl = String(formData.get("affiliateUrl") ?? "").trim();
  const nicheId = String(formData.get("nicheId") ?? "").trim();
  const network = String(formData.get("network") ?? "").trim();
  const isPublic = String(formData.get("isPublic") ?? "") === "on";
  const scrapedDataRaw = String(formData.get("scrapedData") ?? "").trim();
  if (!name || !affiliateUrl || !nicheId || !network) {
    throw new Error("Tên, URL affiliate, niche và network bắt buộc.");
  }
  const body: Record<string, unknown> = { name, affiliateUrl, nicheId, network, isPublic };
  if (scrapedDataRaw) {
    try {
      body.scrapedData = JSON.parse(scrapedDataRaw);
    } catch {
      throw new Error("scrapedData phải là JSON hợp lệ.");
    }
  }
  const created = (await adminFetch<{ id: string }>("/admin/products", "POST", body));
  revalidatePath("/admin/products");
  redirect(`/admin/products/${created.id}`);
}

export async function updateProductAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Thiếu id sản phẩm.");
  const body: Record<string, unknown> = {};
  const name = String(formData.get("name") ?? "").trim();
  const affiliateUrl = String(formData.get("affiliateUrl") ?? "").trim();
  const isPublicRaw = formData.get("isPublic");
  const scrapedDataRaw = String(formData.get("scrapedData") ?? "").trim();
  const nicheId = String(formData.get("nicheId") ?? "").trim();
  const network = String(formData.get("network") ?? "").trim();
  if (name) body.name = name;
  if (affiliateUrl) body.affiliateUrl = affiliateUrl;
  if (nicheId) body.nicheId = nicheId;
  if (network) body.network = network;
  if (isPublicRaw !== null) body.isPublic = isPublicRaw === "on" || isPublicRaw === "true";
  if (formData.has("shopId")) {
    const shopIdRaw = String(formData.get("shopId") ?? "").trim();
    body.shopId = shopIdRaw || null;
  }
  if (scrapedDataRaw) {
    try {
      body.scrapedData = JSON.parse(scrapedDataRaw);
    } catch {
      throw new Error("scrapedData phải là JSON hợp lệ.");
    }
  }
  await adminFetch(`/admin/products/${id}`, "PUT", body);
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
}

export async function bulkAssignShopAction(formData: FormData): Promise<void> {
  const ids = formData.getAll("ids").map((v) => String(v)).filter(Boolean);
  const shopIdRaw = String(formData.get("shopId") ?? "").trim();
  if (ids.length === 0) throw new Error("Chưa chọn sản phẩm.");
  await post("/admin/products/bulk-assign-shop", {
    ids,
    shopId: shopIdRaw || null
  });
  revalidatePath("/admin/products");
}

// ───────── Shops (admin manual CRUD) ─────────

export async function createShopAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const logoUrl = String(formData.get("logoUrl") ?? "").trim() || null;
  const websiteUrl = String(formData.get("websiteUrl") ?? "").trim() || null;
  if (!name) throw new Error("Tên shop bắt buộc.");
  if (!slug) throw new Error("Slug bắt buộc.");
  await post("/admin/shops", { name, slug, description, logoUrl, websiteUrl });
  revalidatePath("/admin/shops");
}

export async function updateShopAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Thiếu id shop.");
  const body: Record<string, unknown> = {};
  if (formData.has("name")) {
    const v = String(formData.get("name") ?? "").trim();
    if (v) body.name = v;
  }
  if (formData.has("slug")) {
    const v = String(formData.get("slug") ?? "").trim();
    if (v) body.slug = v;
  }
  if (formData.has("description")) {
    body.description = String(formData.get("description") ?? "").trim() || null;
  }
  if (formData.has("logoUrl")) {
    body.logoUrl = String(formData.get("logoUrl") ?? "").trim() || null;
  }
  if (formData.has("websiteUrl")) {
    body.websiteUrl = String(formData.get("websiteUrl") ?? "").trim() || null;
  }
  await adminFetch(`/admin/shops/${id}`, "PUT", body);
  revalidatePath("/admin/shops");
}

export async function deleteShopAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Thiếu id shop.");
  await adminFetch(`/admin/shops/${id}`, "DELETE");
  revalidatePath("/admin/shops");
}

export async function toggleProductPublicAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const isPublic = String(formData.get("isPublic") ?? "false") === "true";
  if (!id) throw new Error("Thiếu id sản phẩm.");
  await adminFetch(`/admin/products/${id}`, "PUT", { isPublic });
  revalidatePath("/admin/products");
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Thiếu id sản phẩm.");
  await adminFetch(`/admin/products/${id}`, "DELETE");
  revalidatePath("/admin/products");
}

// ───────── Coupons ─────────

export async function createCouponAction(formData: FormData): Promise<void> {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!code) throw new Error("Vui lòng nhập mã.");
  const description = String(formData.get("description") ?? "").trim() || null;
  const discountPercentRaw = String(formData.get("discountPercent") ?? "").trim();
  const discountPercent = discountPercentRaw ? Number(discountPercentRaw) : null;
  const network = String(formData.get("network") ?? "").trim() || null;
  const nicheId = String(formData.get("nicheId") ?? "").trim() || null;
  const productId = String(formData.get("productId") ?? "").trim() || null;
  const expiresAtRaw = String(formData.get("expiresAt") ?? "").trim();
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw).toISOString() : null;
  await post("/admin/coupons", {
    code,
    description,
    discountPercent,
    network,
    nicheId,
    productId,
    expiresAt,
    isActive: true
  });
  revalidatePath("/admin/coupons");
}

export async function updateCouponAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Thiếu id coupon.");
  const body: Record<string, unknown> = {};
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const description = String(formData.get("description") ?? "").trim();
  const discountPercentRaw = String(formData.get("discountPercent") ?? "").trim();
  const network = String(formData.get("network") ?? "").trim();
  const nicheId = String(formData.get("nicheId") ?? "").trim();
  const expiresAtRaw = String(formData.get("expiresAt") ?? "").trim();
  const isActiveRaw = formData.get("isActive");

  if (code) body.code = code;
  if (formData.has("description")) body.description = description || null;
  if (formData.has("discountPercent")) {
    body.discountPercent = discountPercentRaw ? Number(discountPercentRaw) : null;
  }
  if (formData.has("network")) body.network = network || null;
  if (formData.has("nicheId")) body.nicheId = nicheId || null;
  if (formData.has("expiresAt")) {
    body.expiresAt = expiresAtRaw ? new Date(expiresAtRaw).toISOString() : null;
  }
  if (isActiveRaw !== null) body.isActive = isActiveRaw === "on" || isActiveRaw === "true";

  await adminFetch(`/admin/coupons/${id}`, "PUT", body);
  revalidatePath("/admin/coupons");
  revalidatePath(`/admin/coupons/${id}`);
}

export async function toggleCouponActiveAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const isActive = String(formData.get("isActive") ?? "false") === "true";
  if (!id) throw new Error("Thiếu id coupon.");
  await adminFetch(`/admin/coupons/${id}`, "PUT", { isActive });
  revalidatePath("/admin/coupons");
}

export async function deleteCouponAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Thiếu id coupon.");
  await adminFetch(`/admin/coupons/${id}`, "DELETE");
  revalidatePath("/admin/coupons");
}

// ───────── Article bulk + schedule + delete + duplicate ─────────

export async function bulkArticleAction(formData: FormData): Promise<void> {
  const action = String(formData.get("action") ?? "") as "publish" | "archive" | "delete";
  const ids = formData.getAll("ids").map((v) => String(v)).filter(Boolean);
  if (!action || ids.length === 0) throw new Error("Chọn ít nhất 1 bài và chọn hành động.");
  await post("/admin/articles/bulk", { ids, action });
  revalidatePath("/admin/articles");
}

export async function duplicateArticleAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Thiếu id.");
  await post(`/admin/articles/${id}/duplicate`, {});
  revalidatePath("/admin/articles");
}

export async function deleteArticleAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Thiếu id.");
  await adminFetch(`/admin/articles/${id}`, "DELETE");
  revalidatePath("/admin/articles");
}

export async function scheduleArticleAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const scheduledAtRaw = String(formData.get("scheduledAt") ?? "").trim();
  if (!id) throw new Error("Thiếu id.");
  const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw).toISOString() : null;
  await post(`/admin/articles/${id}/schedule`, { scheduledAt });
  revalidatePath(`/admin/articles/${id}`);
  revalidatePath("/admin/articles");
}

// ───────── Campaigns (affiliate campaigns per network) ─────────

export async function createCampaignAction(formData: FormData): Promise<void> {
  const network = String(formData.get("network") ?? "").trim();
  const externalId = String(formData.get("externalId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const merchantName = String(formData.get("merchantName") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "").trim() || undefined;
  const commissionNote = String(formData.get("commissionNote") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!network || !externalId || !name) {
    throw new Error("Mạng, externalId, tên là bắt buộc.");
  }
  await post("/admin/campaigns", {
    network,
    externalId,
    name,
    merchantName,
    status,
    commissionNote,
    notes
  });
  revalidatePath("/admin/campaigns");
}

export async function updateCampaignAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Thiếu id campaign.");
  const body: Record<string, unknown> = {};
  const name = String(formData.get("name") ?? "").trim();
  const merchantName = String(formData.get("merchantName") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const commissionNote = String(formData.get("commissionNote") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const appliedAtRaw = String(formData.get("appliedAt") ?? "").trim();
  const approvedAtRaw = String(formData.get("approvedAt") ?? "").trim();
  if (name) body.name = name;
  if (status) body.status = status;
  // Allow clearing optional fields by sending empty → null
  if (formData.has("merchantName")) body.merchantName = merchantName || null;
  if (formData.has("commissionNote")) body.commissionNote = commissionNote || null;
  if (formData.has("notes")) body.notes = notes || null;
  if (formData.has("appliedAt")) {
    body.appliedAt = appliedAtRaw ? new Date(appliedAtRaw).toISOString() : null;
  }
  if (formData.has("approvedAt")) {
    body.approvedAt = approvedAtRaw ? new Date(approvedAtRaw).toISOString() : null;
  }
  await adminFetch(`/admin/campaigns/${id}`, "PUT", body);
  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${id}`);
}

export async function updateCampaignStatusAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "").trim();
  if (!id || !status) throw new Error("Thiếu id hoặc status.");
  await adminFetch(`/admin/campaigns/${id}`, "PUT", { status });
  revalidatePath("/admin/campaigns");
}

export async function deleteCampaignAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Thiếu id campaign.");
  await adminFetch(`/admin/campaigns/${id}`, "DELETE");
  revalidatePath("/admin/campaigns");
}

export interface CampaignSyncResult {
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
}

export async function syncCampaignsFromAccesstrade(): Promise<CampaignSyncResult> {
  const result = await adminFetch<CampaignSyncResult>(
    "/admin/campaigns/sync-from-at",
    "POST"
  );
  revalidatePath("/admin/campaigns");
  return result;
}

export async function runCampaignCrawlerAction(atCampaignId: string): Promise<void> {
  if (!atCampaignId) throw new Error("Thiếu atCampaignId — sync trước rồi mới chạy crawler.");
  await adminFetch(`/admin/crawler/run-campaign/${encodeURIComponent(atCampaignId)}`, "POST");
  revalidatePath("/admin/campaigns");
}

export interface RunSelectedCrawlerResult {
  fetched: number;
  passedFilter: number;
  created: number;
  updated: number;
  skipped: number;
  campaigns: Array<{
    campaignId: string;
    campaignName: string;
    merchantSlug: string;
    fetched: number;
    routed: number;
    failedFilter: number;
  }>;
}

export async function updateCampaignFilterRulesAction(input: {
  id: string;
  filterRules: Record<string, unknown> | null;
}): Promise<void> {
  if (!input.id) throw new Error("Thiếu id campaign.");
  await adminFetch(`/admin/campaigns/${input.id}`, "PUT", {
    filterRules: input.filterRules
  });
  revalidatePath("/admin/campaigns");
}

export async function runSelectedCampaignsCrawlerAction(input: {
  campaignIds: string[];
  overrideLimit?: number;
}): Promise<RunSelectedCrawlerResult> {
  if (!input.campaignIds.length) throw new Error("Chưa chọn campaign nào.");
  const result = await adminFetch<RunSelectedCrawlerResult>(
    "/admin/crawler/run-selected",
    "POST",
    {
      campaignIds: input.campaignIds,
      overrideLimit: input.overrideLimit
    }
  );
  revalidatePath("/admin/campaigns");
  revalidatePath("/admin/products");
  revalidatePath("/admin/crawler-logs");
  return result;
}

export async function approveCouponAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Thiếu id coupon.");
  await post(`/admin/coupons/${id}/approve`, {});
  revalidatePath("/admin/coupons");
}

export async function archiveCouponAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Thiếu id coupon.");
  await post(`/admin/coupons/${id}/archive`, {});
  revalidatePath("/admin/coupons");
}

export interface CouponSyncResult {
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
}

export async function syncCouponsFromAccesstrade(): Promise<CouponSyncResult> {
  const result = await adminFetch<CouponSyncResult>("/admin/coupons/sync-from-at", "POST");
  revalidatePath("/admin/coupons");
  return result;
}

// ───────── Bulk admin actions (Categories / Products / Campaigns / Coupons) ─────────

export async function bulkNicheAction(formData: FormData): Promise<void> {
  const action = String(formData.get("action") ?? "");
  const ids = formData.getAll("ids").map((v) => String(v)).filter(Boolean);
  if (!action || ids.length === 0) {
    throw new Error("Chọn ít nhất 1 niche và 1 hành động.");
  }
  await post("/admin/niches/bulk", { ids, action });
  revalidatePath("/admin/niches");
}

export async function bulkProductAction(formData: FormData): Promise<void> {
  const action = String(formData.get("action") ?? "");
  const ids = formData.getAll("ids").map((v) => String(v)).filter(Boolean);
  if (!action || ids.length === 0) {
    throw new Error("Chọn ít nhất 1 sản phẩm và 1 hành động.");
  }
  const body: Record<string, unknown> = { ids, action };
  if (action === "assign-niche") {
    const nicheId = String(formData.get("nicheId") ?? "").trim();
    if (!nicheId) throw new Error("Chọn niche trước khi gán.");
    body.nicheId = nicheId;
  }
  await post("/admin/products/bulk", body);
  revalidatePath("/admin/products");
}

export interface BulkCampaignResult {
  success: boolean;
  count: number;
}

export async function bulkCampaignAction(formData: FormData): Promise<BulkCampaignResult> {
  const action = String(formData.get("action") ?? "");
  const ids = formData.getAll("ids").map((v) => String(v)).filter(Boolean);
  if (!action || ids.length === 0) {
    throw new Error("Chọn ít nhất 1 campaign và 1 hành động.");
  }
  const result = await adminFetch<BulkCampaignResult>("/admin/campaigns/bulk", "POST", { ids, action });
  revalidatePath("/admin/campaigns");
  return result;
}

export async function bulkCouponAction(formData: FormData): Promise<void> {
  const action = String(formData.get("action") ?? "");
  const ids = formData.getAll("ids").map((v) => String(v)).filter(Boolean);
  if (!action || ids.length === 0) {
    throw new Error("Chọn ít nhất 1 coupon và 1 hành động.");
  }
  await post("/admin/coupons/bulk", { ids, action });
  revalidatePath("/admin/coupons");
}

// ───────── Reconciliation ─────────

export async function runReconciliationNowAction(): Promise<void> {
  await post("/admin/reconciliation/run", {});
  revalidatePath("/admin/reconciliation");
  revalidatePath("/admin");
}
