import { OprynArc } from "@/components/opryn/opryn-arc";

export function OprynMetric({
  label,
  value,
  detail,
  progress,
}: {
  label: string;
  value: React.ReactNode;
  detail?: string;
  progress?: number;
}) {
  return (
    <div className="opryn-metric">
      {typeof progress === "number" ? (
        <OprynArc size={42} progress={progress} state="active" />
      ) : null}
      <div>
        <p className="opryn-metric__label">{label}</p>
        <p className="opryn-metric__value">{value}</p>
        {detail ? <p className="opryn-metric__detail">{detail}</p> : null}
      </div>
    </div>
  );
}
