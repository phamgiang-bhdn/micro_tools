import Link from "next/link";
import { fetchWeeklyOpportunities } from "../../../app/admin/actions";

/**
 * STORY-04: "Cơ hội tuần" widget. Click 1 row → /admin/articles/new prefilled.
 */
export async function CommissionKeywordWidget() {
  let opps;
  try {
    opps = await fetchWeeklyOpportunities(5);
  } catch {
    opps = [];
  }

  if (opps.length === 0) {
    return (
      <div className="rounded-xl border border-admin-line bg-admin-surface p-5">
        <h3 className="text-base font-semibold text-admin-ink">🔥 Cơ hội tuần</h3>
        <p className="mt-2 text-sm text-admin-mute">
          Chưa có dữ liệu. Click "Đồng bộ tất cả" để fetch lần đầu (commission_rank + keyword_radar).
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-admin-line bg-admin-surface p-5">
      <h3 className="text-base font-semibold text-admin-ink">🔥 Cơ hội tuần</h3>
      <p className="mt-0.5 text-xs text-admin-mute">
        Niche × merchant trả % cao + keyword đang hot + chưa có article.
      </p>
      <ol className="mt-4 space-y-3">
        {opps.map((opp, i) => {
          const href =
            `/admin/articles/new?niche=${encodeURIComponent(opp.nicheSlug)}` +
            `&topic=${encodeURIComponent(opp.hotKeywords[0] ?? opp.nicheName)}` +
            `&merchant=${encodeURIComponent(opp.merchant)}` +
            `&commissionHint=${encodeURIComponent(opp.commissionRange)}`;
          return (
            <li
              key={`${opp.nicheSlug}-${opp.merchant}`}
              className="rounded-lg border border-admin-line bg-admin-surface-2 p-3"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-admin-accent text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-admin-ink">
                    {opp.nicheName} × {opp.merchant.toUpperCase()}
                  </p>
                  <p className="mt-0.5 text-xs text-admin-mute">
                    Commission{" "}
                    <span className="font-medium text-admin-success">
                      {opp.commissionRange}
                    </span>{" "}
                    • {opp.productCount} sản phẩm sẵn
                    {!opp.hasArticle ? " • chưa có article" : ""}
                  </p>
                  {opp.hotKeywords.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {opp.hotKeywords.slice(0, 3).map((kw) => (
                        <span
                          key={kw}
                          className="rounded-full bg-admin-subtle px-2 py-0.5 text-[10px] text-admin-ink-soft"
                        >
                          🔥 {kw}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <Link
                    href={href}
                    className="mt-2 inline-flex items-center gap-1 rounded-md bg-admin-accent px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90"
                  >
                    Tạo bài →
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
