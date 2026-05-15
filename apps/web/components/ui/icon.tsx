import type React from "react";
import type { SVGProps } from "react";
import { cn } from "../../lib/utils";

type IconName =
  | "flame"
  | "sort"
  | "chevron-down"
  | "chevron-right"
  | "check"
  | "search"
  | "close"
  | "shield"
  | "arrow-right"
  | "spark"
  | "tag"
  | "shield-check"
  | "clock"
  | "trending-up";

type Size = "xs" | "sm" | "md" | "lg";

const SIZE_CLASS: Record<Size, string> = {
  xs: "size-3",
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5"
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: Size;
}

export function Icon({ name, size = "md", className, ...props }: IconProps): React.ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
      className={cn(SIZE_CLASS[size], className)}
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const
};

const PATHS: Record<IconName, React.ReactElement> = {
  flame: (
    <path
      fill="currentColor"
      d="M12 2c.7 3.4-.6 5.9-2.6 7.7-2 1.9-3.4 4-3.4 6.7A6 6 0 0 0 12 22a6 6 0 0 0 6-5.6c0-3.3-2.4-4.7-2.4-7.2 0-1.2.5-2 .9-2.9-1.7.6-2.7 1.5-2.7 3.3 0 1 .4 1.7.4 2.6 0 1-.7 1.8-1.6 1.8-1 0-1.6-.9-1.6-2 0-3.2 3-4 1-10Z"
    />
  ),
  sort: <path {...stroke} d="M3 6h13M3 12h9M3 18h5M17 6v12m0 0-3-3m3 3 3-3" />,
  "chevron-down": <path {...stroke} strokeWidth={2.4} d="m6 9 6 6 6-6" />,
  "chevron-right": <path {...stroke} strokeWidth={2.4} d="m9 6 6 6-6 6" />,
  check: <path {...stroke} strokeWidth={2.4} d="m5 12 5 5L20 7" />,
  search: (
    <g {...stroke}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </g>
  ),
  close: <path {...stroke} strokeWidth={2.2} d="m6 6 12 12M6 18 18 6" />,
  shield: <path {...stroke} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
  "arrow-right": <path {...stroke} strokeWidth={2.2} d="M5 12h14M13 5l7 7-7 7" />,
  spark: (
    <path
      fill="currentColor"
      d="M12 2 13.6 8.4 20 10 13.6 11.6 12 18 10.4 11.6 4 10l6.4-1.6L12 2Z"
    />
  ),
  tag: (
    <g {...stroke}>
      <path d="M20 13.5 13.5 20a1.4 1.4 0 0 1-2 0L3 11.5V3h8.5L20 11.5a1.4 1.4 0 0 1 0 2Z" />
      <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
    </g>
  ),
  "shield-check": (
    <g {...stroke}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </g>
  ),
  clock: (
    <g {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </g>
  ),
  "trending-up": <path {...stroke} d="m3 17 6-6 4 4 8-8M14 7h7v7" />
};
