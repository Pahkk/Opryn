"use client";

import { useEffect, useState } from "react";
import { useVisiblePlayback } from "./use-visible-playback";

/** A single timer; pauses for hidden tabs, user preference, and reduced motion. */
export function TypingHeadline({
  lines,
  paused,
}: {
  lines: readonly string[];
  paused: boolean;
}) {
  const { ref, playing } = useVisiblePlayback<HTMLSpanElement>(paused);
  const [frame, setFrame] = useState({
    index: 0,
    count: lines[0].length,
    phase: "hold",
  });
  useEffect(() => {
    if (!playing) return;
    const delay =
      frame.phase === "hold"
        ? 2200
        : frame.phase === "gap"
          ? 550
          : frame.phase === "delete"
            ? 40
            : 75;
    const timer = window.setTimeout(
      () =>
        setFrame((value) => {
          if (value.phase === "hold") return { ...value, phase: "delete" };
          if (value.phase === "delete")
            return value.count > 0
              ? { ...value, count: value.count - 1 }
              : {
                  index: (value.index + 1) % lines.length,
                  count: 0,
                  phase: "gap",
                };
          if (value.phase === "gap") return { ...value, phase: "type" };
          const count = value.count + 1;
          return {
            ...value,
            count,
            phase: count >= lines[value.index].length ? "hold" : "type",
          };
        }),
      delay,
    );
    return () => window.clearTimeout(timer);
  }, [frame, lines, playing]);
  return (
    <span className="knowledge-rotator" aria-hidden="true" ref={ref}>
      <span className="is-current">
        {lines[frame.index].slice(0, frame.count) || "\u00a0"}
      </span>
    </span>
  );
}
