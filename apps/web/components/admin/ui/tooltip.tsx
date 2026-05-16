"use client";

import * as React from "react";
import * as RadixTooltip from "@radix-ui/react-tooltip";
import { cn } from "../../../lib/utils";

/**
 * Tooltip primitive. Phải bọc app trong <TooltipProvider> (đặt ở admin layout)
 * trước khi dùng — nếu không sẽ throw.
 *
 * Pattern đơn giản:
 *   <Tooltip content="Sửa coupon"><IconButton icon={<Pencil />} /></Tooltip>
 */
export const TooltipProvider = RadixTooltip.Provider;

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  /** Delay (ms) trước khi tooltip xuất hiện. Mặc định 200ms — đủ nhanh nhưng không nhấp nháy. */
  delayDuration?: number;
  /** Disable hoàn toàn — render children không wrap. */
  disabled?: boolean;
}

export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  delayDuration = 200,
  disabled
}: TooltipProps): React.ReactElement {
  if (disabled || !content) return <>{children}</>;

  return (
    <RadixTooltip.Root delayDuration={delayDuration}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          align={align}
          sideOffset={6}
          className={cn(
            "z-50 max-w-xs rounded-md bg-admin-ink px-2.5 py-1.5 text-xs font-medium text-white shadow-md",
            "data-[state=delayed-open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0"
          )}
        >
          {content}
          <RadixTooltip.Arrow className="fill-admin-ink" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
