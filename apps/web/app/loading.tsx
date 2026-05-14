import type React from "react";

export default function Loading(): React.ReactElement {
  return (
    <div className="space-y-10">
      <div className="h-64 animate-pulse rounded-4xl bg-card shadow-card" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="h-28 animate-pulse rounded-2xl bg-card shadow-card" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, idx) => (
          <div key={idx} className="h-72 animate-pulse rounded-2xl bg-card shadow-card" />
        ))}
      </div>
    </div>
  );
}
