import type { SVGProps } from "react";
import { OprynIcon } from "./opryn-icon";

export type OprynIconProps = SVGProps<SVGSVGElement> & { size?: number };

export function SupportIcon(props: OprynIconProps) {
  return (
    <OprynIcon
      name="support"
      size={props.size ?? 20}
      className={props.className}
    />
  );
}

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

export function HomeIcon(props: OprynIconProps) {
  return (
    <OprynIcon
      name="home"
      size={props.size ?? 20}
      className={props.className}
    />
  );
}

export function TeachIcon(props: OprynIconProps) {
  return (
    <OprynIcon
      name="teach"
      size={props.size ?? 20}
      className={props.className}
    />
  );
}

export function AskIcon(props: OprynIconProps) {
  return (
    <OprynIcon name="ask" size={props.size ?? 20} className={props.className} />
  );
}

export function KnowledgeIcon(props: OprynIconProps) {
  return (
    <OprynIcon
      name="knowledge"
      size={props.size ?? 20}
      className={props.className}
    />
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
    <OprynIcon
      name="team"
      size={props.size ?? 20}
      className={props.className}
    />
  );
}

export function NeedsYouIcon(props: OprynIconProps) {
  return (
    <OprynIcon
      name="needs-you"
      size={props.size ?? 20}
      className={props.className}
    />
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
    <OprynIcon
      name="connections"
      size={props.size ?? 20}
      className={props.className}
    />
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
    <OprynIcon
      name="settings"
      size={props.size ?? 20}
      className={props.className}
    />
  );
}

export function ApprovedIcon(props: OprynIconProps) {
  return (
    <OprynIcon
      name="approved"
      size={props.size ?? 20}
      className={props.className}
    />
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

export function PolicyIcon(props: OprynIconProps) {
  return <RuleIcon {...props} />;
}
export function DecisionIcon(props: OprynIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M12 4v6M5 20v-6h14v6M12 10v4" />
      <circle cx="12" cy="4" r="2" />
      <path d="m3 19 2 2 3-4M17 18l4 4m0-4-4 4" />
    </IconFrame>
  );
}
export function ExceptionIcon(props: OprynIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M6 4h12v16H6zM10 8h4M12 11v3M12 17h.01" />
    </IconFrame>
  );
}
export function ApproverIcon(props: OprynIconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="9" cy="7" r="3" />
      <path d="M3 19c0-4 2-6 6-6M14 15l2 2 5-6" />
    </IconFrame>
  );
}
export function AIConnectionIcon(props: OprynIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4 5h10v9H4zM7 9h4M14 10h3a3 3 0 0 1 0 6h-3M10 14v5h7" />
    </IconFrame>
  );
}
export function TestAnswerIcon(props: OprynIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M6 4h12v16H6zM9 8h6M9 12h3m-3 4 2 2 4-5" />
    </IconFrame>
  );
}
export function ImpactIcon(props: OprynIconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4m-1-1 1 1-1 1" />
    </IconFrame>
  );
}
export function ArchiveIcon(props: OprynIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4 4h16v4H4zM6 8v12h12V8M10 12h4" />
    </IconFrame>
  );
}
