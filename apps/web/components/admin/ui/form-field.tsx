import type React from "react";
import { cn } from "../../../lib/utils";

const INPUT_BASE =
  "w-full rounded-lg border border-admin-line bg-admin-surface px-3 py-2.5 text-sm text-admin-ink placeholder:text-admin-mute focus:border-admin-accent focus:outline-none focus:ring-2 focus:ring-admin-accent/20 disabled:cursor-not-allowed disabled:opacity-60";

export const adminInputClass = INPUT_BASE;
export const adminInputMonoClass = cn(INPUT_BASE, "font-mono text-xs");
export const adminInputCompactClass = cn(INPUT_BASE, "py-2");

interface FieldProps {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  required?: boolean;
  error?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

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
    <div className={cn("space-y-1", className)}>
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-1 text-xs font-semibold text-admin-ink"
      >
        {label}
        {required ? <span aria-hidden className="text-rose-500">*</span> : null}
      </label>
      {children}
      {hint && !error ? <p className="text-[11px] text-admin-mute">{hint}</p> : null}
      {error ? <p className="text-[11px] font-medium text-rose-600">{error}</p> : null}
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
