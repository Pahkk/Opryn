import "./feedback.css";

/** Official symbol, not an AI-working orb. One image sprite, no generated logo art. */
export function SystemLoading({
  label = "Opening your workspace…",
}: {
  label?: string;
}) {
  return (
    <div className="opryn-system-loading" role="status">
      <span
        className="opryn-logo-sprite"
        style={{ backgroundImage: "url('/favicon-48x48.png')" }}
        aria-hidden="true"
      />
      <span>{label}</span>
    </div>
  );
}
