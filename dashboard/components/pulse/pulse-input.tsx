"use client";

import type { InputHTMLAttributes } from "react";
import { forwardRef, useId } from "react";

export type PulseInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  successMessage?: string;
  error?: string;
  inputClassName?: string;
};

export const PulseInput = forwardRef<HTMLInputElement, PulseInputProps>(function PulseInput(
  { label, hint, successMessage, error, id, className = "", inputClassName = "", ...rest },
  ref
) {
  const gen = useId();
  const fid = id ?? gen;
  const invalid = Boolean(error);

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={fid} className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
        {label}
      </label>
      <input
        ref={ref}
        id={fid}
        aria-invalid={invalid}
        aria-describedby={
          hint || successMessage || error
            ? `${fid}-desc`
            : undefined
        }
        className={`input w-full rounded-xl border bg-canvas px-3 py-2.5 text-sm text-ink transition-[box-shadow,transform,border-color] duration-200 ${
          invalid
            ? "border-coral-500 motion-safe:animate-shake"
            : successMessage
              ? "border-mint-500/50"
              : "border-subtle"
        } ${inputClassName}`}
        {...rest}
      />
      {hint && !error && !successMessage ? (
        <p id={`${fid}-desc`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {successMessage ? (
        <p id={`${fid}-desc`} className="text-xs font-semibold text-mint-400">
          {successMessage}
        </p>
      ) : null}
      {error ? (
        <p id={`${fid}-desc`} className="text-xs font-semibold text-coral-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
});
