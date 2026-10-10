import type { ButtonHTMLAttributes, HTMLAttributes } from "react";

export function Button({
  className = "",
  variant = "primary",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet" | "danger";
}) {
  const variants = {
    primary: "bg-accent text-on-accent hover:bg-accent-hover",
    secondary: "border border-line bg-surface text-ink hover:bg-canvas",
    quiet: "text-muted hover:bg-hover hover:text-ink",
    danger: "bg-danger-soft text-danger hover:bg-danger hover:text-white",
  };
  return (
    <button
      type={type}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function IconButton({
  label,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-ink disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Badge({
  className = "",
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "positive" | "warning" | "danger";
}) {
  const tones = {
    neutral: "bg-hover text-muted",
    positive: "bg-accent-soft text-accent",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium leading-none ${tones[tone]} ${className}`}
      {...props}
    />
  );
}
