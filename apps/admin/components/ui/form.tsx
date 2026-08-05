'use client';

import { useId, type ReactNode } from 'react';

/**
 * The panel's form inputs.
 *
 * They share one wrapper so that a label is always associated with its control
 * and a field error always appears in the same place. The editors previously
 * rendered twenty-five labels of which three were actually tied to an input,
 * which is invisible until someone uses a screen reader or clicks a label and
 * nothing focuses.
 */

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  // Explicitly `| undefined` rather than optional: under
  // exactOptionalPropertyTypes, forwarding an optional prop is not the same as
  // omitting it, and every caller here forwards.
  hint: string | undefined;
  error: string | undefined;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-red-500">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-faint">{hint}</p>
      )}
    </div>
  );
}

interface Common {
  label: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  hint,
  error,
  disabled,
}: Common & {
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        value={value}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-errormessage={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="field-input"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  hint,
  error,
  disabled,
}: Common & {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        type="number"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-errormessage={error ? `${id}-error` : undefined}
        // An empty box is not zero. Reporting NaN lets the caller decide, rather
        // than silently writing 0 over a value someone was in the middle of
        // retyping.
        onChange={(e) => onChange(e.target.value === '' ? Number.NaN : Number(e.target.value))}
        className="field-input"
      />
    </Field>
  );
}

export function DateField({
  label,
  value,
  onChange,
  hint,
  error,
  disabled,
}: Common & {
  /** ISO date, or empty for unset. */
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        type="date"
        value={value ? value.slice(0, 10) : ''}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-errormessage={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="field-input"
      />
    </Field>
  );
}

export function SwitchField({
  label,
  checked,
  onChange,
  hint,
  disabled,
}: Omit<Common, 'error'> & {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="flex-1 cursor-pointer">
        <span className="text-sm font-medium text-fg">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-faint">{hint}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
          checked ? 'brand-gradient-bg' : 'bg-overlay/20'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

/**
 * Search input for a list.
 *
 * Controlled and debounce-free on purpose: the lists it serves query the server,
 * and the caller decides when to fire. Deciding that here would hide the request
 * from the screen making it.
 */
export function SearchBar({
  value,
  onChange,
  placeholder = 'Ara...',
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
}) {
  const id = useId();
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
      className="relative flex-1"
    >
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <input
        id={id}
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="field-input"
      />
    </form>
  );
}
