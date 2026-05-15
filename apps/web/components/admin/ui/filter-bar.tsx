import type React from "react";
import Link from "next/link";
import { Filter, X } from "lucide-react";
import { AdminButton, AdminLinkButton } from "./admin-button";
import { cn } from "../../../lib/utils";

interface FilterBarProps {
  action?: string;
  hiddenFields?: Record<string, string | undefined>;
  resetHref: string;
  children: React.ReactNode;
  extraActions?: React.ReactNode;
  className?: string;
}

/**
 * Filter form chuẩn: GET form với các field con + nút Lọc/Xoá lọc.
 * Mọi list page bọc filter inputs trong đây — nếu cần Select rich, dùng
 * `<NativeFilterSelect>` bên dưới (giữ tương thích form GET).
 */
export function FilterBar({
  action,
  hiddenFields,
  resetHref,
  children,
  extraActions,
  className
}: FilterBarProps): React.ReactElement {
  return (
    <form
      method="get"
      action={action}
      className={cn("admin-card flex flex-wrap items-end gap-3 p-4", className)}
    >
      {hiddenFields
        ? Object.entries(hiddenFields).map(([k, v]) =>
            v ? <input key={k} type="hidden" name={k} value={v} /> : null
          )
        : null}
      {children}
      <div className="ml-auto flex flex-wrap items-end gap-2">
        <AdminButton type="submit" size="md" iconLeft={<Filter />}>
          Lọc
        </AdminButton>
        <AdminLinkButton href={resetHref} variant="outline" size="md" iconLeft={<X />}>
          Xoá
        </AdminLinkButton>
        {extraActions}
      </div>
    </form>
  );
}

/**
 * Native `<select>` cho FilterBar (vì FilterBar là <form method="get">, Radix Select
 * không tự submit value qua name). Style đồng nhất với `adminInputClass`.
 */
interface NativeFilterSelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: React.ReactNode;
  options: Array<{ value: string; label: string }>;
  /** Option "Tất cả" mặc định prepended. */
  includeAll?: boolean;
  allLabel?: string;
}

export function NativeFilterSelect({
  label,
  options,
  includeAll = true,
  allLabel = "Tất cả",
  className,
  id,
  name,
  ...props
}: NativeFilterSelectProps): React.ReactElement {
  const selId = id ?? name;
  return (
    <div className="space-y-1">
      <label htmlFor={selId} className="text-xs font-semibold text-admin-ink">
        {label}
      </label>
      <select
        id={selId}
        name={name}
        className={cn(
          "h-10 min-w-[10rem] rounded-lg border border-admin-line bg-admin-surface px-3 pr-8 text-sm text-admin-ink focus:border-admin-accent focus:outline-none focus:ring-2 focus:ring-admin-accent/20",
          className
        )}
        {...props}
      >
        {includeAll ? <option value="">{allLabel}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface FilterTextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: React.ReactNode;
}

export function NativeFilterInput({
  label,
  className,
  id,
  name,
  ...props
}: FilterTextInputProps): React.ReactElement {
  const inputId = id ?? name;
  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="text-xs font-semibold text-admin-ink">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        className={cn(
          "h-10 w-56 rounded-lg border border-admin-line bg-admin-surface px-3 text-sm text-admin-ink focus:border-admin-accent focus:outline-none focus:ring-2 focus:ring-admin-accent/20",
          className
        )}
        {...props}
      />
    </div>
  );
}

interface FilterPillsProps {
  pills: Array<{ href: string; label: string; active: boolean; tone?: "default" | "accent" }>;
  separator?: React.ReactNode;
}

export function FilterPills({ pills, separator }: FilterPillsProps): React.ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {pills.map((p, idx) => (
        <span key={`${p.href}-${idx}`} className="contents">
          {idx > 0 && separator && idx === Math.floor(pills.length / 2) ? (
            <span className="mx-1 self-center text-admin-mute">{separator}</span>
          ) : null}
          <Link
            href={p.href}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition",
              p.active
                ? "border-admin-accent bg-admin-accent text-white shadow-sm"
                : "border-admin-line bg-admin-surface text-admin-mute hover:border-admin-accent hover:text-admin-accent"
            )}
          >
            {p.label}
          </Link>
        </span>
      ))}
    </div>
  );
}
