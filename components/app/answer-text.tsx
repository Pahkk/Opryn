"use client";

import { useEffect, useRef, useState } from "react";

/** Reveal new answers once, keeping the full answer available to assistive tech. */
export function AnswerText({ text }: { text: string }) {
  const [length, setLength] = useState(0);
  const skip = useRef(false);
  const characters = Array.from(text);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const count = Array.from(text).length;
    let frame = 0;
    let started = 0;
    skip.current = false;
    const duration = Math.min(4200, Math.max(650, count * 13));
    function finish() {
      cancelAnimationFrame(frame);
      setLength(count);
    }
    function tick(now: number) {
      if (skip.current) {
        finish();
        return;
      }
      if (!started) started = now;
      const next = Math.min(
        count,
        Math.floor(((now - started) / duration) * count),
      );
      setLength(next);
      if (next < count) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(preference.matches ? finish : tick);
    preference.addEventListener("change", finish);
    return () => {
      cancelAnimationFrame(frame);
      preference.removeEventListener("change", finish);
    };
  }, [text]);
  const complete = length >= characters.length;
  return (
    <div className="mt-3">
      <p className="sr-only">{text}</p>
      <div
        aria-hidden="true"
        className="grid text-[15px] leading-7 text-[#52627a]"
      >
        <p className="invisible col-start-1 row-start-1 whitespace-pre-wrap break-words">
          {text}
        </p>
        <p className="col-start-1 row-start-1 whitespace-pre-wrap break-words">
          {characters.slice(0, length).join("")}
          {!complete ? (
            <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 rounded-full bg-[#245fc9]" />
          ) : null}
        </p>
      </div>
      <div className="h-11">
        {!complete ? (
          <button
            type="button"
            onClick={() => {
              skip.current = true;
              setLength(characters.length);
            }}
            className="min-h-11 text-xs font-semibold text-[#245fc9]"
          >
            Show full answer
          </button>
        ) : null}
      </div>
    </div>
  );
}
