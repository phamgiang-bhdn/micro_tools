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
      className={cn(
        "admin-card flex flex-wrap items-center gap-2 px-3 py-2",
        className
      )}
    >
      {hiddenFields
        ? Object.entries(hiddenFields).map(([k, v]) =>
            v ? <input key={k} type="hidden" name={k} value={v} /> : null
          )
        : null}
      {children}
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <AdminButton type="submit" size="sm" iconLeft={<Filter />}>
          Lọc
        </AdminButton>
        <AdminLinkButton href={resetHref} variant="outline" size="sm" iconLeft={<X />}>
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
  /** Label → render thành option "— {label} —" placeholder để user biết field này lọc gì. */
  label: React.ReactNode;
  options: Array<{ value: string; label: string }>;
  /** Option "Tất cả" mặc định prepended (đã chứa label như placeholder). */
  includeAll?: boolean;
  allLabel?: string;
}

export function NativeFilterSelect({
  label,
  options,
  includeAll = true,
  allLabel,
  className,
  id,
  name,
  ...props
}: NativeFilterSelectProps): React.ReactElement {
  const selId = id ?? name;
  const placeholder = allLabel ?? (typeof label === "string" ? `Tất cả: ${label}` : "Tất cả");
  return (
    <select
      id={selId}
      name={name}
      title={typeof label === "string" ? label : undefined}
      aria-label={typeof label === "string" ? label : undefined}
      className={cn(
        "h-9 min-w-[10rem] rounded-md border border-admin-line bg-admin-surface px-3 pr-8 text-sm text-admin-ink focus:border-admin-accent focus:outline-none focus:ring-2 focus:ring-admin-accent/20",
        className
      )}
      {...props}
    >
      {includeAll ? <option value="">{placeholder}</option> : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

interface FilterTextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Label → set thành placeholder + title nếu placeholder không truyền. */
  label: React.ReactNode;
}

export function NativeFilterInput({
  label,
  className,
  id,
  name,
  placeholder,
  ...props
}: FilterTextInputProps): React.ReactElement {
  const inputId = id ?? name;
  const ph = placeholder ?? (typeof label === "string" ? label : undefined);
  return (
    <input
      id={inputId}
      name={name}
      placeholder={ph}
      title={typeof label === "string" ? label : undefined}
      aria-label={typeof label === "string" ? label : undefined}
      className={cn(
        "h-9 w-56 rounded-md border border-admin-line bg-admin-surface px-3 text-sm text-admin-ink placeholder:text-admin-mute focus:border-admin-accent focus:outline-none focus:ring-2 focus:ring-admin-accent/20",
        className
      )}
      {...props}
    />
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
