import type React from "react";

const ICON_MAP: Record<string, React.ReactElement> = {
  battery: <path d="M3 8h13v8H3zM16 11h2v2h-2zM7 11v2M11 11v2" />,
  filter: <path d="M4 4h16l-6 8v6l-4 2v-8z" />,
  noise: <path d="M9 7v10l-4-3H3V10h2zM13 8a4 4 0 0 1 0 8M16 5a8 8 0 0 1 0 14" />,
  smart: <path d="M12 2l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z" />,
  size: <path d="M3 6h18M3 12h18M3 18h18" />,
  money: <path d="M12 2v20M17 5H8a3 3 0 0 0 0 6h8a3 3 0 0 1 0 6H7" />,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
  sparkle: <path d="M12 2v8M12 14v8M2 12h8M14 12h8" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  wifi: <path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19h.01" />,
  warning: <><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></>,
  check: <path d="M5 13l4 4L19 7" />,
  tip: <><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2v.3h6v-.3c0-.8.4-1.5 1-2A7 7 0 0 0 12 2Z" /></>
};

interface Props {
  name?: string;
  className?: string;
}

export function BlockIcon({ name, className = "size-5" }: Props): React.ReactElement {
  const child = name ? ICON_MAP[name] : null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {child ?? <circle cx="12" cy="12" r="3" />}
    </svg>
  );
}
