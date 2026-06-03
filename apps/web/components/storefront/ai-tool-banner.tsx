import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api/v1";

interface PublicTool {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  niche: { slug: string; name: string };
}

async function fetchActiveTools(): Promise<PublicTool[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/tool/active?limit=4`, { cache: "no-store" });
    if (!res.ok) return [];
    return (await res.json()) as PublicTool[];
  } catch {
    return [];
  }
}

export async function AiToolBanner(): Promise<React.ReactElement | null> {
  const tools = await fetchActiveTools();
  if (tools.length === 0) return null;

  const [primary, ...rest] = tools;
  if (!primary) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-3">
      <Link
        href={`/ai/${primary.slug}`}
        className="group block overflow-hidden rounded-2xl border border-line bg-brand-gradient p-4 text-white shadow-card transition hover:brightness-110 sm:p-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 sm:items-center">
            <Sparkles className="size-6 shrink-0 animate-pulse" />
            <div className="min-w-0">
              <div className="text-xs font-medium opacity-90">🤖 AI Tool mới</div>
              <p className="mt-0.5 text-base font-semibold sm:text-lg">
                {primary.tagline ?? `AI chọn ${primary.niche.name.toLowerCase()} trong 60 giây`}
              </p>
              <p className="mt-0.5 text-xs opacity-90 sm:text-sm">
                Trả 3 câu — AI gợi ý 3 sản phẩm hợp với bạn, kèm lý do.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 self-end rounded-full bg-white/20 px-4 py-2 text-sm font-medium group-hover:bg-white/30 sm:self-auto">
            Thử ngay <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
          </div>
        </div>

        {rest.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-white/20 pt-3 text-xs">
            <span className="opacity-80">Hoặc:</span>
            {rest.map((t) => (
              <Link
                key={t.id}
                href={`/ai/${t.slug}`}
                className="rounded-full bg-white/15 px-2.5 py-1 hover:bg-white/25"
                onClick={(e) => e.stopPropagation()}
              >
                {t.name}
              </Link>
            ))}
          </div>
        )}
      </Link>
    </div>
  );
}
