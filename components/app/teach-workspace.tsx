"use client";
import "./knowledge-library.css";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import Link from "next/link";
import { CaptureProcess } from "./capture-process";
import { TeachGoogle } from "./teach-google";
import {
  TeachPipeline,
  TeachSources,
  type TeachSourceSummary,
  type RecentTeachSource,
  type UseElsewhereSummary,
} from "./teach-sources";
import { TeachProvider } from "./teach-provider";

export function TeachWorkspace({
  organizationId,
  organizationName,
  initialSource,
  sourceSummaries = [
    {
      id: "google_drive",
      connected: false,
      connectionId: null,
      selectedCount: 0,
      status: "healthy",
      lastLearned: null,
    },
    {
      id: "notion",
      connected: false,
      connectionId: null,
      selectedCount: 0,
      status: "healthy",
      lastLearned: null,
    },
    {
      id: "confluence",
      connected: false,
      connectionId: null,
      selectedCount: 0,
      status: "healthy",
      lastLearned: null,
    },
  ],
  recentSources = [],
  useElsewhere = [],
  ...capture
}: Omit<ComponentProps<typeof CaptureProcess>, "initialMode"> & {
  organizationId: string;
  organizationName: string;
  initialSource?: string;
  sourceSummaries?: TeachSourceSummary[];
  recentSources?: RecentTeachSource[];
  useElsewhere?: UseElsewhereSummary[];
}) {
  const initialMode =
    initialSource === "documents"
      ? "documents"
      : capture.initial
        ? "text"
        : null;
  const [mode, setMode] = useState<"text" | "documents" | null>(initialMode);
  const input = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (mode)
      input.current?.scrollIntoView({ behavior: "instant", block: "start" });
  }, [mode]);
  const [opened, setOpened] = useState({
    text: initialMode === "text",
    documents: initialMode === "documents",
  });
  function choose(next: "text" | "documents") {
    setOpened((current) => ({ ...current, [next]: true }));
    setMode(next);
  }
  return (
    <div className="teach-workspace">
      <TeachPipeline />
      <div hidden={Boolean(capture.onPrepared && mode)}>
        <TeachSources
          summaries={sourceSummaries}
          recent={recentSources}
          useElsewhere={useElsewhere}
          onExplain={() => choose("text")}
          onUpload={() => choose("documents")}
          google={
            <TeachGoogle
              organizationId={organizationId}
              organizationName={organizationName}
              onPrepared={capture.onPrepared}
            />
          }
          notion={
            <TeachProvider
              provider="notion"
              organizationId={organizationId}
              organizationName={organizationName}
              onPrepared={capture.onPrepared}
            />
          }
          confluence={
            <TeachProvider
              provider="confluence"
              organizationId={organizationId}
              organizationName={organizationName}
              onPrepared={capture.onPrepared}
            />
          }
          calls={
            !capture.onPrepared && (
              <Link className="teach-source-action" href="/app/calls">
                Add a recording <span aria-hidden>→</span>
              </Link>
            )
          }
        />
      </div>
      {mode && (
        <div ref={input} className="library-section-heading">
          <h2>
            {mode === "text" ? "Explain what Opryn should know" : "Your files"}
          </h2>
          <button onClick={() => setMode(null)}>Close input</button>
        </div>
      )}
      {opened.text && (
        <div hidden={mode !== "text"}>
          <CaptureProcess {...capture} initialMode="text" />
        </div>
      )}
      {opened.documents && (
        <div hidden={mode !== "documents"}>
          <CaptureProcess {...capture} initialMode="documents" />
        </div>
      )}
    </div>
  );
}
