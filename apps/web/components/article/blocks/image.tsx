import type React from "react";

interface Props {
  src: string;
  alt?: string;
  caption?: string;
  attribution?: string;
  attributionUrl?: string;
  width?: number;
  height?: number;
}

export function ImageBlock({ src, alt, caption, attribution, attributionUrl, width, height }: Props): React.ReactElement | null {
  if (!src) return null;
  return (
    <figure className="my-2">
      {/* Wrapper relative để caption chip nổi góc phải dưới ảnh — pattern như cellphones/sforum.
          Caption ngắn = mini-title; attribution nhỏ hơn ở dưới ảnh. */}
      <div className="relative overflow-hidden rounded-xl border border-line bg-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt ?? caption ?? ""}
          width={width}
          height={height}
          loading="lazy"
          className="block h-auto w-full object-cover"
        />
        {caption ? (
          <span className="pointer-events-none absolute right-3 bottom-3 max-w-[80%] rounded-md bg-white/95 px-3 py-1.5 text-[12.5px] font-medium text-ink shadow-md backdrop-blur-sm sm:right-4 sm:bottom-4 sm:text-[13px]">
            {caption}
          </span>
        ) : null}
      </div>
      {attribution ? (
        <figcaption className="mt-1.5 text-right text-[11.5px] leading-relaxed text-ink-mute">
          {attributionUrl ? (
            <a href={attributionUrl} target="_blank" rel="noreferrer" className="hover:underline">
              Ảnh: {attribution}
            </a>
          ) : (
            <span>Ảnh: {attribution}</span>
          )}
        </figcaption>
      ) : null}
    </figure>
  );
}
