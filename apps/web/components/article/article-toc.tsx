"use client";

import { useEffect, useState } from "react";
import type { ArticleSectionPublic } from "../../lib/types";

interface Props {
  sections: ArticleSectionPublic[];
}

export function ArticleToc({ sections }: Props) {
  const [activeId, setActiveId] = useState<string | null>(sections[0]?.anchorSlug ?? null);

  useEffect(() => {
    if (typeof window === "undefined" || sections.length === 0) return;
    const observers: IntersectionObserver[] = [];
    const visible = new Map<string, number>();

    const cb: IntersectionObserverCallback = (entries) => {
      for (const e of entries) {
        const id = (e.target as HTMLElement).id;
        if (!id) continue;
        if (e.isIntersecting) visible.set(id, e.intersectionRatio);
        else visible.delete(id);
      }
      if (visible.size > 0) {
        let top: { id: string; ratio: number } | null = null;
        for (const [id, ratio] of visible) {
          if (!top || ratio > top.ratio) top = { id, ratio };
        }
        if (top) setActiveId(top.id);
      }
    };

    const observer = new IntersectionObserver(cb, {
      rootMargin: "-80px 0px -60% 0px",
      threshold: [0, 0.25, 0.5, 0.75, 1]
    });
    for (const s of sections) {
      const el = document.getElementById(s.anchorSlug);
      if (el) observer.observe(el);
    }
    observers.push(observer);
    return () => observers.forEach((o) => o.disconnect());
  }, [sections]);

  if (sections.length === 0) return null;

  return (
    <nav aria-label="Mục lục bài viết" className="lg:sticky lg:top-24">
      <p className="mb-3 text-micro font-semibold uppercase tracking-wider text-primary-700">Trong bài</p>
      <ol className="space-y-0.5">
        {sections.map((s, idx) => {
          const active = activeId === s.anchorSlug;
          return (
            <li key={s.id}>
              <a
                href={`#${s.anchorSlug}`}
                title={s.summary || s.heading}
                className={`group flex items-start gap-2 rounded-md py-1.5 pl-2.5 pr-2 text-body-sm leading-snug transition ${
                  active
                    ? "border-l-2 border-primary-600 bg-primary-50/60 pl-[10px] font-semibold text-primary-800"
                    : "border-l-2 border-transparent text-ink-soft hover:bg-card hover:text-ink"
                }`}
              >
                <span className={`mt-0.5 inline-block w-4 shrink-0 text-micro tabular-nums ${active ? "text-primary-600" : "text-ink-mute"}`}>
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span className="line-clamp-2">{s.heading}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
