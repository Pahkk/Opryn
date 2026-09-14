import {
  ApprovedIcon,
  ObservedIcon,
  UnknownIcon,
} from "@/components/opryn-icons/opryn-icons";
import { CircleAlert } from "lucide-react";

export type OprynStatusKind =
  | "approved"
  | "observed"
  | "unknown"
  | "needs-you"
  | "connected"
  | "draft";

const labels: Record<OprynStatusKind, string> = {
  approved: "Approved",
  observed: "Observed",
  unknown: "Unknown",
  "needs-you": "Needs you",
  connected: "Connected",
  draft: "Draft",
};

export function OprynStatus({
  kind,
  label = labels[kind],
}: {
  kind: OprynStatusKind;
  label?: string;
}) {
  const Icon =
    kind === "approved" || kind === "connected"
      ? ApprovedIcon
      : kind === "observed"
        ? ObservedIcon
        : kind === "needs-you"
          ? CircleAlert
          : UnknownIcon;
  return (
    <span className={`opryn-status opryn-status--${kind}`}>
      <Icon size={14} />
      {label}
    </span>
  );
}
