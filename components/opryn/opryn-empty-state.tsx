import { OprynArc } from "@/components/opryn/opryn-arc";

export function OprynEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="opryn-empty-state">
      <OprynArc size={48} progress={58} state="unknown" />
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? (
        <div className="opryn-empty-state__action">{action}</div>
      ) : null}
    </section>
  );
}
