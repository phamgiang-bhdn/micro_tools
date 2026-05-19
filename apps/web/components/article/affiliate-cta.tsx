import type React from "react";
import { affiliateRedirectAction } from "../../app/actions/affiliate";

interface Props {
  productId: string;
  affiliateUrl: string;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "ghost";
  label?: string;
  className?: string;
  store?: string;
}

/**
 * Nút CTA "Xem deal" dùng chung trong article. Server-action ở file riêng để có thể render
 * trong cả Server Component và Client Component tree (article-v2-client preview).
 */
export function AffiliateCta({
  productId,
  affiliateUrl,
  size = "md",
  variant = "primary",
  label = "Xem deal",
  className = "",
  store
}: Props): React.ReactElement {
  const buy = affiliateRedirectAction.bind(null, productId, affiliateUrl);

  const sizeClasses =
    size === "lg"
      ? "px-5 py-3 text-sm"
      : size === "sm"
        ? "px-3 py-1.5 text-xs"
        : "px-4 py-2.5 text-sm";

  const variantClasses =
    variant === "ghost"
      ? "border border-line bg-card text-ink-soft hover:border-brand-300 hover:text-brand-700"
      : "bg-brand-gradient text-white shadow-glow-sm hover:shadow-glow";

  return (
    <form action={buy} className="inline-flex">
      <button
        type="submit"
        className={`inline-flex items-center gap-1.5 rounded-full font-semibold transition ${sizeClasses} ${variantClasses} ${className}`}
      >
        {label}
        {store ? <span className="text-[10px] font-normal opacity-80">· {store}</span> : null}
        <ArrowIcon />
      </button>
    </form>
  );
}

function ArrowIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}
