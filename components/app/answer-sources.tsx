"use client";

import AISources, { type AISource } from "@/components/smoothui/ai-sources";
import { FaSlack } from "react-icons/fa6";
import { SiConfluence, SiGoogledocs, SiNotion } from "react-icons/si";

type Source = {
  id: string;
  label: string;
  href: string | null;
  content: string;
};

function safeSourceHref(href: string | null) {
  if (!href) return null;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "http:" ? href : null;
  } catch {
    return null;
  }
}

function sourceMark(href: string | null) {
  if (!href) return undefined;
  try {
    const host = new URL(href).hostname.toLowerCase();
    if (host === "docs.google.com") return <SiGoogledocs aria-hidden="true" />;
    if (host.endsWith("notion.so")) return <SiNotion aria-hidden="true" />;
    if (host.endsWith("atlassian.net"))
      return <SiConfluence aria-hidden="true" />;
    if (host.endsWith("slack.com")) return <FaSlack aria-hidden="true" />;
  } catch {
    // Internal relative paths and unrecognized providers use the neutral mark.
  }
  return undefined;
}

export function AnswerSources({ sources }: { sources: Source[] }) {
  const verified: AISource[] = sources.map((source) => {
    const [title, ...location] = source.label.split(/\s*→\s*/);
    const href = safeSourceHref(source.href);
    return {
      id: source.id,
      title,
      snippet: location.join(" · ") || undefined,
      content: source.content || undefined,
      url: href,
      favicon: sourceMark(href),
    };
  });

  return (
    <section className="answer-sources px-5 py-5 sm:px-6" aria-label="Answer sources">
      <AISources
        className="opryn-ai-sources"
        label={`${sources.length} supporting ${sources.length === 1 ? "source" : "sources"}`}
        sources={verified}
      />
    </section>
  );
}
