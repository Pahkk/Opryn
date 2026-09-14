import Link from "next/link";
import { SourceIcon } from "@/components/opryn-icons/opryn-icons";

export function OprynSourceChip({
  label,
  href,
}: {
  label: string;
  href?: string | null;
}) {
  const content = (
    <>
      <SourceIcon size={14} />
      <span>{label}</span>
    </>
  );
  return href ? (
    <Link href={href} className="opryn-source-chip">
      {content}
    </Link>
  ) : (
    <span className="opryn-source-chip">{content}</span>
  );
}
