"use client";

import type React from "react";
import { useEffect, useState } from "react";

interface Props {
  expiresAt: string | Date;
  className?: string;
}

export function CouponCountdown({ expiresAt, className }: Props): React.ReactElement | null {
  const expires = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = expires.getTime() - now.getTime();
  if (diff <= 0) {
    return <span className={`text-danger font-semibold ${className ?? ""}`}>Đã hết hạn</span>;
  }

  const totalHours = diff / 3600000;
  if (totalHours > 48) {
    const days = Math.floor(totalHours / 24);
    return <span className={`text-ink-soft ${className ?? ""}`}>Còn {days} ngày</span>;
  }

  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const urgent = totalHours <= 1;
  const cls = urgent
    ? "text-danger font-bold"
    : "text-warning font-semibold";
  return (
    <span className={`${cls} tabular-nums ${className ?? ""}`}>
      {urgent ? "⏰ " : ""}Còn {h}:{m.toString().padStart(2, "0")}:{s.toString().padStart(2, "0")}
    </span>
  );
}
