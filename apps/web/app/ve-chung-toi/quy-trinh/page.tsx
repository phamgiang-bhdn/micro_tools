import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  Database,
  Users,
  Sparkles,
  Eye,
  ShieldCheck
} from "lucide-react";
import {
  PageContainer,
  PageSection,
  SectionHeading
} from "../../../components/ui/section";
import { Breadcrumb } from "../../../components/ui/breadcrumb";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Quy trình duyệt sản phẩm — DealVault AI có lừa không?",
  description:
    "DealVault không phải content farm AI. Mọi sản phẩm trên storefront đều qua quy trình HITL (Human-in-the-Loop) — admin duyệt từng spec + giá trước khi public. AI chỉ dùng để gợi ý cá nhân hóa, không bịa thông tin.",
  alternates: { canonical: "/ve-chung-toi/quy-trinh" },
  openGraph: {
    title: "Quy trình duyệt sản phẩm — DealVault",
    description: "Vì sao đề xuất AI của DealVault đáng tin? HITL pipeline + AI grounding.",
    type: "article"
  }
};

const STEPS = [
  {
    icon: <Database className="size-5" />,
    title: "1. Crawler tự động",
    body: "Mỗi 6 giờ, bot DealVault quét hơn 47 chiến dịch Accesstrade để lấy datafeed sản phẩm mới nhất: tên, giá, ảnh, link affiliate, spec gốc từ trang chính hãng."
  },
  {
    icon: <Sparkles className="size-5" />,
    title: "2. AI extract spec",
    body: "AI (Gemini) đọc text mô tả sản phẩm, trích về JSON có cấu trúc theo schema riêng cho từng ngành hàng — không bịa, không suy đoán. Mỗi extract có confidence score 0-100."
  },
  {
    icon: <Users className="size-5" />,
    title: "3. Admin duyệt thủ công",
    body: "Bất kỳ extract nào dưới ngưỡng tin cậy đều rơi vào hàng đợi PENDING_REVIEW. Người thật (không phải bot) đọc lại, sửa sai, hoặc reject."
  },
  {
    icon: <Eye className="size-5" />,
    title: "4. PUBLISHED",
    body: "Chỉ những sản phẩm đã admin xác nhận mới hiện trên storefront và được AI Tool gợi ý cho bạn. Nếu giá đổi hoặc hết hàng, hệ thống tự đánh dấu lại."
  },
  {
    icon: <ShieldCheck className="size-5" />,
    title: "5. AI gợi ý cá nhân hóa",
    body: "Khi bạn dùng AI Tool, gợi ý dựa trên scoring engine (rule-based, deterministic) + AI reasoning bị giới hạn phải tham chiếu ≥1 thông tin cụ thể từ nhu cầu bạn nhập. Không có chuyện AI bịa lý do."
  }
];

const PRINCIPLES = [
  {
    title: "Không content farm AI",
    body: "Mọi bài viết blog hay product card đều qua HITL. Không auto-publish."
  },
  {
    title: "Không che giấu điểm trừ",
    body: "AI bắt buộc nêu cả điểm yếu của sản phẩm trong reasoning. Không bốc thơm mù quáng."
  },
  {
    title: "Không rank theo hoa hồng",
    body: "Ranking dựa trên scoring rules (số người, ngân sách, nguồn nước…) — KHÔNG theo số tiền hoa hồng từ sàn."
  },
  {
    title: "Affiliate minh bạch",
    body: "Mọi link \"Xem giá\" đều là affiliate (chúng tôi có thể nhận hoa hồng nếu bạn mua). Không che, không thay thế bằng link \"sạch\"."
  },
  {
    title: "Cập nhật giá hàng tuần",
    body: "Cron mỗi 6h kiểm tra inventory + giá từ Tiki/Shopee/Lazada. Sản phẩm hết hàng sẽ tự ẩn khỏi AI gợi ý."
  }
];

export default function ProcessPage(): React.ReactElement {
  return (
    <main className="min-h-screen bg-canvas">
      <PageSection padding="default">
        <PageContainer>
          <Breadcrumb
            items={[
              { label: "Trang chủ", href: "/" },
              { label: "Về chúng tôi", href: "/ve-chung-toi" },
              { label: "Quy trình duyệt sản phẩm" }
            ]}
          />

          <div className="mt-6 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-700">
              Quy trình HITL
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              DealVault AI có lừa không?
            </h1>
            <p className="mt-4 text-base text-ink-soft sm:text-lg">
              Câu trả lời ngắn:{" "}
              <strong className="text-ink">
                Mọi sản phẩm trong database đều qua người thật duyệt
              </strong>{" "}
              trước khi AI được phép gợi ý cho bạn. AI chỉ làm phần "match nhu cầu của bạn với
              sản phẩm có sẵn" + viết lý do — không bịa giá, không bịa thông số.
            </p>
          </div>

          <SectionHeading className="mt-12">5 bước từ Accesstrade → AI gợi ý</SectionHeading>

          <ol className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((step) => (
              <li
                key={step.title}
                className="rounded-2xl border border-line bg-white p-5 shadow-card"
              >
                <div className="inline-flex size-10 items-center justify-center rounded-full bg-primary-600/10 text-primary-600">
                  {step.icon}
                </div>
                <h3 className="mt-3 font-semibold text-ink">{step.title}</h3>
                <p className="mt-1.5 text-sm text-ink-soft">{step.body}</p>
              </li>
            ))}
          </ol>

          <SectionHeading className="mt-14">5 nguyên tắc minh bạch</SectionHeading>

          <ul className="mt-6 space-y-3">
            {PRINCIPLES.map((p) => (
              <li
                key={p.title}
                className="flex gap-3 rounded-xl border border-line bg-white p-4"
              >
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-accent" />
                <div>
                  <h4 className="font-semibold text-ink">{p.title}</h4>
                  <p className="mt-0.5 text-sm text-ink-soft">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>

          <section className="mt-14 rounded-3xl border border-primary-600/20 bg-primary-600/5 p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-ink sm:text-2xl">
              Vì sao chúng tôi không sợ minh bạch?
            </h2>
            <div className="mt-4 space-y-3 text-sm text-ink sm:text-base">
              <p>
                Affiliate site truyền thống ở VN thường có 2 vấn đề: (1) AI auto-publish
                hàng nghìn bài chất lượng thấp để cố ăn SEO, (2) ranking thiên về sản phẩm trả
                hoa hồng cao thay vì sản phẩm thực sự phù hợp.
              </p>
              <p>
                DealVault chọn ngược: <strong>ít sản phẩm hơn nhưng tin được hơn</strong>. Mỗi
                ngành hàng chúng tôi duyệt 30-50 sản phẩm — đủ cho AI Tool gợi ý chính xác,
                không phải catalog 10.000 SKU mà bạn không biết chọn cái nào.
              </p>
              <p>
                Nếu bạn phát hiện thông tin sai (giá lệch, spec không đúng), email
                <a
                  href="mailto:hello@dealvault.vn"
                  className="ml-1 font-medium text-primary-600 hover:underline"
                >
                  hello@dealvault.vn
                </a>{" "}
                — chúng tôi fix trong 24h và ghi nhận tên bạn ở changelog.
              </p>
            </div>
          </section>

          <div className="mt-10 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-6 py-3 text-sm font-medium text-white shadow-glow hover:brightness-110"
            >
              <Sparkles className="size-4" />
              Thử AI Tool ngay
            </Link>
          </div>
        </PageContainer>
      </PageSection>
    </main>
  );
}
