"use client";

import * as React from "react";
import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import { cn } from "../../../lib/utils";

/**
 * Dropdown menu primitive. Dùng chính cho "more actions" trong RowActions
 * (xoá, duplicate, archive, publish… những thứ ko phải Edit / Delete chính).
 */
export const DropdownMenu = RadixDropdown.Root;
export const DropdownMenuTrigger = RadixDropdown.Trigger;
export const DropdownMenuGroup = RadixDropdown.Group;
export const DropdownMenuPortal = RadixDropdown.Portal;
export const DropdownMenuSub = RadixDropdown.Sub;
export const DropdownMenuRadioGroup = RadixDropdown.RadioGroup;

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof RadixDropdown.Content>,
  React.ComponentPropsWithoutRef<typeof RadixDropdown.Content>
>(function DropdownMenuContent({ className, sideOffset = 4, ...props }, ref) {
  return (
    <RadixDropdown.Portal>
      <RadixDropdown.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[10rem] overflow-hidden rounded-lg border border-admin-line bg-admin-surface p-1 shadow-card-md",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      />
    </RadixDropdown.Portal>
  );
});

interface DropdownMenuItemProps
  extends React.ComponentPropsWithoutRef<typeof RadixDropdown.Item> {
  tone?: "default" | "danger";
  iconLeft?: React.ReactNode;
  shortcut?: string;
}

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof RadixDropdown.Item>,
  DropdownMenuItemProps
>(function DropdownMenuItem(
  { className, tone = "default", iconLeft, shortcut, children, ...props },
  ref
) {
  return (
    <RadixDropdown.Item
      ref={ref}
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition",
        "focus:bg-admin-subtle focus:text-admin-ink",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        tone === "danger" ? "text-rose-700 focus:bg-rose-50 focus:text-rose-800" : "text-admin-ink",
        className
      )}
      {...props}
    >
      {iconLeft ? <span className="flex size-4 shrink-0 items-center justify-center">{iconLeft}</span> : null}
      <span className="flex-1">{children}</span>
      {shortcut ? <span className="ml-2 text-[11px] tracking-wider text-admin-mute">{shortcut}</span> : null}
    </RadixDropdown.Item>
  );
});

export const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof RadixDropdown.Label>,
  React.ComponentPropsWithoutRef<typeof RadixDropdown.Label>
>(function DropdownMenuLabel({ className, ...props }, ref) {
  return (
    <RadixDropdown.Label
      ref={ref}
      className={cn("px-2 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-admin-mute", className)}
      {...props}
    />
  );
});

export const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof RadixDropdown.Separator>,
  React.ComponentPropsWithoutRef<typeof RadixDropdown.Separator>
>(function DropdownMenuSeparator({ className, ...props }, ref) {
  return <RadixDropdown.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-admin-line", className)} {...props} />;
});

export const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof RadixDropdown.RadioItem>,
  React.ComponentPropsWithoutRef<typeof RadixDropdown.RadioItem>
>(function DropdownMenuRadioItem({ className, children, ...props }, ref) {
  return (
    <RadixDropdown.RadioItem
      ref={ref}
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-md py-1.5 pl-7 pr-2 text-sm outline-none transition",
        "focus:bg-admin-subtle focus:text-admin-ink data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        <RadixDropdown.ItemIndicator>
          <Check className="size-3.5" />
        </RadixDropdown.ItemIndicator>
      </span>
      {children}
    </RadixDropdown.RadioItem>
  );
});
