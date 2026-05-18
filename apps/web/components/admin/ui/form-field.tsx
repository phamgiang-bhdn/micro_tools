import type React from "react";
import { cn } from "../../../lib/utils";

/**
 * Input base — chuẩn cao 38px, padding ngang 12px (10px khi compact), focus ring rõ.
 * Mọi field trong /admin (kể cả dialog quản lí niche) đều dùng class này — không tự
 * viết className ad-hoc trong dialog tránh mỗi nơi 1 size.
 */
const INPUT_BASE =
  "block w-full rounded-lg border border-admin-line bg-admin-surface px-3 py-2 text-[13.5px] leading-snug text-admin-ink placeholder:text-admin-mute-soft transition focus:border-admin-accent focus:outline-none focus:ring-4 focus:ring-admin-accent/15 hover:border-admin-line-strong disabled:cursor-not-allowed disabled:bg-admin-subtle disabled:opacity-70";

export const adminInputClass = INPUT_BASE;
export const adminInputMonoClass = cn(INPUT_BASE, "font-mono text-[12.5px]");
export const adminInputCompactClass = cn(INPUT_BASE, "py-1.5 text-[13px]");

interface FieldProps {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  required?: boolean;
  error?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/**
 * Field wrapper: label rõ ràng (13px semibold) → gap 6px → input → hint/error (11.5px).
 * Khoảng gap giữa label và input là 6px (`gap-1.5`) — đủ để mắt phân biệt không bị "dính",
 * vẫn compact đủ cho dialog 2-cột.
 */
export function Field({
  label,
  htmlFor,
  hint,
  required,
  error,
  className,
  children
}: FieldProps): React.ReactElement {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-1 text-[12.5px] font-semibold leading-none text-admin-ink-soft"
      >
        {label}
        {required ? <span aria-hidden className="text-admin-danger">*</span> : null}
      </label>
      {children}
      {/* Hint dưới field đã bị bỏ — dùng placeholder hoặc title attr. Chỉ hiện error. */}
      {error ? (
        <p className="text-[11.5px] font-medium leading-relaxed text-admin-danger">{error}</p>
      ) : null}
    </div>
  );
}

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: React.ReactNode;
  hint?: React.ReactNode;
  mono?: boolean;
  fullRow?: boolean;
}

export function TextField({
  label,
  hint,
  mono,
  fullRow,
  required,
  id,
  className,
  ...props
}: TextFieldProps): React.ReactElement {
  const inputId = id ?? props.name ?? undefined;
  return (
    <Field
      label={label}
      htmlFor={inputId}
      hint={hint}
      required={required}
      className={cn(fullRow ? "sm:col-span-2" : null)}
    >
      <input id={inputId} className={cn(mono ? adminInputMonoClass : INPUT_BASE, className)} {...props} />
    </Field>
  );
}

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: React.ReactNode;
  hint?: React.ReactNode;
  fullRow?: boolean;
  children: React.ReactNode;
}

export function SelectField({
  label,
  hint,
  fullRow,
  required,
  id,
  className,
  children,
  ...props
}: SelectFieldProps): React.ReactElement {
  const selectId = id ?? props.name ?? undefined;
  return (
    <Field
      label={label}
      htmlFor={selectId}
      hint={hint}
      required={required}
      className={cn(fullRow ? "sm:col-span-2" : null)}
    >
      <select id={selectId} className={cn(INPUT_BASE, "pr-8", className)} {...props}>
        {children}
      </select>
    </Field>
  );
}

interface TextareaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: React.ReactNode;
  hint?: React.ReactNode;
  mono?: boolean;
  fullRow?: boolean;
}

export function TextareaField({
  label,
  hint,
  mono,
  fullRow,
  required,
  id,
  className,
  ...props
}: TextareaFieldProps): React.ReactElement {
  const taId = id ?? props.name ?? undefined;
  return (
    <Field
      label={label}
      htmlFor={taId}
      hint={hint}
      required={required}
      className={cn(fullRow ? "sm:col-span-2" : null)}
    >
      <textarea id={taId} className={cn(mono ? adminInputMonoClass : INPUT_BASE, className)} {...props} />
    </Field>
  );
}
