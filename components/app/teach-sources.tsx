"use client";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { SiGoogledocs, SiGooglesheets, SiGoogleslides } from "react-icons/si";
import {
  CallsIcon,
  DocumentIcon,
  AskIcon,
} from "@/components/opryn-icons/opryn-icons";
import { ProviderLogo } from "@/components/connections/provider-logo";
import { gsap, motionScope } from "@/lib/motion/gsap";
import "./teach-sources.css";

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
      ref={ref}
      aria-label="Source to Opryn to review to approved knowledge"
    >
      <span className="teach-fragments" aria-hidden="true">
        <DocumentIcon data-source-fragment />
        <AskIcon data-source-fragment />
        <CallsIcon data-source-fragment />
      </span>
      {["Source", "Opryn", "Review", "Approved knowledge"].map((label, i) => (
        <span className="teach-pipeline-stage" key={label}>
          {i > 0 && (
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
      ))}
    </div>
  );
}
export function TeachSources({
  google,
  onExplain,
  onUpload,
  calls,
}: {
  google: ReactNode;
  onExplain: () => void;
  onUpload: () => void;
  calls?: ReactNode;
}) {
  return (
    <div className="teach-source-grid">
      <section
        className="teach-source-panel google-source"
        data-guide="teach.google"
      >
        <div className="teach-source-brand">
          <ProviderLogo id="google_drive" name="Google Workspace" />
          <span
            className="teach-google-formats"
            aria-label="Docs, Sheets and Slides"
          >
            <SiGoogledocs color="#4285f4" />
            <SiGooglesheets color="#188038" />
            <SiGoogleslides color="#fbbc04" />
          </span>
        </div>
        <h2>Google Workspace</h2>
        <p>Choose company files Opryn should learn from.</p>
        {google}
      </section>
      <button
        type="button"
        className="teach-source-panel"
        data-guide="teach.explain"
        onClick={onExplain}
      >
        <AskIcon className="teach-source-art" size={48} />
        <h2>Explain it</h2>
        <p>A rule, process or answer. In your own words.</p>
        <span className="teach-source-action">
          Speak or type <span aria-hidden>→</span>
        </span>
      </button>
      <button
        type="button"
        className="teach-source-panel"
        data-guide="teach.upload"
        onClick={onUpload}
      >
        <DocumentIcon className="teach-source-art" size={48} />
        <h2>Upload something</h2>
        <p>Documents, PDFs, images and company files.</p>
        <span className="teach-source-action">
          Choose files <span aria-hidden>→</span>
        </span>
      </button>
      {calls && (
        <section className="teach-source-panel">
          <CallsIcon className="teach-source-art" size={48} />
          <h2>Calls</h2>
          <p>Review knowledge from business conversations.</p>
          {calls}
        </section>
      )}
    </div>
  );
}
