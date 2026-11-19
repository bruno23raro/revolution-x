import * as React from "react";
import { cn } from "@/lib/cn";

type V = "primary" | "secondary" | "ghost" | "danger" | "outline";
type S = "sm" | "md" | "lg";

const STYLES: Record<V, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "bg-neutral-100 text-neutral-900 hover:bg-neutral-200",
  ghost: "hover:bg-neutral-100",
  danger: "bg-red-600 text-white hover:bg-red-700",
  outline: "border border-neutral-300 hover:bg-neutral-50",
};

const SIZES: Record<S, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: V; size?: S; loading?: boolean }>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...p }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50",
        STYLES[variant],
        SIZES[size],
        className
      )}
      {...p}
    >
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  )
);
Button.displayName = "Button";