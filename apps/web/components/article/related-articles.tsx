import type React from "react";
import Link from "next/link";
import type { ArticleSummary } from "../../lib/types";

const dateFmt = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

interface Props {
  articles: ArticleSummary[];
  currentNicheName?: string;
}

export function RelatedArticles({ articles, currentNicheName }: Props): React.ReactElement | null {
  if (articles.length === 0) return null;

  return (
    <section className="mt-12 border-t border-line pt-10">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-ink">
          {currentNicheName ? `Bài liên quan trong ${currentNicheName}` : "Bài liên quan"}
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {articles.map((a) => (
          <Link
            key={a.id}
            href={`/blog/${a.slug}`}
            className="group overflow-hidden rounded-xl border border-line bg-card transition hover:border-brand-300 hover:shadow-md"
          >
            <div className="aspect-[16/10] overflow-hidden bg-card-soft">
              {a.coverImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.coverImage}
                  alt={a.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              ) : null}
            </div>
            <div className="p-3.5">
              <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-brand-600">
                {a.type === "REVIEW" ? "Đánh giá" : "Cẩm nang"}
                {a.niche ? <span className="text-ink-mute">· {a.niche.name}</span> : null}
              </div>
              <h3 className="mt-1.5 line-clamp-2 text-[14.5px] font-semibold leading-snug text-ink group-hover:text-brand-700">
                {a.title}
              </h3>
              {a.excerpt ? (
                <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-ink-mute">{a.excerpt}</p>
              ) : null}
              {a.publishedAt ? (
                <p className="mt-2 text-[11px] text-ink-mute">{dateFmt.format(new Date(a.publishedAt))}</p>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
