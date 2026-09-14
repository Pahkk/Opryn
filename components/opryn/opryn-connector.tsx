type ConnectorDirection = "forward" | "down";

export function OprynConnector({
  direction = "forward",
  className = "",
  label,
}: {
  direction?: ConnectorDirection;
  className?: string;
  label?: string;
}) {
  const vertical = direction === "down";

  return (
    <span
      className={`opryn-connector opryn-connector--${direction} ${className}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg
        viewBox={vertical ? "0 0 34 118" : "0 0 138 34"}
        preserveAspectRatio="none"
      >
        <path
          className="opryn-connector__track"
          pathLength="1"
          d={
            vertical
              ? "M9 2 C9 35 25 42 25 72 C25 92 19 103 17 112"
              : "M2 25 C34 25 45 8 78 8 C103 8 117 15 132 17"
          }
        />
        <path
          className="opryn-connector__signal"
          pathLength="1"
          d={
            vertical
              ? "M9 2 C9 35 25 42 25 72 C25 92 19 103 17 112"
              : "M2 25 C34 25 45 8 78 8 C103 8 117 15 132 17"
          }
        />
        <path
          className="opryn-connector__arrow"
          d={vertical ? "M12 107 L17 114 L22 107" : "M126 12 L134 17 L126 22"}
        />
      </svg>
    </span>
  );
}
