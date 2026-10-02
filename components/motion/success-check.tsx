"use client";

import { OprynIcon } from "@/components/opryn-icons/opryn-icon";

/** Decorative confirmation. The parent supplies the authoritative status text. */
export function SuccessCheck({
  variant = "compact",
}: {
  variant?: "compact" | "normal" | "milestone";
}) {
  const size = { compact: 18, normal: 28, milestone: 40 }[variant];
  return <OprynIcon name="approved" size={size} success />;
}
