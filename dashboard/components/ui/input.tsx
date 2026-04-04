"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | null;
  hint?: string | null;
};

export function Input({ className, label, error, hint, type = "text", value, ...props }: Props) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  const actualType = isPassword ? (visible ? "text" : "password") : type;
  const filled = typeof value === "string" ? value.length > 0 : Boolean(value);

  return (
    <label className={cn("pulse-input-wrap", error && "has-error", filled && "is-filled", className)} htmlFor={id}>
      <input {...props} id={id} type={actualType} className="pulse-input" value={value} />
      <span className="pulse-input-label">{label}</span>
      {isPassword ? (
        <button
          type="button"
          className="pulse-input-toggle"
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
        </button>
      ) : null}
      {error ? <span className="pulse-input-error">{error}</span> : hint ? <span className="pulse-input-hint">{hint}</span> : null}
    </label>
  );
}
