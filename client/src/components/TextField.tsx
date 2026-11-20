import { useId, type ReactNode, type Ref } from 'react';
import { VARIANT_CLASSES, type FieldVariant } from './fieldVariants';

type TextFieldProps = {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'password' | 'date';
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  // Extra, always-visible guidance, e.g. "At least 8 characters."
  hint?: string;
  // Present means "this field is invalid".
  error?: string | undefined;
  // Something to show right after the error text, e.g. a "Log in instead" link. It is part of the error text for
  // screen readers too, because it sits inside the same element the input's aria-describedby points to.
  errorAction?: ReactNode;
  autoCapitalize?: 'none' | 'words';
  // Only meaningful for type="date" (YYYY-MM-DD): the browser's picker greys out days outside the range. It is a convenience;
  // the page still validates the value itself, because typing can bypass it.
  min?: string;
  max?: string;
  variant?: FieldVariant;
  // React 19 passes `ref` to function components as a normal prop.
  ref?: Ref<HTMLInputElement>;
};

// A labelled text input whose hint and error are wired to it for assistive technology:
//  - <label for> names the input (also makes clicking the label focus it);
//  - aria-describedby points at the hint and, when there is one, the error, so a screen reader reads them after the label;
//  - aria-invalid says the value is wrong, and the error itself is text (not just a red border).
export default function TextField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  autoComplete,
  hint,
  error,
  errorAction,
  autoCapitalize,
  min,
  max,
  variant = 'default',
  ref,
}: TextFieldProps) {
  // useId gives each field instance a unique, stable id, so two fields on a page can never share one.
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
      <input
        id={id}
        ref={ref}
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        min={min}
        max={max}
        autoComplete={autoComplete}
        autoCapitalize={autoCapitalize}
        spellCheck={type === 'text' ? undefined : false}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        // slate-500 (not a paler grey): the edge of a form control needs 3:1 contrast against its background.
        className={`${classes.control} ${error ? classes.controlInvalid : classes.controlValid}`}
      />
      {hint && (
        <p id={hintId} className={classes.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={classes.error}>
          {error}
          {errorAction}
        </p>
      )}
    </div>
  );
}
