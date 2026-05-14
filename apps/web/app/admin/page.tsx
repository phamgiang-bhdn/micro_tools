import type React from "react";
import Link from "next/link";
import {
  approveExtractionAction,
  rejectExtractionAction,
  retryExtractionAction,
  savePromptAction
} from "./actions";
import { PromptTestClient } from "./prompt-test-client";

export const dynamic = "force-dynamic";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api/v1";
const ADMIN_ROLE = process.env.ADMIN_ROLE ?? "admin";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY ?? "change-me";

type TabId = "war-room" | "refinery" | "prompt-studio" | "money-trail";

interface AdminPageProps {
  searchParams: Promise<{
    tab?: TabId;
  }>;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    headers: {
      "x-admin-role": ADMIN_ROLE,
      "x-admin-key": ADMIN_API_KEY
    }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${path} failed: ${text}`);
  }
  return (await response.json()) as T;
}

const tabBase =
  "inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-google-blue focus-visible:ring-offset-2";
const tabActive = "bg-google-blue text-white shadow-google";
const tabIdle = "border border-google-outline bg-google-surface text-google-ink-secondary hover:bg-google-surface-tint";

const field =
  "w-full rounded-lg border border-google-outline bg-google-surface px-3 py-2.5 text-sm text-google-ink placeholder:text-google-ink-secondary focus:border-google-blue focus:outline-none focus:ring-1 focus:ring-google-blue";

export default async function AdminPage({ searchParams }: AdminPageProps): Promise<React.ReactElement> {
  const { tab = "war-room" } = await searchParams;

  const tabs: { id: TabId; label: string }[] = [
    { id: "war-room", label: "War Room" },
    { id: "refinery", label: "Refinery" },
    { id: "prompt-studio", label: "Prompt Studio" },
    { id: "money-trail", label: "Money trail" }
  ];

  const [warRoom, refinery, activePrompt, moneyTrail] = await Promise.all([
    getJson<{
      monthlyRevenue: string;
      totalClicks: number;
      successfulConversions: number;
      conversionRate: number;
      tokenBalanceEstimate: number;
      pendingReview: number;
      crawlerHealthy: boolean;
    }>("/admin/war-room"),
    getJson<
      Array<{
        id: string;
        rawContent: string;
        aiOutput: Record<string, unknown> | null;
        status: string;
        createdAt: string;
        product: { name: string; network: string };
      }>
    >("/admin/refinery?status=PENDING_REVIEW"),
    getJson<{ name: string; version: number; content: string } | null>("/admin/prompts/active"),
    getJson<
      Array<{
        trackingCode: string;
        ipHash: string;
        userAgent: string | null;
        createdAt: string;
        product: { name: string; network: string };
        conversionHooks: Array<{ revenue: string; status: string }>;
      }>
    >("/admin/money-trail?limit=100")
  ]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-google-outline bg-google-surface p-6 shadow-google">
        <p className="text-xs font-medium uppercase tracking-wide text-google-ink-secondary">Admin</p>
        <h1 className="mt-1 text-2xl font-normal text-google-ink">Command Center</h1>
        <p className="mt-2 text-sm text-google-ink-secondary">
          Human-in-the-loop: duyệt dữ liệu AI, prompt, và đối soát tracking.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-google-outline bg-google-surface p-2 shadow-google">
        {tabs.map((entry) => (
          <Link
            key={entry.id}
            href={`/admin?tab=${entry.id}`}
            className={`${tabBase} ${tab === entry.id ? tabActive : tabIdle}`}
          >
            {entry.label}
          </Link>
        ))}
      </div>

      {tab === "war-room" && (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Monthly revenue", value: warRoom.monthlyRevenue },
            { label: "Conversion rate", value: `${warRoom.conversionRate}%` },
            { label: "Token budget (estimate)", value: String(warRoom.tokenBalanceEstimate) },
            {
              label: "Crawler health",
              value: warRoom.crawlerHealthy ? "Healthy" : "Check",
              tone: warRoom.crawlerHealthy ? ("text-google-success" as const) : ("text-google-error" as const)
            }
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-google-outline bg-google-surface p-5 shadow-google"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-google-ink-secondary">{card.label}</p>
              <p className={`mt-3 text-2xl font-normal ${"tone" in card && card.tone ? card.tone : "text-google-ink"}`}>
                {card.value}
              </p>
            </div>
          ))}
        </section>
      )}

      {tab === "refinery" && (
        <section className="space-y-4">
          {refinery.length === 0 ? (
            <div className="rounded-2xl border border-google-outline bg-google-surface p-6 text-sm text-google-ink-secondary shadow-google">
              No pending AI extraction in review queue.
            </div>
          ) : (
            refinery.map((item) => (
              <div
                key={item.id}
                className="grid gap-6 rounded-2xl border border-google-outline bg-google-surface p-6 shadow-google-md lg:grid-cols-2"
              >
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-google-ink-secondary">
                    Raw content · {item.product.name} · {item.product.network}
                  </p>
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-google-outline bg-google-surface-tint p-4 text-xs leading-relaxed text-google-ink">
                    {item.rawContent}
                  </pre>
                </div>
                <div className="space-y-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-google-ink-secondary">
                    AI output (JSON, editable)
                  </p>
                  <form action={approveExtractionAction} className="space-y-3">
                    <input type="hidden" name="extractionId" value={item.id} />
                    <input type="hidden" name="reviewer" value="admin" />
                    <textarea
                      name="aiOutput"
                      defaultValue={JSON.stringify(item.aiOutput ?? {}, null, 2)}
                      className={`${field} h-56 font-mono text-xs`}
                    />
                    <button
                      type="submit"
                      className="inline-flex h-10 items-center rounded-full bg-google-success px-5 text-sm font-medium text-white shadow-google hover:opacity-95"
                    >
                      Approve &amp; sync
                    </button>
                  </form>
                  <div className="flex flex-wrap gap-2">
                    <form action={retryExtractionAction}>
                      <input type="hidden" name="extractionId" value={item.id} />
                      <button
                        type="submit"
                        className="inline-flex h-10 items-center rounded-full border border-google-warning bg-white px-5 text-sm font-medium text-google-ink hover:bg-amber-50"
                      >
                        Reject &amp; retry
                      </button>
                    </form>
                    <form action={rejectExtractionAction}>
                      <input type="hidden" name="extractionId" value={item.id} />
                      <input type="hidden" name="reviewer" value="admin" />
                      <input type="hidden" name="reason" value="Manual rejection from admin panel" />
                      <button
                        type="submit"
                        className="inline-flex h-10 items-center rounded-full border border-red-200 bg-white px-5 text-sm font-medium text-google-error hover:bg-red-50"
                      >
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {tab === "prompt-studio" && (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-google-outline bg-google-surface p-6 shadow-google">
            <p className="text-xs font-medium uppercase tracking-wide text-google-ink-secondary">Active prompt</p>
            {activePrompt ? (
              <div className="mt-3 space-y-2">
                <p className="font-medium text-google-ink">
                  {activePrompt.name}{" "}
                  <span className="text-google-ink-secondary">v{activePrompt.version}</span>
                </p>
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-google-outline bg-google-surface-tint p-4 text-xs text-google-ink">
                  {activePrompt.content}
                </pre>
              </div>
            ) : (
              <p className="mt-3 text-sm text-google-ink-secondary">No active prompt configured.</p>
            )}
          </div>

          <form action={savePromptAction} className="space-y-4 rounded-2xl border border-google-outline bg-google-surface p-6 shadow-google">
            <p className="text-xs font-medium uppercase tracking-wide text-google-ink-secondary">Save new version</p>
            <input name="name" placeholder="default-parser" className={field} />
            <input name="createdBy" placeholder="admin" className={field} />
            <textarea name="content" placeholder="You are an expert extraction agent..." className={`${field} h-48`} />
            <label className="flex items-center gap-2 text-sm text-google-ink">
              <input name="activateNow" type="checkbox" className="size-4 rounded border-google-outline text-google-blue" />
              Activate immediately
            </label>
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-full bg-google-blue px-6 text-sm font-medium text-white shadow-google hover:bg-google-blue-hover"
            >
              Save prompt
            </button>
          </form>
          <PromptTestClient />
        </section>
      )}

      {tab === "money-trail" && (
        <section className="overflow-hidden rounded-2xl border border-google-outline bg-google-surface shadow-google-md">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm text-google-ink">
              <thead>
                <tr className="border-b border-google-outline bg-google-surface-tint text-left text-xs font-medium uppercase tracking-wide text-google-ink-secondary">
                  <th className="px-4 py-3">Tracking</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">IP hash</th>
                  <th className="px-4 py-3">User-Agent</th>
                  <th className="px-4 py-3">Conversion</th>
                </tr>
              </thead>
              <tbody>
                {moneyTrail.map((row) => (
                  <tr key={row.trackingCode} className="border-b border-google-outline last:border-b-0 hover:bg-google-surface-tint/60">
                    <td className="px-4 py-3 font-mono text-xs">{row.trackingCode}</td>
                    <td className="px-4 py-3">
                      {row.product.name}
                      <p className="text-xs text-google-ink-secondary">{row.product.network}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-google-ink-secondary">{row.ipHash}</td>
                    <td className="max-w-[360px] px-4 py-3 text-xs text-google-ink-secondary">{row.userAgent ?? "—"}</td>
                    <td className="px-4 py-3 text-xs">
                      {row.conversionHooks.length > 0
                        ? `${row.conversionHooks[0].status} · ${row.conversionHooks[0].revenue}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
