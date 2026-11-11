import { useId, type Ref } from 'react';

export type SelectOption = { value: string; label: string };

type SelectFieldProps = {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  hint?: string;
  // Present means "this field is invalid".
  error?: string | undefined;
  ref?: Ref<HTMLSelectElement>;
};

// A labelled <select> wired like TextField (label, hint and error are part of its accessible name and description).
// A select is used where only certain values are valid (a 15-minute grid, a fixed range), so a wrong value cannot be typed.
export default function SelectField({ label, name, value, onChange, options, hint, error, ref }: SelectFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter((part) => part !== null).join(' ');

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <select
        id={id}
        ref={ref}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={`focus-ring mt-1 block min-h-11 w-full rounded-control border bg-surface px-3 py-2 text-ink ${
          error ? 'border-danger' : 'border-line-strong'
        }`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && (
        <p id={hintId} className="mt-1 text-sm text-ink-soft">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
