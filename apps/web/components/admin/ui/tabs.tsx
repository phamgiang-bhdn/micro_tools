"use client";

import * as React from "react";
import * as RadixTabs from "@radix-ui/react-tabs";
import { cn } from "../../../lib/utils";

/**
 * Tabs primitive. Hỗ trợ hai variants:
 *  - "underline" (mặc định): tab có gạch chân dưới, dùng cho page-level navigation
 *    (ví dụ Edit / Preview / SEO).
 *  - "pill": tab dạng nút bo tròn, dùng cho mini-section trong card.
 *
 * Hỗ trợ controlled (`value` + `onValueChange`) và uncontrolled (`defaultValue`).
 */
export const Tabs = RadixTabs.Root;

interface TabsListProps extends React.ComponentPropsWithoutRef<typeof RadixTabs.List> {
  variant?: "underline" | "pill";
}

export const TabsList = React.forwardRef<
  React.ElementRef<typeof RadixTabs.List>,
  TabsListProps
>(function TabsList({ className, variant = "underline", ...props }, ref) {
  return (
    <RadixTabs.List
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1",
        variant === "underline"
          ? "h-11 w-full border-b border-admin-line"
          : "rounded-lg bg-admin-subtle p-1",
        className
      )}
      data-variant={variant}
      {...props}
    />
  );
});

interface TabsTriggerProps extends React.ComponentPropsWithoutRef<typeof RadixTabs.Trigger> {
  /** Badge nhỏ bên phải label (số đếm, dấu chấm…). */
  badge?: React.ReactNode;
}

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof RadixTabs.Trigger>,
  TabsTriggerProps
>(function TabsTrigger({ className, children, badge, ...props }, ref) {
  return (
    <RadixTabs.Trigger
      ref={ref}
      className={cn(
        // base
        "inline-flex h-9 items-center justify-center gap-1.5 px-3 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/40",
        // underline variant (parent có data-variant)
        "data-[state=active]:text-admin-ink",
        // tách rời underline + pill bằng group-data của parent là hơi rối; dùng đơn variants ở list-level:
        // chú ý: parent là TabsList, nó set data-variant. Ta dùng :where + group nếu cần.
        "text-admin-mute hover:text-admin-ink",
        // For underline: bottom border highlight
        "relative",
        "data-[state=active]:after:absolute data-[state=active]:after:left-2 data-[state=active]:after:right-2 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-admin-accent",
        className
      )}
      {...props}
    >
      {children}
      {badge ? (
        <span className="rounded-full bg-admin-subtle px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-admin-mute group-data-[state=active]:bg-admin-accent-soft group-data-[state=active]:text-admin-accent">
          {badge}
        </span>
      ) : null}
    </RadixTabs.Trigger>
  );
});

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof RadixTabs.Content>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.Content>
>(function TabsContent({ className, ...props }, ref) {
  return (
    <RadixTabs.Content
      ref={ref}
      className={cn(
        "mt-4 focus:outline-none data-[state=inactive]:hidden",
        "data-[state=active]:animate-in data-[state=active]:fade-in-0",
        className
      )}
      {...props}
    />
  );
});
