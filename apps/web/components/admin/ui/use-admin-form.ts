"use client";

import * as React from "react";
import {
  useForm,
  type UseFormReturn,
  type DefaultValues,
  type FieldValues
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

/**
 * Wrapper quanh `useForm` + zod resolver + tracking server-state.
 *
 * Trả về:
 *  - `form`            : object useForm gốc (register, handleSubmit, formState…)
 *  - `submit`          : hàm wrap quanh handleSubmit, gọi `onSubmit` (server action / fetch),
 *                        catch lỗi đưa vào `error`, reset khi cần.
 *  - `error`           : top-level error string (network / server-thrown).
 *  - `isSubmitting`    : form đang gọi onSubmit.
 *
 * Cách dùng trong dialog:
 *   const { form, submit, error, isSubmitting } = useAdminForm({
 *     schema: couponCreateSchema,
 *     defaultValues: { code: "", discountPercent: null, ... },
 *     onSubmit: async (data) => createCouponAction(data)
 *   });
 *   ...
 *   <FormProvider {...form}>
 *     <form onSubmit={submit}>...</form>
 *   </FormProvider>
 */
export interface AdminFormResult {
  ok: boolean;
  /** Lỗi mô tả tổng (không bind vào field). */
  error?: string;
  /** Lỗi gán cho từng field — tự setError vào RHF. */
  fieldErrors?: Record<string, string>;
}

// Type helper: zod 4 + RHF together. RHF requires FieldValues (an object type).
// `z.infer<Schema>` cho ra `unknown` nếu Schema = `z.ZodTypeAny` — không thoả constraint.
// Workaround: parametrize bằng `TValues extends FieldValues` lấy từ schema.
type ZodFieldSchema<T extends FieldValues> = z.ZodType<T, T> | z.ZodType<T, unknown>;

interface UseAdminFormOptions<TValues extends FieldValues> {
  /** Zod schema (untyped to bypass zod v4 + RHF generic friction). */
  schema: unknown;
  defaultValues: DefaultValues<TValues>;
  onSubmit: (data: TValues) => Promise<AdminFormResult | void>;
  /** Gọi sau khi submit thành công. Đóng dialog / reset form ở đây. */
  onSuccess?: () => void;
}

interface UseAdminFormReturn<TValues extends FieldValues> {
  form: UseFormReturn<TValues>;
  submit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  error: string | null;
  isSubmitting: boolean;
  reset: (values?: DefaultValues<TValues>) => void;
}

export function useAdminForm<TValues extends FieldValues>({
  schema,
  defaultValues,
  onSubmit,
  onSuccess
}: UseAdminFormOptions<TValues>): UseAdminFormReturn<TValues> {
  const form = useForm<TValues>({
    // zodResolver/zod v4 type signature mismatch — cast để qua TS check.
    resolver: zodResolver(schema as never) as never,
    defaultValues,
    mode: "onSubmit"
  });

  const [error, setError] = React.useState<string | null>(null);

  const submit = form.handleSubmit(async (data) => {
    setError(null);
    try {
      const result = await onSubmit(data as TValues);
      if (result && !result.ok) {
        if (result.fieldErrors) {
          for (const [field, message] of Object.entries(result.fieldErrors)) {
            form.setError(field as never, { type: "server", message });
          }
        }
        if (result.error) setError(result.error);
        return;
      }
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    }
  });

  // Stable defaultValues ref — caller thường truyền object literal mỗi render,
  // ko muốn re-run effect bên consumer chỉ vì identity thay đổi.
  const dvRef = React.useRef(defaultValues);
  React.useEffect(() => {
    dvRef.current = defaultValues;
  }, [defaultValues]);

  // form.reset() từ RHF là stable; ta wrap thêm setError(null). useCallback để
  // FormDialog có thể depend an toàn ko gây re-render loop.
  const reset = React.useCallback(
    (values?: DefaultValues<TValues>) => {
      setError(null);
      form.reset(values ?? dvRef.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return {
    form,
    submit,
    error,
    isSubmitting: form.formState.isSubmitting,
    reset
  };
}

// Re-export to suppress unused-import linter
export type { ZodFieldSchema };
