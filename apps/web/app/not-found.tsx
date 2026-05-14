import type React from "react";
import Link from "next/link";
import { Button } from "../components/ui/button";

export default function NotFound(): React.ReactElement {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="max-w-md rounded-3xl border border-line bg-card p-10 text-center shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Không tìm thấy trang</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Trang này có thể đã bị gỡ hoặc đường dẫn không còn đúng. Quay về trang chủ để xem các deal khác.
        </p>
        <div className="mt-6">
          <Button asChild variant="brand">
            <Link href="/">Về trang chủ</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
