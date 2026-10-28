import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--accent)] text-[var(--accent-ink)] hover:bg-[var(--accent-strong)] border-transparent",
  secondary:
    "bg-[var(--surface-raised)] text-[var(--text)] hover:border-[var(--border-strong)] border-[var(--border)]",
  quiet: "bg-transparent text-[var(--text-muted)] hover:text-[var(--text)] border-transparent",
  danger: "bg-transparent text-[var(--danger)] border-[var(--border)] hover:border-[var(--danger)]",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
}

export function Button({ children, className = "", variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-sm)] border px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
