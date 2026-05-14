import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../../lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "brand";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: Variant;
  size?: Size;
}

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition active:translate-y-px disabled:pointer-events-none disabled:opacity-40 ring-focus";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-google-blue text-white shadow-card hover:bg-google-blue-hover",
  brand: "bg-brand-gradient text-white shadow-glow hover:brightness-110",
  secondary: "bg-ink text-white shadow-card hover:bg-ink/90",
  outline: "border border-line bg-white text-ink hover:border-brand-300 hover:text-brand-700",
  ghost: "text-ink-soft hover:bg-white"
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-5 text-sm min-w-[7.5rem]",
  lg: "h-12 px-6 text-base"
};

export function Button({
  className,
  asChild = false,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps): React.ReactElement {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...props} />;
}
