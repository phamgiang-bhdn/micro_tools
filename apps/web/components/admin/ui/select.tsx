"use client";

import * as React from "react";
import * as RadixSelect from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../../lib/utils";

/**
 * Rich Select primitive (Radix). Thay thế HTML `<select>` ở khắp admin.
 * Hỗ trợ search-by-key (Radix tự lo), keyboard nav, scroll khi nhiều options.
 *
 * Vẫn export `SelectField` (Field wrapper) ở `controlled-fields.tsx` để dùng với RHF.
 * Component này chỉ là Radix primitive thuần.
 */
export const Select = RadixSelect.Root;
export const SelectGroup = RadixSelect.Group;
export const SelectValue = RadixSelect.Value;

interface SelectTriggerProps
  extends React.ComponentPropsWithoutRef<typeof RadixSelect.Trigger> {
  /** Class size: mặc định "md" (h-10). */
  size?: "sm" | "md";
}

const TRIGGER_SIZE: Record<NonNullable<SelectTriggerProps["size"]>, string> = {
  sm: "h-8 text-xs",
  md: "h-10 text-sm"
};

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof RadixSelect.Trigger>,
  SelectTriggerProps
>(function SelectTrigger({ className, children, size = "md", ...props }, ref) {
  return (
    <RadixSelect.Trigger
      ref={ref}
      className={cn(
        "inline-flex w-full items-center justify-between gap-2 rounded-lg border border-admin-line bg-admin-surface px-3 text-admin-ink transition",
        "placeholder:text-admin-mute focus:border-admin-accent focus:outline-none focus:ring-2 focus:ring-admin-accent/20",
        "data-[placeholder]:text-admin-mute disabled:cursor-not-allowed disabled:opacity-60",
        TRIGGER_SIZE[size],
        className
      )}
      {...props}
    >
      {children}
      <RadixSelect.Icon asChild>
        <ChevronDown className="size-4 shrink-0 opacity-60" />
      </RadixSelect.Icon>
    </RadixSelect.Trigger>
  );
});

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof RadixSelect.Content>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Content>
>(function SelectContent({ className, children, position = "popper", ...props }, ref) {
  return (
    <RadixSelect.Portal>
      <RadixSelect.Content
        ref={ref}
        position={position}
        className={cn(
          "z-50 max-h-[var(--radix-select-content-available-height,18rem)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-admin-line bg-admin-surface shadow-card-md",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          position === "popper" && "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
          className
        )}
        {...props}
      >
        <RadixSelect.ScrollUpButton className="flex h-6 items-center justify-center bg-admin-surface text-admin-mute">
          <ChevronUp className="size-3.5" />
        </RadixSelect.ScrollUpButton>
        <RadixSelect.Viewport
          className={cn("p-1", position === "popper" && "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]")}
        >
          {children}
        </RadixSelect.Viewport>
        <RadixSelect.ScrollDownButton className="flex h-6 items-center justify-center bg-admin-surface text-admin-mute">
          <ChevronDown className="size-3.5" />
        </RadixSelect.ScrollDownButton>
      </RadixSelect.Content>
    </RadixSelect.Portal>
  );
});

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof RadixSelect.Item>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Item>
>(function SelectItem({ className, children, ...props }, ref) {
  return (
    <RadixSelect.Item
      ref={ref}
      className={cn(
        "relative flex w-full cursor-default select-none items-center gap-2 rounded-md py-1.5 pl-7 pr-2 text-sm text-admin-ink outline-none transition",
        "focus:bg-admin-subtle data-[state=checked]:font-medium data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        <RadixSelect.ItemIndicator>
          <Check className="size-3.5 text-admin-accent" />
        </RadixSelect.ItemIndicator>
      </span>
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
    </RadixSelect.Item>
  );
});

export const SelectLabel = React.forwardRef<
  React.ElementRef<typeof RadixSelect.Label>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Label>
>(function SelectLabel({ className, ...props }, ref) {
  return (
    <RadixSelect.Label
      ref={ref}
      className={cn("px-2 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-admin-mute", className)}
      {...props}
    />
  );
});

export const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof RadixSelect.Separator>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Separator>
>(function SelectSeparator({ className, ...props }, ref) {
  return <RadixSelect.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-admin-line", className)} {...props} />;
});
