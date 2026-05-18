import type React from "react";
import Link from "next/link";
import { Download, Play } from "lucide-react";
import { ingestUrlAction, runCrawlerNowFormAction, savePromptAction } from "./actions";
import { PromptTestClient } from "./prompt-test-client";
import { RefineryList } from "../../components/admin/refinery-list";
import { KpiCard } from "../../components/admin/kpi-card";
import { MoneyTrailTable } from "../../components/admin/money-trail-table";
import {
  adminGet,
  AdminLinkButton,
  FilterBar,
  NativeFilterInput,
  NativeFilterSelect,
  PageHeader,
  SectionCard,
  SubmitButton,
  TextField,
  TextareaField
} from "../../components/admin/ui";
import { ADMIN_PARAMS, NETWORK_OPTIONS } from "../../lib/admin/constants";

export const dynamic = "force-dynamic";

type TabId = "war-room" | "refinery" | "prompt-studio" | "money-trail";

interface AdminPageProps {
  searchParams: Promise<{
    tab?: TabId;
    trackingCode?: string;
    from?: string;
    to?: string;
    network?: string;
    mismatchOnly?: string;
  }>;
}

interface MoneyTrailSummary {
  totalRevenue: string;
  conversionCount: number;
  byNetwork: Array<{ network: string; revenue: string; count: number }>;
}

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
  conversionHooks: Array<{
    revenue: string;
    status: string;
    source?: string | null;
    atOrderId?: string | null;
    atCommission?: string | null;
    reconcileNotes?: string | null;
    lastReconciledAt?: string | null;
  }>;
}

interface ActivePromptResponse {
  name: string;
  version: number;
  content: string;
}

export default async function AdminPage({ searchParams }: AdminPageProps): Promise<React.ReactElement> {
  const { tab = "war-room", trackingCode, from, to, network, mismatchOnly } = await searchParams;

  const moneyTrailQs = new URLSearchParams({ limit: "200" });
  if (trackingCode) moneyTrailQs.set("trackingCode", trackingCode);
  if (from) moneyTrailQs.set("from", from);
  if (to) moneyTrailQs.set("to", to);
  if (network) moneyTrailQs.set("network", network);
  if (mismatchOnly === "true") moneyTrailQs.set("mismatchOnly", "true");

  const summaryQs = new URLSearchParams();
  if (from) summaryQs.set("from", from);
  if (to) summaryQs.set("to", to);

  const [warRoom, refinery, activePrompt, moneyTrail, summary] = await Promise.all([
    adminGet<WarRoomResponse>("/admin/war-room"),
    adminGet<RefineryItemResponse[]>("/admin/refinery?status=PENDING_REVIEW"),
    adminGet<ActivePromptResponse | null>("/admin/prompts/active"),
    adminGet<MoneyTrailRow[]>(`/admin/money-trail?${moneyTrailQs.toString()}`),
    adminGet<MoneyTrailSummary>(`/admin/money-trail/summary?${summaryQs.toString()}`)
  ]);

  const titles: Record<TabId, { title: string; sub: string; eyebrow: string }> = {
    "war-room": {
      eyebrow: "Operations",
      title: "Tổng quan",
      sub: "KPI vận hành, doanh thu affiliate và trạng thái crawler."
    },
    refinery: {
      eyebrow: "HITL Gate",
      title: "Duyệt sản phẩm",
      sub: "Duyệt dữ liệu AI bóc tách trước khi cho lên trang. Có preview như user thấy."
    },
    "prompt-studio": {
      eyebrow: "AI",
      title: "Xưởng prompt",
      sub: "Quản lý phiên bản prompt và test trước khi kích hoạt."
    },
    "money-trail": {
      eyebrow: "Revenue",
      title: "Dòng tiền",
      sub: "Đối soát click → đơn hàng theo mã tracking."
    }
  };
  const meta = titles[tab];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={meta.eyebrow}
        title={meta.title}
        subtitle={meta.sub}
        actions={
          warRoom.pendingReview > 0 ? (
            <Link
              href="/admin?tab=refinery"
              className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
            >
              <span aria-hidden className="size-2 animate-pulse rounded-full bg-amber-500" />
              {warRoom.pendingReview} bản chờ duyệt →
            </Link>
          ) : null
        }
      />

      {tab === "war-room" ? <WarRoom data={warRoom} pendingItems={refinery.length} /> : null}
      {tab === "refinery" ? <RefineryList items={refinery} /> : null}
      {tab === "prompt-studio" ? <PromptStudio activePrompt={activePrompt} /> : null}
      {tab === "money-trail" ? (
        <MoneyTrailSection
          rows={moneyTrail}
          summary={summary}
          filters={{ trackingCode, from, to, network, mismatchOnly }}
        />
      ) : null}
    </div>
  );
}

function MoneyTrailSection({
  rows,
  summary,
  filters
}: {
  rows: MoneyTrailRow[];
  summary: MoneyTrailSummary;
  filters: {
    trackingCode?: string;
    from?: string;
    to?: string;
    network?: string;
    mismatchOnly?: string;
  };
}): React.ReactElement {
  const exportQs = new URLSearchParams({ format: "csv" });
  if (filters.trackingCode) exportQs.set("trackingCode", filters.trackingCode);
  if (filters.from) exportQs.set("from", filters.from);
  if (filters.to) exportQs.set("to", filters.to);
  if (filters.network) exportQs.set("network", filters.network);

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Tổng doanh thu (khoảng thời gian)"
          value={`₫${Number(summary.totalRevenue).toLocaleString("vi-VN")}`}
          icon="revenue"
          tone="brand"
          hint={`${summary.conversionCount} đơn`}
        />
        {summary.byNetwork.slice(0, 2).map((b) => (
          <KpiCard
            key={b.network}
            label={`Doanh thu ${b.network}`}
            value={`₫${Number(b.revenue).toLocaleString("vi-VN")}`}
            icon="rate"
            tone="accent"
            hint={`${b.count} đơn`}
          />
        ))}
        {summary.byNetwork.length === 0 ? (
          <KpiCard label="Theo network" value="—" icon="rate" tone="neutral" hint="Chưa có đơn" />
        ) : null}
      </section>

      <FilterBar
        resetHref="/admin?tab=money-trail"
        hiddenFields={{ tab: "money-trail" }}
        extraActions={
          <AdminLinkButton
            href={`/admin/money-trail/export?${exportQs.toString()}`}
            variant="outline"
            size="md"
            iconLeft={<Download />}
          >
            Tải CSV
          </AdminLinkButton>
        }
      >
        <NativeFilterInput
          label="Mã tracking"
          name={ADMIN_PARAMS.trackingCode}
          defaultValue={filters.trackingCode ?? ""}
          placeholder="32 ký tự..."
          className="font-mono text-xs"
        />
        <NativeFilterInput
          label="Từ ngày"
          name={ADMIN_PARAMS.from}
          type="date"
          defaultValue={filters.from ?? ""}
          className="w-40"
        />
        <NativeFilterInput
          label="Đến ngày"
          name={ADMIN_PARAMS.to}
          type="date"
          defaultValue={filters.to ?? ""}
          className="w-40"
        />
        <NativeFilterSelect
          label="Mạng affiliate"
          name={ADMIN_PARAMS.network}
          defaultValue={filters.network ?? ""}
          options={NETWORK_OPTIONS}
        />
        <NativeFilterSelect
          label="Reconcile"
          name="mismatchOnly"
          defaultValue={filters.mismatchOnly ?? ""}
          options={[{ value: "true", label: "Chỉ rows lệch" }]}
        />
      </FilterBar>

      <MoneyTrailTable rows={rows} />
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
        <div className="lg:col-span-2">
          <SectionCard title="Hàng đợi vận hành" eyebrow="Hôm nay cần xử lý">
            <ul className="space-y-2">
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
                href={data.crawlerHealthy ? undefined : "/admin/crawler-logs"}
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
          </SectionCard>
        </div>

        <SectionCard title="Tác vụ nhanh" eyebrow="Lối tắt">
          <div className="space-y-2 text-sm">
            <ShortcutLink href="/admin?tab=refinery" label="Mở Duyệt sản phẩm" icon="📋" />
            <ShortcutLink href="/admin/niches" label="Quản lý Niche" icon="🗂" />
            <ShortcutLink href="/admin/products" label="Quản lý sản phẩm" icon="📦" />
            <ShortcutLink href="/admin/articles" label="Quản lý bài viết" icon="📰" />
            <ShortcutLink href="/admin/coupons" label="Mã giảm giá" icon="🎟" />
            <ShortcutLink href="/" label="Mở storefront" icon="🪟" external />
          </div>
        </SectionCard>
      </section>

      <CrawlerConsole />
    </div>
  );
}

function CrawlerConsole(): React.ReactElement {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <SectionCard
        title="Chạy crawler thủ công"
        eyebrow="Điều khiển crawler"
        description="Bỏ qua cron, kéo dữ liệu từ tất cả nguồn affiliate ngay bây giờ. Mất 30s–2 phút tùy số lượng."
      >
        <form action={runCrawlerNowFormAction}>
          <SubmitButton size="md" iconLeft={<Play />}>
            Chạy crawler ngay
          </SubmitButton>
        </form>
      </SectionCard>

      <SectionCard title="Paste URL sản phẩm → AI tự ingest" eyebrow="Import nhanh">
        <form action={ingestUrlAction} className="space-y-3">
          <TextField label="URL sản phẩm" name="url" required placeholder="https://shopee.vn/..." />
          <TextField
            label="Slug niche"
            name="nicheSlug"
            required
            mono
            placeholder="robot-hut-bui-lau-nha"
          />
          <TextField
            label="Affiliate URL (tùy chọn)"
            name="affiliateUrl"
            placeholder="Nếu khác URL gốc"
          />
          <SubmitButton size="md">Ingest URL</SubmitButton>
        </form>
      </SectionCard>
    </section>
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
    tone === "ok" ? "bg-emerald-500" : tone === "warning" ? "bg-amber-500" : "bg-rose-500";
  const inner = (
    <div className="flex items-center gap-3 rounded-lg border border-admin-line bg-admin-subtle/50 px-3 py-2.5 transition hover:bg-admin-subtle">
      <span aria-hidden className={`size-2 shrink-0 rounded-full ${dotClass}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-admin-ink">{title}</p>
        <p className="text-xs text-admin-mute">{hint}</p>
      </div>
      {count > 0 ? (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
            tone === "warning" ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-700"
          }`}
        >
          {count}
        </span>
      ) : (
        <span aria-hidden className="text-admin-mute">→</span>
      )}
    </div>
  );
  return href ? (
    <li>
      <Link href={href}>{inner}</Link>
    </li>
  ) : (
    <li>{inner}</li>
  );
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
  activePrompt
}: {
  activePrompt: ActivePromptResponse | null;
}): React.ReactElement {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <SectionCard
        title="Prompt đang active"
        eyebrow="Active"
        actions={
          activePrompt ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              v{activePrompt.version}
            </span>
          ) : null
        }
      >
        {activePrompt ? (
          <div className="space-y-2">
            <p className="font-semibold text-admin-ink">{activePrompt.name}</p>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-admin-line bg-admin-subtle p-4 text-xs leading-relaxed text-admin-ink">
              {activePrompt.content}
            </pre>
          </div>
        ) : (
          <p className="text-sm text-admin-mute">Chưa cấu hình prompt nào — hãy tạo bên phải.</p>
        )}
      </SectionCard>

      <SectionCard title="Tạo phiên bản mới" eyebrow="Save new version">
        <form action={savePromptAction} className="space-y-3">
          <TextField label="Tên prompt" name="name" placeholder="default-parser" />
          <TextField label="Người tạo" name="createdBy" placeholder="admin" />
          <TextareaField
            label="Nội dung prompt"
            name="content"
            mono
            rows={10}
            placeholder="You are an expert extraction agent..."
          />
          <label className="flex items-center gap-2 text-sm text-admin-ink">
            <input
              name="activateNow"
              type="checkbox"
              className="size-4 rounded border-admin-line text-admin-accent"
            />
            Activate ngay sau khi lưu
          </label>
          <SubmitButton size="md">Lưu prompt</SubmitButton>
        </form>
      </SectionCard>

      <div className="lg:col-span-2">
        <PromptTestClient />
      </div>
    </section>
  );
}
