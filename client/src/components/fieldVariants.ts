// "segment" is the look of one cell in the Find-a-table search bar: small uppercase label, borderless value. "default" is the
// look used by the auth forms and must not change. Shared by TextField and SelectField so the two cannot drift apart.
export type FieldVariant = 'default' | 'segment';

// The ring is drawn inside the cell (negative offset) so the bar's rounded edge does not clip it. Ink, because it sits on white.
const SEGMENT_FOCUS = 'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink';

export const VARIANT_CLASSES = {
  default: {
    wrapper: '',
    label: 'block text-[13px] font-semibold text-body',
    control:
      'mt-1.5 block min-h-[50px] w-full rounded-xl border bg-white px-4 text-base text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
    controlValid: 'border-field',
    controlInvalid: 'border-[1.5px] border-danger',
    hint: 'mt-1.5 text-sm text-muted',
    error: 'mt-1.5 text-sm font-medium text-danger',
  },
  segment: {
    wrapper: 'flex h-full flex-col justify-center px-5 py-3',
    label: 'block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted',
    control: `mt-1 block min-h-11 w-full rounded bg-transparent text-base font-semibold text-ink ${SEGMENT_FOCUS}`,
    controlValid: '',
    controlInvalid: '',
    hint: 'mt-1 text-sm text-muted',
    error: 'mt-1 text-sm font-medium text-danger-text',
  },
} as const;
