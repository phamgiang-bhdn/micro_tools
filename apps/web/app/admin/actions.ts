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
  const categoryId = String(formData.get("categoryId") ?? "") || undefined;
  const pinnedProductIdsRaw = formData.getAll("pinnedProductIds");
  const pinnedProductIds = pinnedProductIdsRaw.map((v) => String(v)).filter(Boolean);
  const productRef = String(formData.get("productRef") ?? "").trim() || undefined;

  if (!topic || topic.length < 5) {
    throw new Error("Vui lòng nhập chủ đề (≥ 5 ký tự).");
  }
  if (type === "BUYING_GUIDE" && !categoryId) {
    throw new Error("Cẩm nang chọn mua cần chọn 1 danh mục.");
  }
  if (type === "REVIEW" && !productRef) {
    throw new Error("Review cần nhập tên / slug / URL sản phẩm.");
  }

  const created = (await adminFetch<{ id: string }>("/admin/articles/generate", "POST", {
    type,
    topic,
    categoryId,
    pinnedProductIds,
    productRef
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
  const categoryIdRaw = String(formData.get("categoryId") ?? "");
  if (categoryIdRaw) body.categoryId = categoryIdRaw;

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

// ───────── Crawler ─────────

export async function runCrawlerNowAction(): Promise<void> {
  await post("/admin/crawler/run", {});
  revalidatePath("/admin");
}

export async function ingestUrlAction(formData: FormData): Promise<void> {
  const url = String(formData.get("url") ?? "").trim();
  const categorySlug = String(formData.get("categorySlug") ?? "").trim();
  const affiliateUrl = String(formData.get("affiliateUrl") ?? "").trim() || undefined;
  if (!url || !categorySlug) throw new Error("Vui lòng nhập URL và slug danh mục.");
  await post("/admin/crawler/ingest", { url, categorySlug, affiliateUrl });
  revalidatePath("/admin");
}

// ───────── Categories ─────────

export async function createCategoryAction(formData: FormData): Promise<void> {
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
  await post("/admin/categories", { name, slug, schemaConfig });
  revalidatePath("/admin/categories");
}

export async function updateCategoryAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Thiếu id danh mục.");
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
  await adminFetch(`/admin/categories/${id}`, "PUT", body);
  revalidatePath("/admin/categories");
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Thiếu id danh mục.");
  await adminFetch(`/admin/categories/${id}`, "DELETE");
  revalidatePath("/admin/categories");
}

// ───────── Products (admin manual) ─────────

export async function createProductAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const affiliateUrl = String(formData.get("affiliateUrl") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const network = String(formData.get("network") ?? "").trim();
  const isPublic = String(formData.get("isPublic") ?? "") === "on";
  const scrapedDataRaw = String(formData.get("scrapedData") ?? "").trim();
  if (!name || !affiliateUrl || !categoryId || !network) {
    throw new Error("Tên, URL affiliate, danh mục và network bắt buộc.");
  }
  const body: Record<string, unknown> = { name, affiliateUrl, categoryId, network, isPublic };
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
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const network = String(formData.get("network") ?? "").trim();
  if (name) body.name = name;
  if (affiliateUrl) body.affiliateUrl = affiliateUrl;
  if (categoryId) body.categoryId = categoryId;
  if (network) body.network = network;
  if (isPublicRaw !== null) body.isPublic = isPublicRaw === "on" || isPublicRaw === "true";
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
  const categoryId = String(formData.get("categoryId") ?? "").trim() || null;
  const productId = String(formData.get("productId") ?? "").trim() || null;
  const expiresAtRaw = String(formData.get("expiresAt") ?? "").trim();
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw).toISOString() : null;
  await post("/admin/coupons", {
    code,
    description,
    discountPercent,
    network,
    categoryId,
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
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const expiresAtRaw = String(formData.get("expiresAt") ?? "").trim();
  const isActiveRaw = formData.get("isActive");

  if (code) body.code = code;
  if (formData.has("description")) body.description = description || null;
  if (formData.has("discountPercent")) {
    body.discountPercent = discountPercentRaw ? Number(discountPercentRaw) : null;
  }
  if (formData.has("network")) body.network = network || null;
  if (formData.has("categoryId")) body.categoryId = categoryId || null;
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
