import type { ReactNode } from 'react';

// Small line icons, drawn inline so no icon library is needed. They are decoration: the text beside each one carries the
// meaning, so they are hidden from assistive technology.
type IconProps = { className?: string | undefined };

function Icon({ className = 'h-5 w-5', children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export const IconPeople = ({ className }: IconProps) => (
  <Icon className={className}>
    <circle cx="9" cy="8" r="3.25" />
    <path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
    <path d="M16 5a3.25 3.25 0 0 1 0 6M18 14c1.7.7 3 2.3 3 5" />
  </Icon>
);

export const IconClock = ({ className }: IconProps) => (
  <Icon className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);

export const IconCheck = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
);

// An empty plate with a slash: "nothing free".
export const IconNoTable = ({ className }: IconProps) => (
  <Icon className={className}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3.5" />
    <path d="M5 5l14 14" />
  </Icon>
);
