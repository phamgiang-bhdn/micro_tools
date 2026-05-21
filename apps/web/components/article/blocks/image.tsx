"use client";

import { useEffect, useState } from "react";
import type React from "react";
import { X, ZoomIn } from "lucide-react";

interface Props {
  src: string;
  alt?: string;
  caption?: string;
  attribution?: string;
  attributionUrl?: string;
  width?: number;
  height?: number;
}

/**
 * Image block với 3 affordance đọc: caption italic editorial-style dưới ảnh,
 * hover zoom mượt, click → lightbox xem to (ESC + click outside để đóng).
 *
 * Pattern cellphones/sforum cho affiliate VN: caption dưới (không overlay) để
 * dễ đọc + ảnh giữ tinh khôi không bị che. Attribution clickable cuối caption.
 */
export function ImageBlock({
  src,
  alt,
  caption,
  attribution,
  attributionUrl,
  width,
  height
}: Props): React.ReactElement | null {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!src) return null;

  return (
    <figure className="my-6">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative block w-full overflow-hidden rounded-xl border border-line bg-card transition hover:shadow-lg"
        aria-label="Phóng to ảnh"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt ?? caption ?? ""}
          width={width}
          height={height}
          loading="lazy"
          className="block h-auto w-full cursor-zoom-in object-cover transition-transform duration-[600ms] ease-out group-hover:scale-[1.03]"
        />
        <span className="pointer-events-none absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
          <ZoomIn className="size-4" />
        </span>
      </button>

      {(caption || attribution) ? (
        <figcaption className="mt-2.5 text-center text-[12.5px] italic leading-relaxed text-ink-mute">
          {caption}
          {caption && attribution ? <span className="mx-1.5 not-italic">·</span> : null}
          {attribution ? (
            attributionUrl ? (
              <a
                href={attributionUrl}
                target="_blank"
                rel="noreferrer"
                className="not-italic underline-offset-2 hover:text-brand-700 hover:underline"
              >
                Ảnh: {attribution}
              </a>
            ) : (
              <span className="not-italic">Ảnh: {attribution}</span>
            )
          ) : null}
        </figcaption>
      ) : null}

      {open ? (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
            className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Đóng"
          >
            <X className="size-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt ?? caption ?? ""}
            className="max-h-[92vh] max-w-[96vw] rounded-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          {caption ? (
            <p className="absolute bottom-6 left-1/2 max-w-[90vw] -translate-x-1/2 rounded-md bg-black/60 px-4 py-2 text-center text-[13px] italic text-white/90 backdrop-blur-sm">
              {caption}
            </p>
          ) : null}
        </div>
      ) : null}
    </figure>
  );
}
