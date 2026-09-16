"use client";

import { motion, useReducedMotion, type SVGMotionProps } from "motion/react";
import type { SVGProps } from "react";

export type OprynIconProps = SVGProps<SVGSVGElement> & { size?: number };

function IconFrame({ size = 20, children, ...props }: OprynIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

function BrandIconFrame({
  size = 20,
  children,
  style,
  ...props
}: OprynIconProps) {
  const reduceMotion = useReducedMotion();
  const svgProps = props as unknown as SVGMotionProps<SVGSVGElement>;
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      initial={false}
      whileHover={
        reduceMotion
          ? { opacity: 0.78 }
          : { y: -2, scale: 1.12, rotate: [0, -3, 3, 0] }
      }
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      style={{ transformOrigin: "center", ...style }}
      {...svgProps}
    >
      {children}
    </motion.svg>
  );
}

export function HomeIcon(props: OprynIconProps) {
  return (
    <BrandIconFrame {...props}>
      <path d="m3 14 13-11 13 11-4 4-9-8-9 8Z" fill="#285ED0" />
      <path d="M7 17 16 9v20H7Z" fill="#AFC9F2" />
      <path d="m16 9 9 8v12h-9Z" fill="#6B99E3" />
      <path d="M13 21h6v8h-6Z" fill="#16366B" />
      <path d="m3 14 4 4 9-8V3Z" fill="#285ED0" />
      <path d="m16 3 13 11-4 4-9-8Z" fill="#3E79DA" />
    </BrandIconFrame>
  );
}

export function TeachIcon(props: OprynIconProps) {
  return (
    <BrandIconFrame {...props}>
      <path d="M3 6h9l4 3v21l-5-3H3Z" fill="#AFC9F2" />
      <path d="m16 9 4-3h9v21h-8l-5 3Z" fill="#6B99E3" />
      <path d="M3 23h8l5 3v4l-5-3H3Z" fill="#285ED0" />
      <path d="m16 26 5-3h8v4h-8l-5 3Z" fill="#1649A1" />
      <path d="m16 17 2-6 10-10 4 4-10 10Z" fill="#285ED0" />
      <path d="m16 17 2-6 4 4Z" fill="#16366B" />
      <path d="m26 3 2-2 4 4-2 2Z" fill="#6B99E3" />
    </BrandIconFrame>
  );
}

export function AskIcon(props: OprynIconProps) {
  return (
    <BrandIconFrame {...props}>
      <path d="M12 12h17v13a3 3 0 0 1-3 3h-4l-5 4v-4h-5Z" fill="#AFC9F2" />
      <path
        d="M5 3h17a5 5 0 0 1 5 5v12a4 4 0 0 1-4 4H12l-8 6v-6H3V7a4 4 0 0 1 2-4Z"
        fill="#285ED0"
      />
      <path d="M17 12h10v8a4 4 0 0 1-4 4h-6Z" fill="#1649A1" />
      <path d="M9 10h11v2H9ZM9 16h8v2H9Z" fill="white" />
    </BrandIconFrame>
  );
}

export function KnowledgeIcon(props: OprynIconProps) {
  return (
    <BrandIconFrame {...props}>
      <rect x="3" y="5" width="8" height="24" rx="1.5" fill="#285ED0" />
      <rect x="12" y="3" width="8" height="26" rx="1.5" fill="#AFC9F2" />
      <path d="m21 8 6-1 5 21-6 1Z" fill="#6B99E3" />
      <path d="M3 22h8v7H4.5A1.5 1.5 0 0 1 3 27.5Z" fill="#1649A1" />
      <path d="M12 22h8v7h-6.5a1.5 1.5 0 0 1-1.5-1.5Z" fill="#6B99E3" />
      <path d="M6 10h2v7H6Z" fill="white" />
      <path d="M15 8h2v7h-2Z" fill="#285ED0" />
    </BrandIconFrame>
  );
}

export function TrainingIcon(props: OprynIconProps) {
  return (
    <IconFrame {...props}>
      <path d="m4 9 8-4 8 4-8 4z" />
      <path d="M7 11v5.5c2.8 2 7.2 2 10 0V11M20 9v6" />
    </IconFrame>
  );
}

export function TeamIcon(props: OprynIconProps) {
  return (
    <BrandIconFrame {...props}>
      <circle cx="24" cy="10" r="4.5" fill="#6B99E3" />
      <path d="M17 29v-7a7 7 0 0 1 14 0v7Z" fill="#AFC9F2" />
      <circle cx="12" cy="9" r="6" fill="#285ED0" />
      <path d="M2 29v-5a10 10 0 0 1 20 0v5Z" fill="#285ED0" />
      <path
        d="M17 15.3A10 10 0 0 1 22 24v5h-5v-7a7 7 0 0 1 2-4.9Z"
        fill="#1649A1"
      />
    </BrandIconFrame>
  );
}

export function NeedsYouIcon(props: OprynIconProps) {
  return (
    <BrandIconFrame {...props}>
      <path d="M7 4h15a3 3 0 0 1 3 3v23H4V7a3 3 0 0 1 3-3Z" fill="#AFC9F2" />
      <path d="M9 2h11v6H9Z" fill="#285ED0" />
      <path d="M9 13h11v2H9ZM9 19h8v2H9Z" fill="#6B99E3" />
      <path d="M23 14a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z" fill="#285ED0" />
      <path d="M23 14v18a9 9 0 0 0 0-18Z" fill="#1649A1" />
      <path d="M22 18h2v7h-2ZM22 27h2v2h-2Z" fill="white" />
    </BrandIconFrame>
  );
}

export function CallsIcon(props: OprynIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M7.2 4.5 9.5 8 7.8 9.8c1.2 2.7 3.3 4.8 6 6l1.8-1.7 3.9 2.5-.8 3c-.2.7-.9 1.1-1.6 1-7-.9-12.7-6.5-13.6-13.6-.1-.7.3-1.4 1-1.6z" />
    </IconFrame>
  );
}

export function ConnectionIcon(props: OprynIconProps) {
  return (
    <BrandIconFrame {...props}>
      <path d="M9 14 23 5l2 4-14 9Z" fill="#6B99E3" />
      <path d="m9 15 16 10-2 4L7 19Z" fill="#AFC9F2" />
      <rect x="20" y="2" width="10" height="10" rx="2" fill="#285ED0" />
      <rect x="20" y="22" width="10" height="10" rx="2" fill="#6B99E3" />
      <rect x="2" y="10" width="14" height="14" rx="3" fill="#285ED0" />
      <path d="M9 10h4a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H9Z" fill="#1649A1" />
      <rect x="6" y="14" width="6" height="6" rx="1" fill="white" />
    </BrandIconFrame>
  );
}

export function IntegrationsIcon(props: OprynIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M8 4v5M16 4v5M6 9h12v2a6 6 0 0 1-6 6v3" />
      <path d="M9 20h6" />
    </IconFrame>
  );
}

export function SettingsIcon(props: OprynIconProps) {
  return (
    <BrandIconFrame {...props}>
      <path
        d="M13 2h6l1 4 3 2 4-1 3 5-3 3v3l3 3-3 5-4-1-3 2-1 4h-6l-1-4-3-2-4 1-3-5 3-3v-3l-3-3 3-5 4 1 3-2Z"
        fill="#AFC9F2"
      />
      <path
        d="M16 2h3l1 4 3 2 4-1 3 5-3 3v3l3 3-3 5-4-1-3 2-1 4h-3Z"
        fill="#6B99E3"
      />
      <circle cx="16" cy="16.5" r="8" fill="#285ED0" />
      <circle cx="16" cy="16.5" r="3.5" fill="white" />
    </BrandIconFrame>
  );
}

export function HelpIcon(props: OprynIconProps) {
  return (
    <BrandIconFrame {...props}>
      <path d="M16 2a14 14 0 1 0 0 28Z" fill="#285ED0" />
      <path d="M16 2a14 14 0 0 1 0 28Z" fill="#6B99E3" />
      <path
        d="M11 12a5 5 0 0 1 10 0c0 2.5-1.3 3.4-3 4.4-1.5.9-2 1.6-2 3.1"
        stroke="white"
        strokeWidth="2.5"
      />
      <circle cx="16" cy="24" r="1.5" fill="white" />
    </BrandIconFrame>
  );
}

export function ApprovedIcon(props: OprynIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M7.2 4.8A8.5 8.5 0 1 1 4 9" />
      <path d="m8.2 12.2 2.5 2.5 5.3-5.5" />
    </IconFrame>
  );
}

export function ObservedIcon(props: OprynIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M12 3.5a8.5 8.5 0 1 1-8 5.7" />
      <path d="M4 9.2V5.5M4 9.2h3.7" />
      <path d="M12 8v4l2.8 1.8" />
    </IconFrame>
  );
}

export function UnknownIcon(props: OprynIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M8.5 4.3a8.5 8.5 0 0 1 9.8 13.3M5.7 6.5A8.5 8.5 0 0 0 4 14.6" />
      <path d="M12 8.2c1.6 0 2.6.8 2.6 2.1 0 1.8-2.6 1.7-2.6 3.4M12 17h.01" />
    </IconFrame>
  );
}

export function ProcessIcon(props: OprynIconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="12" r="2" />
      <circle cx="6" cy="18" r="2" />
      <path d="M8 6h3a3 3 0 0 1 3 3v0M14 15v0a3 3 0 0 1-3 3H8M14 12h2" />
    </IconFrame>
  );
}

export function RuleIcon(props: OprynIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M7 3.8h8l3 3V20H7z" />
      <path d="M15 3.8V7h3M10 11h5M10 15h5" />
    </IconFrame>
  );
}

export function FaqIcon(props: OprynIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4 5h16v12H9l-5 3z" />
      <path d="M9.5 9.2A2.5 2.5 0 0 1 12 7c1.5 0 2.5.8 2.5 2 0 1.8-2.5 1.7-2.5 3.2M12 14.8h.01" />
    </IconFrame>
  );
}

export function ExpertIcon(props: OprynIconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="8" r="3.3" />
      <path d="M5.5 20c.4-4.2 2.6-6.3 6.5-6.3s6.1 2.1 6.5 6.3" />
      <path d="m17.5 4 .5 1 .9.5-1 .5-.5 1-.5-1-1-.5 1-.5z" />
    </IconFrame>
  );
}

export function DocumentIcon(props: OprynIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M6 3.8h8l4 4V20H6z" />
      <path d="M14 3.8V8h4M9 12h6M9 16h6" />
    </IconFrame>
  );
}

export function DriveIcon(props: OprynIconProps) {
  return (
    <IconFrame {...props}>
      <path d="m9.2 4-5 9 2.6 4.5L12 8.7 9.2 4zM12 8.7 14.8 4l5 9h-5.2L12 8.7zM6.8 17.5h10.4L19.8 13H9.4l-2.6 4.5z" />
    </IconFrame>
  );
}

export function SourceIcon(props: OprynIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M8.5 8.5 6.2 10.8a3.1 3.1 0 0 0 4.4 4.4l2.3-2.3M15.5 15.5l2.3-2.3a3.1 3.1 0 0 0-4.4-4.4l-2.3 2.3" />
    </IconFrame>
  );
}

export function ConflictIcon(props: OprynIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M12 3.5v4M12 16.5v4M4 12h4M16 12h4" />
      <path d="m8 8 8 8M16 8l-8 8" />
    </IconFrame>
  );
}

export function FreshnessIcon(props: OprynIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4.5 10a8 8 0 1 1 1.8 6.4" />
      <path d="M4.5 10V5.8M4.5 10h4.2M12 7.5V12l3 2" />
    </IconFrame>
  );
}

export function RememberIcon(props: OprynIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M5 5.5h14v13H5z" />
      <path d="M8 5.5v5h8v-5M9 18.5v-4h6v4" />
    </IconFrame>
  );
}

export function TimeReturnedIcon(props: OprynIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M7 4.8A8.5 8.5 0 1 1 4 9" />
      <path d="M4 5.5V9h3.5M12 7.5V12l3 2" />
    </IconFrame>
  );
}
