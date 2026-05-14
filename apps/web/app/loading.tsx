import type React from "react";

/**
 * Loading skeleton cho trang public — match layout của HomePage (hero + grid).
 */
export default function Loading(): React.ReactElement {
  return (
    <>
      <div className="border-b border-line bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div className="space-y-4">
              <div className="h-7 w-40 rounded-full skeleton" />
              <div className="h-12 w-3/4 rounded-2xl skeleton" />
              <div className="h-12 w-1/2 rounded-2xl skeleton" />
              <div className="h-5 w-2/3 rounded-full skeleton" />
              <div className="h-10 w-48 rounded-full skeleton" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-xl skeleton" />
                ))}
              </div>
            </div>
            <div className="hidden gap-3 lg:grid">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 rounded-2xl skeleton" />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 w-24 rounded-full skeleton" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-2xl skeleton" />
          ))}
        </div>
      </div>
    </>
  );
}
