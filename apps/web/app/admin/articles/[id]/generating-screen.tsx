"use client";

import type React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Props {
  articleId: string;
  topic: string;
}

const STAGES = [
  "Đang khởi tạo prompt + bơm dữ liệu sản phẩm cập nhật...",
  "Đang gọi Gemini (có thể bật Google Search để tra sản phẩm mới)...",
  "Đang scrape sản phẩm mới tìm được (nếu có)...",
  "Đang chuẩn hoá ảnh + validate blocks...",
  "Đang lưu bản nháp..."
];

export function GeneratingScreen({ articleId, topic }: Props): React.ReactElement {
  const router = useRouter();
  const [elapsed, setElapsed] = useState(0);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const tickElapsed = setInterval(() => {
      const secs = Math.floor((Date.now() - start) / 1000);
      setElapsed(secs);
      // Stage progression visual only (not tied to actual backend stage)
      setStage(Math.min(STAGES.length - 1, Math.floor(secs / 15)));
    }, 1000);

    const tickPoll = setInterval(() => {
      router.refresh();
    }, 3000);

    return () => {
      clearInterval(tickElapsed);
      clearInterval(tickPoll);
    };
  }, [articleId, router]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/admin/articles" className="text-xs text-admin-mute hover:text-admin-ink">
        ← Quay lại danh sách
      </Link>
      <div className="rounded-2xl border border-admin-line bg-admin-surface p-8 text-center">
        <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-sky-100 text-sky-700">
          <svg viewBox="0 0 24 24" fill="none" className="size-6 animate-spin" aria-hidden>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
            <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
        <h2 className="mt-4 text-lg font-semibold text-admin-ink">AI đang sinh bài</h2>
        <p className="mt-1 text-sm text-admin-mute">&quot;{topic}&quot;</p>
        <p className="mt-4 text-sm text-admin-ink">{STAGES[stage]}</p>
        <p className="mt-2 text-xs text-admin-mute">
          Đã chờ {elapsed}s · trang tự refresh mỗi 3s · thường mất 30s–2 phút.
        </p>
        <p className="mt-6 text-[11px] text-admin-mute">
          Bạn có thể đóng tab và quay lại — bài vẫn sinh tiếp ở backend.
        </p>
      </div>
    </div>
  );
}
