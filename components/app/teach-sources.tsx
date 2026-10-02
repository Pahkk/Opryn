"use client";

import Link from "next/link";
import { OprynTrace } from "@/components/motion/opryn-trace";
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Search } from "lucide-react";
import { SiGoogledocs, SiGooglesheets, SiGoogleslides } from "react-icons/si";
import {
  CallsIcon,
  DocumentIcon,
  AskIcon,
} from "@/components/opryn-icons/opryn-icons";
import { ProviderLogo } from "@/components/connections/provider-logo";
import { gsap, motionScope } from "@/lib/motion/gsap";
import { StaggerList } from "@/components/motion/motion-region";
import { PresenceSwap } from "@/components/motion/presence-swap";
import { TeachWorkflowScope } from "@/components/motion/teach-workflow";
import "./teach-sources.css";

export type TeachSourceSummary = {
  id: "google_drive" | "notion" | "confluence";
  connected: boolean;
  connectionId: string | null;
  selectedCount: number;
  status: "healthy" | "attention" | "changed";
  lastLearned: string | null;
};
export type RecentTeachSource = {
  id: string;
  title: string;
  provider: string;
  updatedAt: string;
  processId: string;
};
export type UseElsewhereSummary = {
  id: "slack" | "teams" | "chatgpt" | "claude";
  name: string;
  connected: boolean;
};

export function TeachPipeline() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const scope = motionScope(ref.current);
    scope.run(() => {
      const tl = gsap.timeline();
      tl.fromTo(
        ref.current!.querySelectorAll("[data-source-fragment]"),
        { x: -12, y: 6 },
        {
          x: 0,
          y: 0,
          duration: 0.35,
          stagger: 0.06,
          ease: "power2.out",
          clearProps: "transform",
        },
      ).fromTo(
        ref.current!.querySelectorAll("[data-route-line]"),
        { strokeDasharray: 100, strokeDashoffset: 100 },
        {
          strokeDashoffset: 0,
          duration: 0.35,
          stagger: 0.12,
          ease: "power2.out",
          clearProps: "strokeDasharray,strokeDashoffset",
        },
        0.2,
      );
    });
    return () => scope.dispose();
  }, []);
  return (
    <div
      className="teach-pipeline"
      data-motion-owner="gsap"
      ref={ref}
      aria-label="Source to Opryn to review to approved knowledge"
    >
      <span className="teach-fragments" aria-hidden="true">
        <DocumentIcon data-source-fragment />
        <AskIcon data-source-fragment />
        <CallsIcon data-source-fragment />
      </span>
      {["Source", "Opryn", "Review", "Approved knowledge"].map(
        (label, index) => (
          <span className="teach-pipeline-stage" key={label}>
            {index > 0 && (
              <svg viewBox="0 0 48 12" aria-hidden="true">
                <path
                  data-route-line
                  pathLength="100"
                  d="M1 6H44M39 2L44 6 39 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            )}
            <span>{label}</span>
          </span>
        ),
      )}
    </div>
  );
}

const providerCopy = {
  google_drive: {
    name: "Google Workspace",
    description: "Choose company Docs, Sheets, and Slides.",
    guide: "teach.google",
  },
  notion: {
    name: "Notion",
    description: "Choose pages or databases Opryn should learn from.",
    guide: "teach.notion",
  },
  confluence: {
    name: "Confluence",
    description: "Choose pages or spaces Opryn should learn from.",
    guide: "teach.confluence",
  },
} as const;

export function TeachSources({
  google,
  notion,
  confluence,
  summaries,
  recent,
  useElsewhere,
  onExplain,
  onUpload,
  calls,
}: {
  google: ReactNode;
  notion: ReactNode;
  confluence: ReactNode;
  summaries: TeachSourceSummary[];
  recent: RecentTeachSource[];
  useElsewhere: UseElsewhereSummary[];
  onExplain: () => void;
  onUpload: () => void;
  calls?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const actions: Record<TeachSourceSummary["id"], ReactNode> = {
    google_drive: google,
    notion,
    confluence,
  };
  const visible = useMemo(
    () =>
      summaries.filter((source) => {
        const copy = providerCopy[source.id];
        return (
          !normalized ||
          `${copy.name} ${copy.description}`.toLowerCase().includes(normalized)
        );
      }),
    [summaries, normalized],
  );
  const connected = visible.filter((item) => item.connected);
  const available = visible.filter((item) => !item.connected);
  const nativeVisible =
    !normalized ||
    "explain upload calls recording document speak type".includes(normalized);
  const row = (source: TeachSourceSummary) => {
    const copy = providerCopy[source.id];
    return (
      <article
        className="teach-source-row"
        key={source.id}
        data-guide={copy.guide}
      >
        <OprynTrace />
        <TeachWorkflowScope>
          <ProviderLogo id={source.id} name={copy.name} />
          <div className="teach-source-copy">
            <div className="teach-source-title">
              <h3>{copy.name}</h3>
              <span
                className={`teach-health teach-health-${source.connected ? source.status : "disconnected"}`}
              >
                <PresenceSwap value={`${source.connected}:${source.status}`}>
                  {source.connected
                    ? healthLabel(source.status)
                    : "Not connected"}
                </PresenceSwap>
              </span>
            </div>
            <p>{copy.description}</p>
            {source.id === "google_drive" && <span className="teach-google-marks" aria-label="Google Docs, Sheets and Slides"><span style={{ color: "#4285f4" }}><SiGoogledocs aria-hidden="true" /></span><span style={{ color: "#0f9d58" }}><SiGooglesheets aria-hidden="true" /></span><span style={{ color: "#f4b400" }}><SiGoogleslides aria-hidden="true" /></span></span>}
            {source.connected ? (
              <small>
                {source.selectedCount
                  ? `${source.selectedCount} selected ${source.selectedCount === 1 ? "source" : "sources"}`
                  : "No sources selected yet"}
                {source.lastLearned
                  ? ` · Last learned ${relative(source.lastLearned)}`
                  : ""}
              </small>
            ) : (
              <small>
                Connect here, then continue choosing content without leaving
                Teach.
              </small>
            )}
          </div>
          <div className="teach-source-controls">
            {actions[source.id]}
            {source.connected ? (
              <Link href={`/app/integrations?provider=${source.id}`}>
                Manage
              </Link>
            ) : null}
          </div>
        </TeachWorkflowScope>
      </article>
    );
  };
  return (
    <div className="teach-control-surface">
      <label className="teach-source-search" data-guide="teach.search">
        <Search size={17} aria-hidden="true" />
        <span className="sr-only">Search teaching sources</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search sources…"
        />
      </label>
      {connected.length ? (
        <section className="teach-source-section">
          <header>
            <p>CONNECTED SOURCES</p>
            <span>Choose what Opryn should learn from.</span>
          </header>
          <StaggerList
            className="teach-source-list"
            changeKey={connected.map((s) => s.id).join(",")}
          >
            {connected.map(row)}
          </StaggerList>
        </section>
      ) : null}
      {available.length ? (
        <section className="teach-source-section">
          <header>
            <p>AVAILABLE SOURCES</p>
            <span>Connect inline, then choose content here.</span>
          </header>
          <StaggerList
            className="teach-source-list"
            changeKey={available.map((s) => s.id).join(",")}
          >
            {available.map(row)}
          </StaggerList>
        </section>
      ) : null}
      {nativeVisible ? (
        <section className="teach-source-section">
          <header>
            <p>OTHER WAYS TO TEACH</p>
            <span>Start with one real rule, file, or conversation.</span>
          </header>
          <div className="teach-native-list">
            <button
              type="button"
              data-guide="teach.explain"
              onClick={onExplain}
            >
              <AskIcon size={38} />
              <span>
                <strong>Explain it</strong>
                <small>Tell Opryn a process, rule, answer, or decision.</small>
              </span>
              <b>Speak or type →</b>
            </button>
            <button type="button" data-guide="teach.upload" onClick={onUpload}>
              <DocumentIcon size={38} />
              <span>
                <strong>Upload something</strong>
                <small>
                  Add existing documents, PDFs, images, and company files.
                </small>
              </span>
              <b>Choose files →</b>
            </button>
            {calls ? (
              <div className="teach-native-row" data-guide="teach.calls">
                <CallsIcon size={38} />
                <span>
                  <strong>Calls</strong>
                  <small>
                    Turn authorized business conversations into reviewable
                    knowledge.
                  </small>
                </span>
                {calls}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
      {recent.length ? (
        <section className="teach-source-section" data-guide="teach.recent">
          <header>
            <p>RECENTLY LEARNED</p>
            <span>Source activity prepared for review.</span>
          </header>
          <div className="teach-recent-list">
            {recent.map((item) => (
              <Link key={item.id} href={`/app/processes/${item.processId}`}>
                <span>
                  <strong>{item.title}</strong>
                  <small>{providerName(item.provider)}</small>
                </span>
                <time dateTime={item.updatedAt}>
                  {relative(item.updatedAt)}
                </time>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      <section
        className="teach-source-section teach-use-elsewhere"
        data-guide="teach.useElsewhere"
      >
        <header>
          <p>USE OPRYN ELSEWHERE</p>
          <span>
            Use approved knowledge where your team and AI already work.
          </span>
        </header>
        <div>
          {useElsewhere.map((provider) => (
            <Link
              key={provider.id}
              className="integration-provider-row"
              href={`/app/integrations?provider=${provider.id}`}
            >
              <ProviderLogo id={provider.id} name={provider.name} />
              <span className="teach-use-elsewhere-copy">
                <strong>{provider.name}</strong>
                <small>
                  {provider.connected ? "Connected" : "Not connected"}
                </small>
              </span>
              <b>{provider.connected ? "Manage" : "Connect"} <span className="interaction-arrow" aria-hidden="true">→</span></b>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function healthLabel(status: TeachSourceSummary["status"]) {
  return status === "healthy"
    ? "Healthy"
    : status === "changed"
      ? "Source changed"
      : "Needs attention";
}
function providerName(id: string) {
  return id === "google_drive"
    ? "Google Workspace"
    : id === "notion"
      ? "Notion"
      : id === "confluence"
        ? "Confluence"
        : "Opryn";
}
function relative(value: string) {
  const hours = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 3600000),
  );
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}
