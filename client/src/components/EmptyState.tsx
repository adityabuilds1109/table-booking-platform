import type { ReactNode } from 'react';

type Props = {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
};

// "Nothing here" with a way forward: an icon, what is missing, what to do about it, and optionally a button.
// The title is a paragraph, not a heading, so the page's heading levels stay correct wherever this is placed.
export default function EmptyState({ icon, title, children, action }: Props) {
  return (
    <div className="card mt-4 flex flex-col items-center px-4 py-10 text-center sm:px-6">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-tint text-accent-strong">{icon}</span>
      <p className="mt-4 font-display text-lg font-bold text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-ink-soft">{children}</p>
      {action !== undefined && <div className="mt-6">{action}</div>}
    </div>
  );
}
