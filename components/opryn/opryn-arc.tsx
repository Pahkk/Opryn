type ArcState = "approved" | "observed" | "unknown" | "active";

export function OprynArc({
  size = 40,
  state = "active",
  label,
  className = "",
}: {
  size?: number;
  progress?: number;
  state?: ArcState;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={`opryn-progress-mark opryn-progress-mark--${state} ${className}`}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg
        viewBox="0 0 24 24"
        style={{ width: Math.max(14, size * 0.46) }}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {state === "approved" ? <path d="m6.5 12.4 3.2 3.2 7.8-8" /> : null}
        {state === "observed" ? (
          <>
            <path d="M4.2 12s2.9-4.5 7.8-4.5 7.8 4.5 7.8 4.5-2.9 4.5-7.8 4.5S4.2 12 4.2 12Z" />
            <path d="M12 10.1a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8Z" />
          </>
        ) : null}
        {state === "unknown" ? (
          <>
            <path d="M8.8 9.2a3.3 3.3 0 1 1 5.3 2.6c-1.3.9-2.1 1.4-2.1 3" />
            <path d="M12 18.2h.01" />
          </>
        ) : null}
        {state === "active" ? (
          <>
            <path
              className="opryn-mark-path"
              d="M5 15.5c2.4-6 5.2-8.4 8.6-7.3 2.5.8 3.4 3.6 5.4 2.8"
            />
            <path d="m16.9 8.7 2.2 2.3-2.2 2.2" />
          </>
        ) : null}
      </svg>
    </span>
  );
}
