import type { ReactNode } from "react";

interface FieldProps {
  children: ReactNode;
  description?: string;
  error?: string;
  id: string;
  label: string;
}

export function Field({ children, description, error, id, label }: FieldProps) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-semibold text-[var(--text)]" htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-[var(--danger)]" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : description ? (
        <p className="text-sm leading-5 text-[var(--text-muted)]" id={`${id}-description`}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
