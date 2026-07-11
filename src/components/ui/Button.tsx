import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dashed";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  fullWidth?: boolean;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-dark border border-accent shadow-sm",
  secondary:
    "bg-white text-foreground border border-border hover:bg-cream-dark",
  ghost: "bg-transparent text-muted hover:text-foreground",
  danger: "bg-transparent text-red-600 hover:text-red-700",
  dashed:
    "bg-white text-foreground border border-dashed border-border hover:border-accent hover:text-accent",
};

export function Button({
  className,
  variant = "primary",
  fullWidth,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
