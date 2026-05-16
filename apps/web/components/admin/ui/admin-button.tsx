import * as React from "react";
import Link from "next/link";
import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { cn } from "../../../lib/utils";

/**
 * Single canonical button cho mọi /admin. Hỗ trợ:
 *  - 6 variants (primary, secondary, outline, ghost, danger, subtle)
 *  - 4 sizes (xs, sm, md, lg)
 *  - icon left / right (lucide hoặc bất kỳ ReactNode)
 *  - loading state (đè text bằng spinner, disable click)
 *
 * Có thể render từ server component (không có "use client" ở đây). Nếu cần
 * auto-loading theo `useFormStatus`, dùng `SubmitButton` ở confirm-button.tsx
 * (client component) thay vì hook trực tiếp.
 *
 * Đừng tạo custom button styles mới — extend file này nếu thiếu variant.
 */
export type AdminButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "subtle";
export type AdminButtonSize = "xs" | "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition active:translate-y-px disabled:pointer-events-none disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/40 whitespace-nowrap";

const VARIANTS: Record<AdminButtonVariant, string> = {
  primary: "bg-admin-accent text-white shadow-sm hover:bg-admin-accent/90",
  secondary: "bg-admin-ink text-white hover:bg-admin-ink/90",
  outline:
    "border border-admin-line bg-admin-surface text-admin-ink hover:border-admin-accent hover:text-admin-accent",
  ghost: "text-admin-mute hover:bg-admin-subtle hover:text-admin-ink",
  danger: "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
  subtle: "bg-admin-subtle text-admin-ink hover:bg-admin-subtle/70"
};

const SIZES: Record<AdminButtonSize, string> = {
  xs: "h-7 rounded-md px-2 text-[11px] [&_svg]:size-3",
  sm: "h-8 rounded-md px-3 text-xs [&_svg]:size-3.5",
  md: "h-10 px-5 text-sm [&_svg]:size-4",
  lg: "h-11 px-6 text-sm [&_svg]:size-4"
};

interface BaseStyleProps {
  variant?: AdminButtonVariant;
  size?: AdminButtonSize;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  /** Hiện spinner đè + disable. */
  loading?: boolean;
  /** Text override khi loading. Mặc định giữ children. */
  loadingLabel?: React.ReactNode;
}

export interface AdminButtonProps
  extends BaseStyleProps,
    React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export const AdminButton = React.forwardRef<HTMLButtonElement, AdminButtonProps>(function AdminButton(
  {
    variant = "primary",
    size = "md",
    asChild = false,
    className,
    children,
    iconLeft,
    iconRight,
    loading,
    loadingLabel,
    disabled,
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading;
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      ref={ref as React.Ref<HTMLButtonElement>}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      disabled={isDisabled}
      data-loading={loading || undefined}
      {...props}
    >
      <ButtonInner
        isLoading={Boolean(loading)}
        iconLeft={iconLeft}
        iconRight={iconRight}
        loadingLabel={loadingLabel}
      >
        {children}
      </ButtonInner>
    </Comp>
  );
});

/** Shared inner — export để SubmitButton trong confirm-button.tsx tái dùng. */
export function ButtonInner({
  isLoading,
  iconLeft,
  iconRight,
  loadingLabel,
  children
}: {
  isLoading: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  loadingLabel?: React.ReactNode;
  children: React.ReactNode;
}): React.ReactElement {
  if (isLoading) {
    return (
      <>
        <Loader2 aria-hidden className="animate-spin" />
        <span>{loadingLabel ?? children}</span>
      </>
    );
  }
  return (
    <>
      {iconLeft ? <span aria-hidden className="inline-flex">{iconLeft}</span> : null}
      <span>{children}</span>
      {iconRight ? <span aria-hidden className="inline-flex">{iconRight}</span> : null}
    </>
  );
}

interface AdminLinkButtonProps
  extends BaseStyleProps,
    Omit<React.ComponentProps<typeof Link>, "className"> {
  className?: string;
  children: React.ReactNode;
}

export function AdminLinkButton({
  variant = "primary",
  size = "md",
  className,
  children,
  iconLeft,
  iconRight,
  loading,
  loadingLabel,
  ...props
}: AdminLinkButtonProps): React.ReactElement {
  return (
    <Link className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...props}>
      <ButtonInner
        isLoading={Boolean(loading)}
        iconLeft={iconLeft}
        iconRight={iconRight}
        loadingLabel={loadingLabel}
      >
        {children}
      </ButtonInner>
    </Link>
  );
}

/** Pure style constants — dùng nếu bạn buộc phải render thẻ khác mà vẫn cần khớp button style. */
export const ADMIN_BUTTON_STYLES = { BASE, VARIANTS, SIZES };
