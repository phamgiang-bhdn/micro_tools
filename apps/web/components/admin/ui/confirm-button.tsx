"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { cn } from "../../../lib/utils";
import {
  AdminButton,
  type AdminButtonProps,
  type AdminButtonSize,
  type AdminButtonVariant
} from "./admin-button";

/**
 * Confirm-before-submit button. Wrap quanh form action — hiện window.confirm()
 * trước khi submit. Tự loading qua useFormStatus.
 *
 * TODO: thay window.confirm bằng <Dialog> để đẹp hơn — sẽ làm trong Phase 3
 * khi migrate page. Hiện giữ để không vỡ flow cũ.
 */
interface ConfirmButtonProps {
  confirmMessage: string;
  variant?: AdminButtonVariant;
  size?: AdminButtonSize;
  className?: string;
  children: React.ReactNode;
  pendingLabel?: string;
  iconLeft?: React.ReactNode;
}

export function ConfirmButton({
  confirmMessage,
  variant = "danger",
  size = "sm",
  className,
  children,
  pendingLabel,
  iconLeft
}: ConfirmButtonProps): React.ReactElement {
  const { pending } = useFormStatus();
  return (
    <AdminButton
      type="submit"
      variant={variant}
      size={size}
      iconLeft={iconLeft}
      loading={pending}
      loadingLabel={pendingLabel ?? "Đang xử lý..."}
      className={cn(className)}
      onClick={(e) => {
        if (pending) return;
        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      {children}
    </AdminButton>
  );
}

interface SubmitButtonProps {
  variant?: AdminButtonVariant;
  size?: AdminButtonSize;
  className?: string;
  children: React.ReactNode;
  pendingLabel?: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

/**
 * Submit nằm trong <form action={serverAction}> — tự loading khi pending.
 * Dùng client-side cho UX feedback ngay; server action vẫn chạy như cũ.
 */
export function SubmitButton({
  variant = "primary",
  size = "md",
  className,
  children,
  pendingLabel,
  iconLeft,
  iconRight
}: SubmitButtonProps): React.ReactElement {
  const { pending } = useFormStatus();
  return (
    <AdminButton
      type="submit"
      variant={variant}
      size={size}
      className={className}
      iconLeft={iconLeft}
      iconRight={iconRight}
      loading={pending}
      loadingLabel={pendingLabel ?? "Đang lưu..."}
    >
      {children}
    </AdminButton>
  );
}

/** Compat alias to avoid touching every legacy import — same as AdminButton but client. */
export function ClientAdminButton(props: AdminButtonProps): React.ReactElement {
  return <AdminButton {...props} />;
}
