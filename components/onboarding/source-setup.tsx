"use client";

import { useEffect, useRef, useState } from "react";
import { ProviderLogo } from "@/components/connections/provider-logo";
import {
  DocumentIcon,
  AskIcon,
  CallsIcon,
} from "@/components/opryn-icons/opryn-icons";
import { MotionRegion } from "@/components/motion/motion-region";
import { TeachGoogle } from "@/components/app/teach-google";
import { TeachProvider } from "@/components/app/teach-provider";
import { CaptureProcess } from "@/components/app/capture-process";
import { ConversationLearning } from "./conversation-learning";
import { conversationIntentSchema } from "@/lib/onboarding/conversation-learning";
import { SourcePreview } from "./source-preview";
import "./source-setup.css";

const sources = [
  {
    id: "google_drive",
    name: "Google Workspace",
    description: "Teach Opryn from Docs, Sheets and Slides.",
    hint: "Docs, Sheets & Slides",
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    description: "Start with a conversation about your business.",
    hint: "Your chosen conversation only",
  },
  {
    id: "claude",
    name: "Claude",
    description: "Bring in useful context you’ve already shared.",
    hint: "Your chosen conversation only",
  },
  {
    id: "documents",
    name: "Upload something",
    description: "Use an existing company file.",
    hint: "Choose files from your device",
  },
  {
    id: "text",
    name: "Explain it",
    description: "Tell us one rule or process in your own words.",
    hint: "No connection needed",
  },
  {
    id: "notion",
    name: "Notion",
    description: "Choose pages or databases to learn from.",
    hint: "Selected content only",
  },
  {
    id: "confluence",
    name: "Confluence",
    description: "Choose pages or spaces to learn from.",
    hint: "Selected content only",
  },
  {
    id: "calls",
    name: "Calls",
    description: "Explain a process by recording your voice.",
    hint: "Record only with permission",
  },
] as const;
type Source = (typeof sources)[number]["id"];

export function SourceSetup({
  organizationId,
  companyName,
  plan,
  onPrepared,
  recommendedSource,
}: {
  organizationId: string;
  companyName: string;
  plan: "core" | "premium";
  onPrepared: (id: string) => void;
  recommendedSource?: string | null;
}) {
  const [selected, setSelected] = useState<Source | null>(null);
  const [more, setMore] = useState(false);
  const [connections, setConnections] = useState<Record<string, string>>({});
  const heading = useRef<HTMLHeadingElement>(null);
  const interacted = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    for (const provider of [
      "google_drive",
      "notion",
      "confluence",
      "chatgpt",
      "claude",
    ]) {
      const conversational = provider === "chatgpt" || provider === "claude";
      const url = conversational
        ? `/api/onboarding/ai-connections/status?provider=${provider}`
        : `/api/integrations/capability?provider=${provider}&capability=knowledge_import`;
      void fetch(url, {
        headers: { "x-opryn-organization": organizationId },
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) return;
          const data = await response.json();
          if (!controller.signal.aborted)
            setConnections((current) => ({
              ...current,
              [provider]: conversational
                ? data.connected
                  ? data.learningEnabled
                    ? "Connected"
                    : "Finish setup"
                  : "Needs setup"
                : data.connectionId
                  ? "Connected"
                  : "Needs setup",
            }));
        })
        .catch(() => {
          /* Never imply a connection when status is unavailable. */
        });
    }
    return () => controller.abort();
  }, [organizationId]);
  useEffect(() => {
    if (interacted.current) heading.current?.focus({ preventScroll: true });
  }, [selected]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/onboarding/learning-session", {
      headers: { "x-opryn-organization": organizationId },
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        const intent = conversationIntentSchema.safeParse(data.intent);
        if (
          !controller.signal.aborted &&
          intent.success &&
          !interacted.current
        ) {
          setSelected((current) => current ?? intent.data.provider);
        }
      })
      .catch(() => {
        /* Selection remains available if resume lookup fails. */
      });
    return () => controller.abort();
  }, [organizationId]);
  const source = sources.find((item) => item.id === selected);
  const recommendedId =
    (
      {
        google_workspace: "google_drive",
        upload: "documents",
        explain: "text",
      } as Record<string, string>
    )[recommendedSource || ""] || recommendedSource;
  return (
    <section className="source-setup" aria-labelledby="source-setup-title">
      <header className="source-setup-header">
        <span className="source-setup-kicker">A simple start</span>
        <h2 id="source-setup-title" ref={heading} tabIndex={-1}>
          Choose one place to begin.
        </h2>
        <p>
          You can add more anytime. We’ll help you bring in just what you
          choose.
        </p>
      </header>
      <ol className="source-setup-path" aria-label="Learning setup steps">
        <li aria-current={selected ? undefined : "step"}>
          <b>1</b> Choose a source
        </li>
        <li aria-current={selected ? "step" : undefined}>
          <b>2</b> Connect & send
        </li>
        <li>
          <b>3</b> Review together
        </li>
      </ol>
      {source ? (
        <>
          <button
            className="source-setup-back"
            onClick={() => {
              interacted.current = true;
              setSelected(null);
            }}
          >
            ← Choose a different source
          </button>
          <MotionRegion
            changeKey={selected ?? "choose"}
            variant="step"
            className="source-setup-workflow"
          >
            <div className="source-setup-selected">
              <span>YOUR FIRST SOURCE</span>
              <h3>{source.name}</h3>
              <p>{source.description}</p>
            </div>
            {selected === "chatgpt" || selected === "claude" ? (
              <ConversationLearning
                key={selected}
                organizationId={organizationId}
                companyName={companyName}
                providerFilter={selected}
                onPrepared={onPrepared}
              />
            ) : selected === "google_drive" ? (
              <TeachGoogle
                organizationId={organizationId}
                organizationName={companyName}
                onPrepared={onPrepared}
              />
            ) : selected === "notion" || selected === "confluence" ? (
              <TeachProvider
                key={selected}
                provider={selected}
                organizationId={organizationId}
                organizationName={companyName}
                onPrepared={onPrepared}
              />
            ) : (
              <CaptureProcess
                key={selected}
                roles={[]}
                plan={plan}
                returnTo="/onboarding"
                initialMode={
                  selected === "documents"
                    ? "documents"
                    : selected === "calls"
                      ? "voice"
                      : "text"
                }
                onPrepared={onPrepared}
              />
            )}
          </MotionRegion>
        </>
      ) : (
        <div className="source-setup-options">
          {sources
            .filter(
              (item) =>
                more ||
                !recommendedId ||
                item.id === recommendedId ||
                item.id === "text",
            )
            .map((item) => (
              <article
                key={item.id}
                className="source-choice"
                data-recommended={item.id === recommendedId}
              >
                {item.id === recommendedId && (
                  <small className="source-choice-recommended">
                    Recommended starting point
                  </small>
                )}
                <button
                  type="button"
                  key={item.id}
                  className="source-setup-option"
                  onClick={() => {
                    interacted.current = true;
                    setSelected(item.id);
                  }}
                >
                  <span className="source-setup-logo">
                    {item.id === "documents" ? (
                      <DocumentIcon />
                    ) : item.id === "calls" ? (
                      <CallsIcon />
                    ) : item.id === "text" ? (
                      <AskIcon />
                    ) : (
                      <ProviderLogo id={item.id} name={item.name} />
                    )}
                  </span>
                  <span className="source-setup-copy">
                    <strong>
                      {item.name}
                      {(item.id === "chatgpt" || item.id === "claude") && (
                        <span className="conversation-premium-badge">
                          Pro
                        </span>
                      )}
                    </strong>
                    <span>{item.description}</span>
                    <small>{item.hint}</small>
                    <small className="source-connection-state">
                      {item.id === "text" ||
                      item.id === "documents" ||
                      item.id === "calls"
                        ? "No connection needed"
                        : connections[item.id] ||
                          "Connection status unavailable"}
                    </small>
                  </span>
                  <span className="source-setup-arrow" aria-hidden="true">
                    →
                  </span>
                </button>
                <SourcePreview
                  name={item.name}
                  conversation={item.id === "chatgpt" || item.id === "claude"}
                  manual={
                    item.id === "text" ||
                    item.id === "documents" ||
                    item.id === "calls"
                  }
                />
              </article>
            ))}
          <button
            className="source-setup-more"
            aria-expanded={more}
            onClick={() => setMore(!more)}
          >
            {more
              ? "Show fewer sources"
              : "Choose another source · View all options"}
          </button>
        </div>
      )}
      <footer className="source-setup-reassurance">
        You choose what comes in. Nothing becomes official until you approve it.
      </footer>
    </section>
  );
}
