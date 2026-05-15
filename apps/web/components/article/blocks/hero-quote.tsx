import type React from "react";

interface Props {
  text: string;
  attribution?: string;
}

export function HeroQuoteBlock({ text, attribution }: Props): React.ReactElement {
  return (
    <figure className="relative my-2 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-500 to-accent-500 px-7 py-9 text-white shadow-lg sm:px-12 sm:py-12">
      <span
        aria-hidden
        className="pointer-events-none absolute -left-2 -top-2 select-none text-[180px] font-bold leading-none text-white/15 sm:text-[220px]"
      >
        “
      </span>
      <blockquote className="relative text-xl font-medium leading-relaxed text-white sm:text-2xl">
        {text}
      </blockquote>
      {attribution ? (
        <figcaption className="relative mt-5 text-sm font-medium text-white/80">— {attribution}</figcaption>
      ) : null}
    </figure>
  );
}
