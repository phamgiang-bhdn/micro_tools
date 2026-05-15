"use client";

import * as React from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../../../lib/utils";

/**
 * Dialog primitive (Radix wrapper). Mặc định panel hiện giữa viewport, ≤640px chiếm full màn,
 * có scroll trong panel khi content dài. Dùng cho mọi form add/edit/confirm phức tạp.
 *
 * Pattern dùng:
 *   <Dialog>
 *     <DialogTrigger asChild><AdminButton>...</AdminButton></DialogTrigger>
 *     <DialogContent title="..." description="...">
 *        ...body...
 *        <DialogFooter>...buttons...</DialogFooter>
 *     </DialogContent>
 *   </Dialog>
 *
 * Hoặc dùng controlled bằng `open` + `onOpenChange` của Radix.
 */
export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;
export const DialogPortal = RadixDialog.Portal;

interface DialogContentProps
  extends Omit<React.ComponentPropsWithoutRef<typeof RadixDialog.Content>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Max width tailwind class — mặc định `sm:max-w-lg`. */
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  /** Nội dung action ở footer. Tự bố trí, có sẵn justify-end + gap. */
  footer?: React.ReactNode;
  hideClose?: boolean;
}

const SIZE_CLASS: Record<NonNullable<DialogContentProps["size"]>, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-3xl",
  "2xl": "sm:max-w-5xl"
};

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Content>,
  DialogContentProps
>(function DialogContent(
  { className, children, title, description, size = "md", footer, hideClose, ...props },
  ref
) {
  return (
    <DialogPortal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-admin-ink/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <RadixDialog.Content
        ref={ref}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 grid w-full max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 grid-rows-[auto_1fr_auto] overflow-hidden rounded-2xl border border-admin-line bg-admin-surface shadow-card-lg outline-none",
          "max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          SIZE_CLASS[size],
          className
        )}
        {...props}
      >
        {title || description ? (
          <div className="flex items-start justify-between gap-4 border-b border-admin-line px-5 py-4">
            <div className="min-w-0 space-y-1">
              {title ? (
                <RadixDialog.Title className="text-base font-semibold tracking-tight text-admin-ink">
                  {title}
                </RadixDialog.Title>
              ) : null}
              {description ? (
                <RadixDialog.Description className="text-xs text-admin-mute">
                  {description}
                </RadixDialog.Description>
              ) : null}
            </div>
            {!hideClose ? (
              <RadixDialog.Close
                aria-label="Đóng"
                className="grid size-8 shrink-0 place-items-center rounded-md text-admin-mute transition hover:bg-admin-subtle hover:text-admin-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/40"
              >
                <X className="size-4" />
              </RadixDialog.Close>
            ) : null}
          </div>
        ) : null}

        <div className="overflow-y-auto px-5 py-4">{children}</div>

        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-admin-line bg-admin-subtle/30 px-5 py-3">
            {footer}
          </div>
        ) : null}
      </RadixDialog.Content>
    </DialogPortal>
  );
});

export function DialogFooter({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className={cn("flex flex-wrap items-center justify-end gap-2", className)}>{children}</div>
  );
}
