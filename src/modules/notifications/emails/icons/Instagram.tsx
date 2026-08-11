import type { SVGProps } from "react";

const Instagram = (props: SVGProps<SVGSVGElement>) => (
  <svg {...props} fill="none" viewBox="0 0 24 24">
    <rect
      width="18"
      height="18"
      x="3"
      y="3"
      stroke="#a3a3a3"
      strokeWidth="1.75"
      rx="5"
    />
    <circle
      cx="12"
      cy="12"
      r="4.25"
      stroke="#a3a3a3"
      strokeWidth="1.75"
    />
    <circle cx="17.5" cy="6.5" r="1.25" fill="#a3a3a3" />
  </svg>
);

export { Instagram };
