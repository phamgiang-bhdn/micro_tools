import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../../lib/utils";

/**
 * Button — design system V3.
 *  - `primary`   : blue, hành động chính (lưu, tiếp tục, xem chi tiết).
 *  - `cta`       : amber, CHỈ cho conversion ("Xem deal", "Mua ngay"). Đừng dùng tràn lan.
 *  - `secondary` : ink đậm, hành động phụ nổi bật.
 *  - `outline`   : viền, hành động trung tính.
 *  - `ghost`     : không nền, hành động nhẹ.
 *  - `danger`    : đỏ, hành động phá huỷ.
 *  - `brand`     : @deprecated alias → primary (giữ cho code cũ, xoá ở Phase 6).
 */
type Variant = "primary" | "cta" | "secondary" | "outline" | "ghost" | "danger" | "brand";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: Variant;
  size?: Size;
}

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:translate-y-px disabled:pointer-events-none disabled:opacity-40 ring-focus";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary-600 text-white shadow-card hover:bg-primary-700",
  cta: "bg-cta-500 text-ink shadow-card hover:bg-cta-400",
  secondary: "bg-ink text-white shadow-card hover:bg-ink-soft",
  outline: "border border-border-strong bg-surface text-ink hover:border-primary-400 hover:text-primary-700",
  ghost: "text-ink-soft hover:bg-surface-2",
  danger: "bg-danger text-white shadow-card hover:brightness-95",
  // deprecated → primary
  brand: "bg-primary-600 text-white shadow-card hover:bg-primary-700"
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-5 text-sm min-w-[7.5rem]",
  lg: "h-12 px-6 text-base"
};

export function Button({
  className,
  asChild = false,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps): React.ReactElement {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...props} />;
}
