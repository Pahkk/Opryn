import type { CSSProperties } from "react";

export function RevealText({ text }: { text: string }) {
  return (
    <span className="brand-reveal-text" data-story-reveal>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.split(" ").map((word, index) => (
          <span
            className="brand-word"
            key={`${word}-${index}`}
            style={{ "--word-delay": `${index * 55}ms` } as CSSProperties}
          >
            {word}
            {"\u00a0"}
          </span>
        ))}
      </span>
    </span>
  );
}
