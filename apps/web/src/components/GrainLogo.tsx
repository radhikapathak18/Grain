// Grain brand mark.
//
// Concept: a single arc traces a "G" that opens to the right; an inner bar
// shoots inward and terminates in a small grain dot — "scattered research
// synthesized to a single grain of insight." Designed to live inside the
// `grain-gradient-brand` squircle wrappers used in AppHeader / LoginView, so
// it renders via `currentColor` (no gradient of its own) to avoid a
// background-on-background visual collision.
//
// The standalone gradient version (with squircle background) lives at
// /favicon.svg for use as the browser-tab favicon.

import type { SVGProps } from 'react';

type Props = {
  size?: number;
  className?: string;
  title?: string;
} & Omit<SVGProps<SVGSVGElement>, 'children'>;

export function GrainLogo({
  size = 24,
  className,
  title = 'Grain',
  ...rest
}: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title}
      {...rest}
    >
      <path
        d="M 21 12 A 7 7 0 1 0 21 20 L 16 20"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="13.4" cy="20" r="1.5" fill="currentColor" />
    </svg>
  );
}
