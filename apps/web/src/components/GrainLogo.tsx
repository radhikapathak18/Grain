// Grain brand mark.
//
// Concept: a geometric wheat grain kernel — a precise almond/lens shape
// (pointed oval) tilted 12°, with a thin midrib line through the centre.
// Represents the concentrated essence extracted from scattered research;
// the midrib suggests synthesis — threads converging through a single centre.
// Designed to live inside the `grain-gradient-brand` squircle wrappers used
// in AppHeader / LoginView, so it renders via `currentColor` (no gradient of
// its own) to avoid a background-on-background visual collision.
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
      <g transform="rotate(12, 16, 16)">
        {/* Grain kernel: geometric almond / pointed oval */}
        <path
          d="M 16 4 C 24 8 24 24 16 28 C 8 24 8 8 16 4 Z"
          fill="currentColor"
        />
        {/* Midrib: central vein rendered as a semi-transparent shadow within the shape */}
        <line
          x1="16" y1="6.5" x2="16" y2="25.5"
          stroke="rgba(0,0,0,0.22)"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
