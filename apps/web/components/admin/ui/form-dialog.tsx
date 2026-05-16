"use client";

import * as React from "react";
import { FormProvider, type DefaultValues, type FieldValues } from "react-hook-form";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogClose
} from "./dialog";
import { AdminButton } from "./admin-button";
import { useAdminForm, type AdminFormResult } from "./use-admin-form";

/**
 * Dialog + form RHF + zod, tất cả-trong-một. Component này là khung chuẩn cho
 * MỌI form Tạo / Sửa trong /admin. Mỗi entity (coupon, campaign…) chỉ cần truyền
 * schema + defaultValues + onSubmit + render fields. Không tự code dialog/form riêng.
 *
 * Dùng controlled:
 *   const [open, setOpen] = useState(false);
 *   <FormDialog
 *     open={open} onOpenChange={setOpen}
 *     title="Tạo coupon" size="lg"
 *     schema={couponSchema}
 *     defaultValues={{...}}
 *     submitLabel="Tạo"
 *     onSubmit={async (data) => createCouponAction(data)}
 *   >
 *     <ControlledTextField name="code" ... />
 *     ...
 *   </FormDialog>
 *
 * Hoặc dùng uncontrolled với `trigger`:
 *   <FormDialog trigger={<AdminButton>+ Tạo coupon</AdminButton>} ...>
 *     ...
 *   </FormDialog>
 */
interface FormDialogProps<TValues extends FieldValues> {
  /** Render trigger button — nếu truyền, dialog tự quản lý open state. */
  trigger?: React.ReactNode;
  /** Controlled open. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;

  title: React.ReactNode;
  description?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";

  /** Zod schema — type any vì zod v4 + RHF generics phức tạp. Type-safety đến từ TValues. */
  schema: unknown;
  defaultValues: DefaultValues<TValues>;
  /** Reset form về defaultValues mỗi lần dialog mở — set true khi tạo mới. */
  resetOnOpen?: boolean;

  onSubmit: (data: TValues) => Promise<AdminFormResult | void>;
  onSuccess?: () => void;

  submitLabel?: React.ReactNode;
  cancelLabel?: React.ReactNode;

  children: React.ReactNode;
}

export function FormDialog<TValues extends FieldValues>({
  trigger,
  open: openProp,
  onOpenChange,
  title,
  description,
  size = "md",
  schema,
  defaultValues,
  resetOnOpen,
  onSubmit,
  onSuccess,
  submitLabel = "Lưu",
  cancelLabel = "Huỷ",
  children
}: FormDialogProps<TValues>): React.ReactElement {
  const [openInternal, setOpenInternal] = React.useState(false);
  const open = openProp ?? openInternal;
  const setOpen = onOpenChange ?? setOpenInternal;

  const { form, submit, error, isSubmitting, reset } = useAdminForm<TValues>({
    schema,
    defaultValues,
    onSubmit,
    onSuccess: () => {
      onSuccess?.();
      setOpen(false);
    }
  });

  // Reset khi dialog open (tránh dữ liệu cũ dính lại sau lần submit trước).
  // Chỉ depend vào `open` + `resetOnOpen` — `reset` đã useCallback stable trong useAdminForm.
  // Nếu thêm `reset` vào deps mà nó ko stable sẽ gây infinite loop (đã fix).
  React.useEffect(() => {
    if (open && resetOnOpen) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resetOnOpen]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        title={title}
        description={description}
        size={size}
        footer={
          <>
            <DialogClose asChild>
              <AdminButton type="button" variant="outline" size="sm" disabled={isSubmitting}>
                {cancelLabel}
              </AdminButton>
            </DialogClose>
            <AdminButton
              type="submit"
              form="admin-form-dialog"
              size="sm"
              loading={isSubmitting}
              loadingLabel="Đang lưu..."
            >
              {submitLabel}
            </AdminButton>
          </>
        }
      >
        {error ? (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}
        <FormProvider {...form}>
          <form id="admin-form-dialog" onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            {children}
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
