import { useId, type Ref } from 'react';
import { VARIANT_CLASSES, type FieldVariant } from './fieldVariants';

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
  variant?: FieldVariant;
  ref?: Ref<HTMLSelectElement>;
};

// A labelled <select> wired like TextField (label, hint and error are part of its accessible name and description).
// A select is used where only certain values are valid (a 15-minute grid, a fixed range), so a wrong value cannot be typed.
export default function SelectField({ label, name, value, onChange, options, hint, error, variant = 'default', ref }: SelectFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const classes = VARIANT_CLASSES[variant];
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter((part) => part !== null).join(' ');

  return (
    <div className={classes.wrapper || undefined}>
      <label htmlFor={id} className={classes.label}>
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
        className={`${classes.control} ${error ? classes.controlInvalid : classes.controlValid}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && (
        <p id={hintId} className={classes.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={classes.error}>
          {error}
        </p>
      )}
    </div>
  );
}
