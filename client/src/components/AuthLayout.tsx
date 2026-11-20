import type { ReactNode } from 'react';

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

// Shared looks for the Login and Register forms, so the two pages cannot drift apart.
export const AUTH_SUBMIT_CLASS = `min-h-12 w-full rounded-xl bg-ink px-5 font-semibold text-white hover:bg-ink-raised ${FOCUS_RING} disabled:cursor-not-allowed disabled:bg-ink-line disabled:text-on-ink-disabled`;
export const AUTH_ERROR_BOX_CLASS = 'rounded-xl border border-danger-line bg-danger-soft p-4 text-danger-text';
export const AUTH_LINK_CLASS = `rounded font-semibold text-brass-text underline ${FOCUS_RING}`;

type AuthLayoutProps = {
  eyebrow: string;
  sentence: string;
  children: ReactNode;
};

// Two columns that stack on small screens: a dark brand panel (hidden under 768 px) and the form column.
export default function AuthLayout({ eyebrow, sentence, children }: AuthLayoutProps) {
  return (
    <div className="grid md:min-h-[560px] md:grid-cols-2">
      <div className="hidden bg-ink md:flex md:items-center md:justify-end md:px-8 md:py-16 lg:px-16">
        <div className="w-full max-w-[440px]">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brass">{eyebrow}</p>
          <p className="mt-3 font-display text-[48px] leading-[1.05] font-bold tracking-[-0.03em] text-white">
            Your table, held for you.
          </p>
          <p className="mt-4 text-on-ink-muted">{sentence}</p>
        </div>
      </div>
      <div className="px-4 py-12 sm:px-8 md:flex md:items-center md:py-16 lg:px-16">
        <div className="mx-auto w-full max-w-[400px] md:mx-0">{children}</div>
      </div>
    </div>
  );
}
