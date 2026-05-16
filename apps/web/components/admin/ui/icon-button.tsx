"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { Tooltip } from "./tooltip";
import { cn } from "../../../lib/utils";

/**
 * Square-ish button chỉ chứa icon. Có tooltip bắt buộc (accessibility — screen reader
 * vẫn cần label, ta dùng `aria-label`). Replaces các button text ngắn lặp như "Sửa", "Xoá"
 * trong cell action — gọn hơn, đỡ rối.
 */
type Variant = "default" | "ghost" | "danger" | "outline";
type Size = "sm" | "md";

const VARIANT: Record<Variant, string> = {
  default: "bg-admin-subtle text-admin-ink hover:bg-admin-line",
  ghost: "text-admin-mute hover:bg-admin-subtle hover:text-admin-ink",
  danger: "text-rose-600 hover:bg-rose-50 hover:text-rose-700",
  outline: "border border-admin-line bg-admin-surface text-admin-ink hover:border-admin-accent hover:text-admin-accent"
};

const SIZE: Record<Size, string> = {
  sm: "size-7 rounded-md [&_svg]:size-3.5",
  md: "size-9 rounded-lg [&_svg]:size-4"
};

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Tooltip + aria-label. Bắt buộc cho accessibility. */
  label: string;
  variant?: Variant;
  size?: Size;
  /** Vị trí tooltip — mặc định trên. */
  tooltipSide?: "top" | "right" | "bottom" | "left";
  asChild?: boolean;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = "ghost", size = "sm", tooltipSide = "top", className, children, asChild, ...props },
  ref
) {
  const Comp = asChild ? Slot : "button";
  const btn = (
    <Comp
      ref={ref as React.Ref<HTMLButtonElement>}
      type={asChild ? undefined : props.type ?? "button"}
      aria-label={label}
      className={cn(
        "inline-flex items-center justify-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/40",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANT[variant],
        SIZE[size],
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  );

  return (
    <Tooltip content={label} side={tooltipSide}>
      {btn}
    </Tooltip>
  );
});
