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
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-700">Trong bài</p>
      <ol className="space-y-1.5">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.anchorSlug}`}
              className={`block rounded-md px-2.5 py-1.5 text-sm leading-snug transition ${
                activeId === s.anchorSlug
                  ? "bg-brand-50 text-brand-800 font-semibold"
                  : "text-ink-soft hover:bg-card hover:text-ink"
              }`}
            >
              <span className="block">{s.heading}</span>
              <span className="mt-0.5 line-clamp-2 text-[11.5px] text-ink-soft/80">{s.summary}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
