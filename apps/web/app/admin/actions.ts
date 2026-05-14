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
  const toolId = String(formData.get("toolId") ?? "") || undefined;
  const productIdsRaw = formData.getAll("productIds");
  const productIds = productIdsRaw.map((v) => String(v)).filter(Boolean);

  if (!topic || topic.length < 5) {
    throw new Error("Vui lòng nhập chủ đề (≥ 5 ký tự).");
  }

  const created = (await adminFetch<{ id: string }>("/admin/articles/generate", "POST", {
    type,
    topic,
    toolId,
    productIds
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
  const toolIdRaw = String(formData.get("toolId") ?? "");
  if (toolIdRaw) body.toolId = toolIdRaw;

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
