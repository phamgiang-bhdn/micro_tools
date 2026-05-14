import type React from "react";
import Link from "next/link";
import { savePromptAction } from "./actions";
import { PromptTestClient } from "./prompt-test-client";
import { RefineryList } from "../../components/admin/refinery-list";
import { KpiCard } from "../../components/admin/kpi-card";
import { MoneyTrailTable } from "../../components/admin/money-trail-table";

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

const field =
  "w-full rounded-lg border border-admin-line bg-admin-surface px-3 py-2.5 text-sm text-admin-ink placeholder:text-admin-mute focus:border-admin-accent focus:outline-none focus:ring-2 focus:ring-admin-accent/20";

interface WarRoomResponse {
  monthlyRevenue: string;
  totalClicks: number;
  successfulConversions: number;
  conversionRate: number;
  tokenBalanceEstimate: number;
  pendingReview: number;
  crawlerHealthy: boolean;
}

interface RefineryItemResponse {
  id: string;
  rawContent: string;
  aiOutput: Record<string, unknown> | null;
  status: string;
  createdAt: string;
  product: { id: string; name: string; network: string };
}

interface MoneyTrailRow {
  trackingCode: string;
  ipHash: string;
  userAgent: string | null;
  createdAt: string;
  product: { name: string; network: string };
  conversionHooks: Array<{ revenue: string; status: string }>;
}

interface ActivePromptResponse {
  name: string;
  version: number;
  content: string;
}

export default async function AdminPage({ searchParams }: AdminPageProps): Promise<React.ReactElement> {
  const { tab = "war-room" } = await searchParams;

  const [warRoom, refinery, activePrompt, moneyTrail] = await Promise.all([
    getJson<WarRoomResponse>("/admin/war-room"),
    getJson<RefineryItemResponse[]>("/admin/refinery?status=PENDING_REVIEW"),
    getJson<ActivePromptResponse | null>("/admin/prompts/active"),
    getJson<MoneyTrailRow[]>("/admin/money-trail?limit=100")
  ]);

  return (
    <div className="space-y-6">
      <PageHeader tab={tab} pending={warRoom.pendingReview} />

      {tab === "war-room" ? <WarRoom data={warRoom} pendingItems={refinery.length} /> : null}

      {tab === "refinery" ? <RefineryList items={refinery} /> : null}

      {tab === "prompt-studio" ? <PromptStudio activePrompt={activePrompt} field={field} /> : null}

      {tab === "money-trail" ? <MoneyTrailTable rows={moneyTrail} /> : null}
    </div>
  );
}

function PageHeader({ tab, pending }: { tab: TabId; pending: number }): React.ReactElement {
  const titles: Record<TabId, { title: string; sub: string }> = {
    "war-room": {
      title: "War Room",
      sub: "Tổng quan KPI vận hành, doanh thu affiliate và trạng thái crawler."
    },
    refinery: {
      title: "Refinery",
      sub: "Duyệt dữ liệu AI extraction trước khi go-live. Có preview như user thấy."
    },
    "prompt-studio": {
      title: "Prompt Studio",
      sub: "Quản lý version prompt và test trước khi activate."
    },
    "money-trail": {
      title: "Money Trail",
      sub: "Đối soát click → conversion theo trackingCode."
    }
  };
  const meta = titles[tab];
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-admin-mute">Operations</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-admin-ink sm:text-3xl">{meta.title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-admin-mute">{meta.sub}</p>
      </div>
      {pending > 0 ? (
        <Link
          href="/admin?tab=refinery"
          className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
        >
          <span aria-hidden className="size-2 rounded-full bg-amber-500 animate-pulse-glow" />
          {pending} bản đang chờ duyệt →
        </Link>
      ) : null}
    </div>
  );
}

function WarRoom({
  data,
  pendingItems
}: {
  data: WarRoomResponse;
  pendingItems: number;
}): React.ReactElement {
  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Doanh thu tháng"
          value={data.monthlyRevenue}
          icon="revenue"
          tone="brand"
          hint={`${data.successfulConversions} đơn conversion`}
        />
        <KpiCard
          label="Conversion rate"
          value={`${data.conversionRate}%`}
          icon="rate"
          tone={data.conversionRate >= 2 ? "accent" : "neutral"}
          hint={`${data.totalClicks.toLocaleString("vi-VN")} clicks tháng này`}
        />
        <KpiCard
          label="Token budget (est.)"
          value={data.tokenBalanceEstimate.toLocaleString("vi-VN")}
          icon="tokens"
          tone={data.tokenBalanceEstimate < 50000 ? "warning" : "neutral"}
          hint={data.tokenBalanceEstimate < 50000 ? "Sắp cạn — top-up sớm" : "Vẫn còn dư"}
        />
        <KpiCard
          label="Crawler"
          value={data.crawlerHealthy ? "Healthy" : "Check"}
          icon="crawler"
          tone={data.crawlerHealthy ? "accent" : "error"}
          hint={data.crawlerHealthy ? "Tất cả nguồn xanh" : "Có nguồn lỗi — kiểm tra log"}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="admin-card p-5 lg:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-admin-mute">Hôm nay cần xử lý</p>
              <h2 className="mt-1 text-lg font-semibold text-admin-ink">Hàng đợi vận hành</h2>
            </div>
          </div>
          <ul className="mt-4 space-y-2">
            <QueueRow
              tone={pendingItems > 0 ? "warning" : "ok"}
              title="AI extraction chờ duyệt"
              hint={pendingItems > 0 ? "Vào Refinery để approve hoặc reject" : "Trống — không có việc tồn"}
              count={pendingItems}
              href="/admin?tab=refinery"
            />
            <QueueRow
              tone={data.crawlerHealthy ? "ok" : "error"}
              title="Crawler status"
              hint={data.crawlerHealthy ? "Tất cả nguồn đang chạy ổn" : "Có nguồn báo lỗi — mở log để xem"}
              count={data.crawlerHealthy ? 0 : 1}
            />
            <QueueRow
              tone={data.tokenBalanceEstimate < 50000 ? "warning" : "ok"}
              title="Gemini token budget"
              hint={
                data.tokenBalanceEstimate < 50000
                  ? "Sắp cạn — cân nhắc top-up trong 24h"
                  : "Đủ cho chu kỳ crawl hiện tại"
              }
              count={data.tokenBalanceEstimate < 50000 ? 1 : 0}
            />
          </ul>
        </article>

        <article className="admin-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-admin-mute">Lối tắt</p>
          <h2 className="mt-1 text-lg font-semibold text-admin-ink">Tác vụ nhanh</h2>
          <div className="mt-4 space-y-2 text-sm">
            <ShortcutLink href="/admin?tab=refinery" label="Mở Refinery" icon="📋" />
            <ShortcutLink href="/admin?tab=prompt-studio" label="Save prompt version mới" icon="✨" />
            <ShortcutLink href="/admin?tab=money-trail" label="Xem money trail" icon="💰" />
            <ShortcutLink href="/" label="Mở storefront (xem như user)" icon="🪟" external />
          </div>
        </article>
      </section>
    </div>
  );
}

function QueueRow({
  tone,
  title,
  hint,
  count,
  href
}: {
  tone: "ok" | "warning" | "error";
  title: string;
  hint: string;
  count: number;
  href?: string;
}): React.ReactElement {
  const dotClass =
    tone === "ok" ? "bg-emerald-500" : tone === "warning" ? "bg-amber-500" : "bg-red-500";
  const inner = (
    <div className="flex items-center gap-3 rounded-lg border border-admin-line bg-admin-subtle/50 px-3 py-2.5 transition hover:bg-admin-subtle">
      <span aria-hidden className={`size-2 shrink-0 rounded-full ${dotClass}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-admin-ink">{title}</p>
        <p className="text-xs text-admin-mute">{hint}</p>
      </div>
      {count > 0 ? (
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${tone === "warning" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700"}`}>
          {count}
        </span>
      ) : null}
    </div>
  );
  return href ? <li><Link href={href}>{inner}</Link></li> : <li>{inner}</li>;
}

function ShortcutLink({
  href,
  label,
  icon,
  external
}: {
  href: string;
  label: string;
  icon: string;
  external?: boolean;
}): React.ReactElement {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="flex items-center gap-2.5 rounded-lg border border-admin-line bg-admin-subtle/40 px-3 py-2.5 text-admin-ink transition hover:border-admin-accent/50 hover:bg-admin-accent-soft hover:text-admin-accent"
    >
      <span aria-hidden className="text-base">{icon}</span>
      <span className="flex-1">{label}</span>
      <span aria-hidden className="text-admin-mute">→</span>
    </Link>
  );
}

function PromptStudio({
  activePrompt,
  field
}: {
  activePrompt: ActivePromptResponse | null;
  field: string;
}): React.ReactElement {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <article className="admin-card p-6">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-admin-mute">Active prompt</p>
          {activePrompt ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              v{activePrompt.version}
            </span>
          ) : null}
        </div>
        {activePrompt ? (
          <div className="mt-3 space-y-2">
            <p className="font-semibold text-admin-ink">{activePrompt.name}</p>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-admin-line bg-admin-subtle p-4 text-xs leading-relaxed text-admin-ink">
              {activePrompt.content}
            </pre>
          </div>
        ) : (
          <p className="mt-3 text-sm text-admin-mute">Chưa cấu hình prompt nào — hãy tạo bên phải.</p>
        )}
      </article>

      <form action={savePromptAction} className="admin-card space-y-3 p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-admin-mute">Save new version</p>
        <Field label="Tên prompt" name="name" placeholder="default-parser" inputClass={field} />
        <Field label="Người tạo" name="createdBy" placeholder="admin" inputClass={field} />
        <div className="space-y-1">
          <label className="text-xs font-medium text-admin-ink">Nội dung prompt</label>
          <textarea name="content" placeholder="You are an expert extraction agent..." className={`${field} h-48 font-mono text-xs`} />
        </div>
        <label className="flex items-center gap-2 text-sm text-admin-ink">
          <input name="activateNow" type="checkbox" className="size-4 rounded border-admin-line text-admin-accent" />
          Activate ngay sau khi lưu
        </label>
        <button
          type="submit"
          className="inline-flex h-10 items-center rounded-full bg-admin-accent px-6 text-sm font-semibold text-white shadow-google transition hover:bg-admin-accent/90"
        >
          Lưu prompt
        </button>
      </form>

      <div className="lg:col-span-2">
        <PromptTestClient />
      </div>
    </section>
  );
}

function Field({
  label,
  name,
  placeholder,
  inputClass
}: {
  label: string;
  name: string;
  placeholder: string;
  inputClass: string;
}): React.ReactElement {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-admin-ink">{label}</label>
      <input name={name} placeholder={placeholder} className={inputClass} />
    </div>
  );
}
