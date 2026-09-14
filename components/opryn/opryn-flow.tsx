import { OprynArc } from "@/components/opryn/opryn-arc";
import { OprynConnector } from "@/components/opryn/opryn-connector";

export function OprynFlow({
  steps,
  activeStep,
}: {
  steps: string[];
  activeStep: number;
}) {
  return (
    <ol className="opryn-flow" aria-label="Opryn learning progress">
      {steps.map((step, index) => {
        const complete = index < activeStep;
        const active = index === activeStep;
        return (
          <li
            key={step}
            className={`opryn-flow__step ${complete ? "is-complete" : ""} ${active ? "is-active" : ""}`}
          >
            <OprynArc
              size={24}
              progress={complete ? 100 : active ? 64 : 28}
              state={complete ? "approved" : active ? "active" : "unknown"}
            />
            <span>{step}</span>
            {index < steps.length - 1 ? (
              <OprynConnector className="opryn-flow__connector" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
