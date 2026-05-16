"use client";

import * as React from "react";
import { Controller, useFormContext, type FieldValues, type Path } from "react-hook-form";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from "./select";
import { DatePicker } from "./date-picker";
import { Field, adminInputClass, adminInputMonoClass } from "./form-field";
import { cn } from "../../../lib/utils";

/**
 * RHF-aware form fields. Tự đăng ký vào FormProvider — chỉ cần truyền `name`.
 * Error tự lấy từ `formState.errors[name]` và render dưới input.
 *
 * Cách dùng:
 *   <FormProvider {...methods}>
 *     <ControlledTextField name="code" label="Mã" required />
 *     <ControlledSelectField name="network" label="Network" options={NETWORK_OPTIONS} />
 *     ...
 *   </FormProvider>
 *
 * Hoặc gọi `useAdminForm` (file `use-admin-form.ts`) để có sẵn methods + submit handler.
 */

// Common types

type Option = { value: string; label: string };

function useFieldError(name: string): string | undefined {
  const {
    formState: { errors }
  } = useFormContext();
  const err = name.split(".").reduce<unknown>(
    (acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined),
    errors
  );
  if (!err || typeof err !== "object") return undefined;
  const msg = (err as { message?: unknown }).message;
  return typeof msg === "string" ? msg : undefined;
}

// ===== Text =====

interface ControlledTextFieldProps<T extends FieldValues>
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "defaultValue"> {
  name: Path<T>;
  label: React.ReactNode;
  hint?: React.ReactNode;
  mono?: boolean;
  fullRow?: boolean;
}

export function ControlledTextField<T extends FieldValues>({
  name,
  label,
  hint,
  mono,
  fullRow,
  required,
  className,
  ...rest
}: ControlledTextFieldProps<T>): React.ReactElement {
  const { register } = useFormContext<T>();
  const error = useFieldError(name);
  return (
    <Field
      label={label}
      hint={hint}
      required={required}
      error={error}
      htmlFor={name}
      className={cn(fullRow ? "sm:col-span-2" : null)}
    >
      <input
        id={name}
        className={cn(mono ? adminInputMonoClass : adminInputClass, className)}
        aria-invalid={Boolean(error)}
        {...register(name)}
        {...rest}
      />
    </Field>
  );
}

// ===== Textarea =====

interface ControlledTextareaFieldProps<T extends FieldValues>
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "defaultValue"> {
  name: Path<T>;
  label: React.ReactNode;
  hint?: React.ReactNode;
  mono?: boolean;
  fullRow?: boolean;
}

export function ControlledTextareaField<T extends FieldValues>({
  name,
  label,
  hint,
  mono,
  fullRow,
  required,
  rows = 4,
  className,
  ...rest
}: ControlledTextareaFieldProps<T>): React.ReactElement {
  const { register } = useFormContext<T>();
  const error = useFieldError(name);
  return (
    <Field
      label={label}
      hint={hint}
      required={required}
      error={error}
      htmlFor={name}
      className={cn(fullRow ? "sm:col-span-2" : null)}
    >
      <textarea
        id={name}
        rows={rows}
        className={cn(mono ? adminInputMonoClass : adminInputClass, className)}
        aria-invalid={Boolean(error)}
        {...register(name)}
        {...rest}
      />
    </Field>
  );
}

// ===== Number =====

interface ControlledNumberFieldProps<T extends FieldValues>
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "defaultValue" | "type"> {
  name: Path<T>;
  label: React.ReactNode;
  hint?: React.ReactNode;
  fullRow?: boolean;
}

export function ControlledNumberField<T extends FieldValues>({
  name,
  label,
  hint,
  fullRow,
  required,
  className,
  ...rest
}: ControlledNumberFieldProps<T>): React.ReactElement {
  const { register } = useFormContext<T>();
  const error = useFieldError(name);
  return (
    <Field
      label={label}
      hint={hint}
      required={required}
      error={error}
      htmlFor={name}
      className={cn(fullRow ? "sm:col-span-2" : null)}
    >
      <input
        id={name}
        type="number"
        inputMode="numeric"
        className={cn(adminInputClass, className)}
        aria-invalid={Boolean(error)}
        {...register(name, { setValueAs: (v) => (v === "" || v == null ? null : Number(v)) })}
        {...rest}
      />
    </Field>
  );
}

// ===== Select =====

interface ControlledSelectFieldProps<T extends FieldValues> {
  name: Path<T>;
  label: React.ReactNode;
  hint?: React.ReactNode;
  fullRow?: boolean;
  required?: boolean;
  placeholder?: string;
  options: Option[];
  /** Cho phép giá trị rỗng (option "— Tất cả —" / "— Không —"). */
  allowEmpty?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
}

export function ControlledSelectField<T extends FieldValues>({
  name,
  label,
  hint,
  fullRow,
  required,
  placeholder = "Chọn...",
  options,
  allowEmpty,
  emptyLabel = "— Không —",
  disabled
}: ControlledSelectFieldProps<T>): React.ReactElement {
  const { control } = useFormContext<T>();
  const error = useFieldError(name);
  return (
    <Field
      label={label}
      hint={hint}
      required={required}
      error={error}
      htmlFor={name}
      className={cn(fullRow ? "sm:col-span-2" : null)}
    >
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Select
            value={field.value ?? ""}
            onValueChange={(v) => field.onChange(allowEmpty && v === "__empty__" ? "" : v)}
            disabled={disabled}
          >
            <SelectTrigger id={name} aria-invalid={Boolean(error)}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {allowEmpty ? <SelectItem value="__empty__">{emptyLabel}</SelectItem> : null}
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </Field>
  );
}

// ===== Date =====

interface ControlledDateFieldProps<T extends FieldValues> {
  name: Path<T>;
  label: React.ReactNode;
  hint?: React.ReactNode;
  fullRow?: boolean;
  required?: boolean;
  placeholder?: string;
  fromDate?: Date;
  toDate?: Date;
}

export function ControlledDateField<T extends FieldValues>({
  name,
  label,
  hint,
  fullRow,
  required,
  placeholder,
  fromDate,
  toDate
}: ControlledDateFieldProps<T>): React.ReactElement {
  const { control } = useFormContext<T>();
  const error = useFieldError(name);
  return (
    <Field
      label={label}
      hint={hint}
      required={required}
      error={error}
      htmlFor={name}
      className={cn(fullRow ? "sm:col-span-2" : null)}
    >
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <DatePicker
            id={name}
            value={field.value ?? ""}
            onChange={(v) => field.onChange(v ?? "")}
            placeholder={placeholder}
            fromDate={fromDate}
            toDate={toDate}
          />
        )}
      />
    </Field>
  );
}

// ===== Checkbox / Switch =====

interface ControlledCheckboxFieldProps<T extends FieldValues> {
  name: Path<T>;
  label: React.ReactNode;
  hint?: React.ReactNode;
  fullRow?: boolean;
  disabled?: boolean;
}

export function ControlledCheckboxField<T extends FieldValues>({
  name,
  label,
  hint,
  fullRow,
  disabled
}: ControlledCheckboxFieldProps<T>): React.ReactElement {
  const { register } = useFormContext<T>();
  const error = useFieldError(name);
  return (
    <div className={cn("space-y-1", fullRow ? "sm:col-span-2" : null)}>
      <label className="flex items-start gap-2 text-sm text-admin-ink">
        <input
          type="checkbox"
          className="mt-0.5 size-4 rounded border-admin-line text-admin-accent focus:ring-admin-accent/30"
          disabled={disabled}
          {...register(name)}
        />
        <span className="flex-1">
          <span className="font-medium">{label}</span>
          {hint ? <span className="ml-1 text-xs text-admin-mute">{hint}</span> : null}
        </span>
      </label>
      {error ? <p className="text-[11px] font-medium text-rose-600">{error}</p> : null}
    </div>
  );
}
