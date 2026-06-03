"use client";

import { useEffect, useState } from "react";

/**
 * Thanh progress 3px ở top viewport — fill brand color theo % scroll bài.
 * Pattern cellphones/medium: cho user thấy còn bao xa thì xong → giảm bounce.
 * Tự động: không phụ thuộc article ID hay route — đo viewport scroll.
 */
export function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let ticking = false;
    const update = () => {
      const doc = document.documentElement;
      const scrolled = doc.scrollTop || window.scrollY;
      const total = doc.scrollHeight - doc.clientHeight;
      setProgress(total > 0 ? Math.min(100, (scrolled / total) * 100) : 0);
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] bg-line/30"
      aria-hidden
    >
      <div
        className="h-full bg-gradient-to-r from-primary-500 via-primary-600 to-accent-500 transition-[width] duration-100 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
