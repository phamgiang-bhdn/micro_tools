import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchNicheBySlug } from "../../../lib/api";
import { WaitlistForm } from "./waitlist-form";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ source?: string }>;
}

const SURVEY_OPTIONS_BY_NICHE: Record<string, string[]> = {
  "may-loc-nuoc": ["RO truyền thống", "RO + bù khoáng", "Nano / UF", "Chưa biết"],
  "may-loc-khong-khi": ["Phòng ngủ < 25m²", "Phòng khách 25-50m²", "Phòng lớn > 50m²", "Chưa biết"],
  "robot-hut-bui": ["Chỉ hút", "Hút + lau", "Hút + lau + base tự đổ", "Chưa biết"],
  "may-rua-bat": ["Độc lập 14 bộ", "Âm tủ 13 bộ", "Mini 6-8 bộ", "Chưa biết"]
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const niche = await fetchNicheBySlug(slug);
  const name = niche?.name ?? "sản phẩm";
  return {
    title: `Sắp ra mắt: AI chọn ${name} — DealVault`,
    description: `Đăng ký để được thông báo khi AI tool giúp chọn ${name.toLowerCase()} phù hợp ra mắt. Không spam, có nút unsubscribe.`,
    openGraph: {
      title: `🤖 AI chọn ${name} sắp ra mắt — DealVault`,
      description: `Mô tả nhu cầu — AI gợi ý 3 sản phẩm phù hợp nhất trong 60 giây.`,
      type: "website"
    },
    twitter: {
      card: "summary_large_image",
      title: `🤖 AI chọn ${name} sắp ra mắt`,
      description: `Đăng ký để nhận thông báo khi tool ra mắt.`
    }
  };
}

export default async function ComingSoonPage({
  params,
  searchParams
}: PageProps): Promise<React.ReactElement> {
  const { slug } = await params;
  const { source } = await searchParams;
  const niche = await fetchNicheBySlug(slug);

  if (!niche) {
    notFound();
  }

  const surveyOptions = SURVEY_OPTIONS_BY_NICHE[slug] ?? [];
  const nicheName = niche.name;

  return (
    <main className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
        <Link href="/" className="text-sm text-ink-soft hover:text-ink">
          ← DealVault
        </Link>

        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-4 py-1.5 text-xs font-medium text-white">
            🤖 Sắp ra mắt
          </div>
          <h1 className="mt-4 text-3xl font-bold text-ink sm:text-4xl">
            AI chọn {nicheName.toLowerCase()} <br />
            <span className="text-primary-600">phù hợp với nhà bạn</span>
          </h1>
          <p className="mt-4 text-base text-ink-soft">
            Mô tả nhu cầu trong 1-2 câu — AI gợi ý 3 sản phẩm hợp nhất, kèm lý do
            cho từng lựa chọn. Không phải catalog, không phải quảng cáo.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-3 text-center text-xs">
          <Pillar icon="🎯" label="Phân tích theo nhu cầu thật" />
          <Pillar icon="🤖" label="AI gợi ý có lý do" />
          <Pillar icon="✓" label="Sản phẩm đã admin duyệt" />
        </div>

        <section className="mt-10 rounded-3xl border border-line bg-white p-6 shadow-card sm:p-8">
          <h2 className="text-xl font-semibold text-ink">
            Nhận thông báo khi tool ra mắt
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Chỉ {/* eslint-disable-next-line react/no-unescaped-entities */}
            <span className="font-medium text-ink">1 email duy nhất</span> khi tool sẵn sàng — không spam.
          </p>

          <div className="mt-5">
            <WaitlistForm
              nicheSlug={slug}
              nicheName={nicheName}
              source={source}
              surveyOptions={surveyOptions}
            />
          </div>
        </section>

        <section className="mt-10 rounded-2xl bg-white/50 p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
            Tool sẽ hoạt động như nào?
          </h3>
          <ol className="mt-4 space-y-3 text-sm text-ink">
            <li className="flex gap-3">
              <span className="font-bold text-primary-600">1.</span>
              <span>
                Bạn trả lời <span className="font-semibold">3-5 câu</span> đơn giản (số người
                dùng, ngân sách, nguồn nước...) hoặc mô tả tự nhiên.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-primary-600">2.</span>
              <span>
                AI phân tích từ <span className="font-semibold">database spec thật</span> +
                giá hôm nay từ Tiki/Shopee/Lazada.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-primary-600">3.</span>
              <span>
                Nhận <span className="font-semibold">3 gợi ý kèm lý do AI</span> giải thích
                vì sao hợp với bạn — không phải bài review chung chung.
              </span>
            </li>
          </ol>
        </section>

        <p className="mt-8 text-center text-xs text-ink-soft">
          DealVault — Affiliate disclosure: chúng tôi nhận hoa hồng từ sàn khi bạn mua qua
          link, nhưng đề xuất dựa trên spec + nhu cầu của bạn, không theo số tiền hoa hồng.
        </p>
      </div>
    </main>
  );
}

function Pillar({ icon, label }: { icon: string; label: string }): React.ReactElement {
  return (
    <div className="rounded-2xl border border-line bg-white p-3">
      <div className="text-2xl">{icon}</div>
      <div className="mt-1 text-ink-soft">{label}</div>
    </div>
  );
}
