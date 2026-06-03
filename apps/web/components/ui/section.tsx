import type React from "react";
import { cn } from "../../lib/utils";

interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: "default" | "wide";
}

export function PageContainer({
  className,
  width = "default",
  ...props
}: PageContainerProps): React.ReactElement {
  const max = width === "wide" ? "max-w-7xl" : "max-w-6xl";
  return <div className={cn("mx-auto px-4 sm:px-6", max, className)} {...props} />;
}

interface PageSectionProps extends React.HTMLAttributes<HTMLElement> {
  /** Padding dọc — `tight` cho danh sách, `default` cho block thường. */
  padding?: "tight" | "default" | "loose";
  /** Bọc trong container hay không (false khi bạn cần content chạy full-bleed). */
  container?: boolean;
  width?: "default" | "wide";
}

const PAD: Record<NonNullable<PageSectionProps["padding"]>, string> = {
  tight: "py-6 sm:py-8",
  default: "py-8 sm:py-10",
  loose: "py-12 sm:py-16"
};

export function PageSection({
  padding = "default",
  container = true,
  width = "default",
  className,
  children,
  ...props
}: PageSectionProps): React.ReactElement {
  return (
    <section className={cn(PAD[padding], className)} {...props}>
      {container ? <PageContainer width={width}>{children}</PageContainer> : children}
    </section>
  );
}

interface PageHeroProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Cột phụ bên phải (preview, illustration). Ẩn dưới lg. */
  aside?: React.ReactNode;
  /** Stats nằm dưới actions trong cột chính. */
  stats?: React.ReactNode;
  /** Bật mesh background mặc định. */
  mesh?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const HERO_PAD: Record<NonNullable<PageHeroProps["size"]>, string> = {
  sm: "py-8 sm:py-10",
  md: "py-10 sm:py-14",
  lg: "py-12 sm:py-16"
};

/**
 * Hero block dùng chung cho mọi page user-facing.
 * Thứ tự hierarchy: eyebrow → title → description → actions → stats.
 * Khi có `aside` sẽ split 2 cột trên lg.
 */
export function PageHero({
  eyebrow,
  title,
  description,
  actions,
  aside,
  stats,
  mesh = true,
  size = "md",
  className
}: PageHeroProps): React.ReactElement {
  const split = Boolean(aside);
  return (
    <section className={cn("relative overflow-hidden border-b border-border bg-canvas", className)}>
      {mesh ? <div aria-hidden className="absolute inset-0 bg-hero-mesh opacity-80" /> : null}
      <PageContainer className={cn("relative", HERO_PAD[size])}>
        <div
          className={cn(
            "grid gap-8",
            split && "lg:grid-cols-[1.2fr_1fr] lg:items-center"
          )}
        >
          <div className="space-y-4 animate-fade-up">
            {eyebrow ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-surface/80 px-3 py-1 text-xs font-medium text-primary-700 backdrop-blur">
                {eyebrow}
              </div>
            ) : null}
            <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-5xl">{title}</h1>
            {description ? (
              <p className="max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">{description}</p>
            ) : null}
            {actions ? <div className="flex flex-wrap items-center gap-3 pt-1">{actions}</div> : null}
            {stats ? <div className="pt-2">{stats}</div> : null}
          </div>
          {aside ? <div className="hidden lg:block">{aside}</div> : null}
        </div>
      </PageContainer>
    </section>
  );
}

interface SectionHeadingProps {
  title: React.ReactNode;
  /** Mô tả ngắn dưới title. */
  description?: React.ReactNode;
  /** Element bên phải (count, link xem thêm…). */
  trailing?: React.ReactNode;
  as?: "h2" | "h3";
  size?: "sm" | "md";
  className?: string;
}

export function SectionHeading({
  title,
  description,
  trailing,
  as: Heading = "h2",
  size = "md",
  className
}: SectionHeadingProps): React.ReactElement {
  const sizeClass = size === "sm" ? "text-base" : "text-lg sm:text-xl";
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <Heading className={cn("font-semibold tracking-tight text-ink", sizeClass)}>{title}</Heading>
        {description ? <p className="mt-1 text-sm text-ink-soft">{description}</p> : null}
      </div>
      {trailing ? <div className="shrink-0 text-xs text-ink-mute">{trailing}</div> : null}
    </div>
  );
}
