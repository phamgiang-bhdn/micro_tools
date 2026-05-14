"use client";

import type React from "react";
import { Button } from "../components/ui/button";

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorBoundary({ error, reset }: ErrorBoundaryProps): React.ReactElement {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <div className="max-w-md rounded-3xl border border-red-200 bg-red-50 p-8 text-center shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Đã có lỗi</p>
        <h1 className="mt-2 text-xl font-semibold text-ink">Trang này không tải được</h1>
        <p className="mt-2 text-sm text-ink-soft">{error.message}</p>
        <div className="mt-6">
          <Button variant="brand" onClick={reset}>
            Thử lại
          </Button>
        </div>
      </div>
    </div>
  );
}
