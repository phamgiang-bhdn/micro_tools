"use client";

import * as React from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogClose } from "./dialog";
import { AdminButton } from "./admin-button";

/**
 * Confirm dialog đẹp hơn window.confirm. Có 2 cách dùng:
 *
 * 1) Imperative (1 lần dùng) qua hook `useConfirm()`:
 *    const confirm = useConfirm();
 *    const ok = await confirm({ title: "Xoá?", message: "Không thể hoàn tác." });
 *    if (ok) await doDelete();
 *
 * 2) Declarative qua component `<ConfirmDialog open onOpenChange ... onConfirm />`
 *    nếu cần controlled state.
 *
 * RowActions tự dùng hook `useConfirm` để thay `window.confirm()`.
 */
interface ConfirmOptions {
  title?: React.ReactNode;
  message?: React.ReactNode;
  /** Text nút confirm. Mặc định "Xoá". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" → nút đỏ. */
  tone?: "default" | "danger";
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

const ConfirmContext = React.createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(
  null
);

/**
 * Wrap admin shell (đã wire ở app/admin/layout.tsx) — mọi component con trong /admin
 * gọi useConfirm() là dùng được.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [pending, setPending] = React.useState<PendingConfirm | null>(null);

  const confirm = React.useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve });
    });
  }, []);

  const close = (ok: boolean) => {
    if (!pending) return;
    pending.resolve(ok);
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={pending !== null} onOpenChange={(o) => !o && close(false)}>
        <DialogContent
          size="sm"
          title={pending?.title ?? "Bạn chắc chứ?"}
          description={pending?.message}
          footer={
            <>
              <DialogClose asChild>
                <AdminButton type="button" variant="outline" size="sm">
                  {pending?.cancelLabel ?? "Huỷ"}
                </AdminButton>
              </DialogClose>
              <AdminButton
                type="button"
                size="sm"
                variant={pending?.tone === "danger" ? "danger" : "primary"}
                iconLeft={pending?.tone === "danger" ? <Trash2 /> : <AlertTriangle />}
                onClick={() => close(true)}
              >
                {pending?.confirmLabel ?? (pending?.tone === "danger" ? "Xoá" : "Đồng ý")}
              </AdminButton>
            </>
          }
        >
          <div className="flex items-start gap-3">
            <div
              className={
                pending?.tone === "danger"
                  ? "grid size-10 shrink-0 place-items-center rounded-full bg-rose-50 text-rose-600"
                  : "grid size-10 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-600"
              }
            >
              <AlertTriangle className="size-5" />
            </div>
            <div className="text-sm text-admin-mute">
              {pending?.message ?? "Hành động này không thể hoàn tác."}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): (opts: ConfirmOptions) => Promise<boolean> {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) {
    // Fallback an toàn nếu Provider chưa wire — vẫn hoạt động qua window.confirm
    // để ko crash trang. Dev console sẽ thấy warning.
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.warn("[admin] ConfirmProvider chưa wire — fallback về window.confirm");
    }
    return (opts) =>
      Promise.resolve(window.confirm(String(opts.message ?? opts.title ?? "Xác nhận?")));
  }
  return ctx;
}
