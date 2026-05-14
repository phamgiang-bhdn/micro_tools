"use server";

import { revalidatePath } from "next/cache";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api/v1";
const ADMIN_ROLE = process.env.ADMIN_ROLE ?? "admin";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY ?? "change-me";

async function post(path: string, body: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-role": ADMIN_ROLE,
      "x-admin-key": ADMIN_API_KEY
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed ${path}: ${text}`);
  }
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
