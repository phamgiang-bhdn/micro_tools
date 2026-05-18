import type React from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}

/**
 * Header chuẩn cho list/detail page admin. Title size mid-large (22-26px), gap chặt
 * giữa eyebrow → title → subtitle. Actions right-align, wrap về dòng dưới khi hẹp.
 *
 * Không nhồi quá nhiều khoảng trống ở header — cho phép table/filter ngay sau đó.
 */
export function PageHeader({ eyebrow, title, subtitle, actions }: PageHeaderProps): React.ReactElement {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-admin-accent">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 text-[22px] font-bold leading-tight tracking-tight text-admin-ink sm:text-[26px]">
          {title}
        </h1>
        {subtitle ? (
          <div className="mt-1 max-w-2xl text-[13px] leading-relaxed text-admin-mute">
            {subtitle}
          </div>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
