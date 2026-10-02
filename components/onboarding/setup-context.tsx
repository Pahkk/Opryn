"use client";
import { motion, AnimatePresence } from "motion/react";
import { useId, useState, type ReactNode } from "react";
import { motionTokens } from "@/lib/motion/motion-tokens";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";
import { OprynThinkingOrb } from "@/components/motion/opryn-thinking-orb";
import "./setup-context.css";
export function SetupContext({
  company,
  title,
  approved,
  goal,
  areas = [],
  source,
  industry,
  employeeCount,
  recommendedSource,
  sourceReason,
  suggestedAreas = [],
  suggestedSource,
  busy = false,
  next = "Choose a knowledge source",
  children,
}: {
  company: string;
  title?: string;
  approved: boolean;
  goal: string;
  areas?: string[];
  source?: string;
  industry?: string;
  employeeCount?: number;
  recommendedSource?: string | null;
  sourceReason?: string;
  suggestedAreas?: string[];
  suggestedSource?: string;
  busy?: boolean;
  next?: string;
  children?: ReactNode;
}) {
  const reduced = useProductReducedMotion();
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const names: Record<string, string> = {
    google_workspace: "Google Workspace",
    upload: "Upload",
    explain: "Explain it",
  };
  const recommendation = recommendedSource || suggestedSource;
  const allAreas = [
    ...areas,
    ...suggestedAreas.filter((area) => !areas.includes(area)),
  ];
  const populated = !!(
    company.trim() ||
    industry ||
    allAreas.length ||
    recommendation ||
    title
  );
  const entry = { opacity: 0, y: reduced ? 0 : 6 };
  const transition = reduced ? { duration: 0 } : { duration: 0.2 };
  return (
    <aside
      className="opryn-setup-preview"
      data-motion-owner="motion"
      aria-label="Your Opryn setup"
    >
      <header>
        <h2>Your Opryn Setup</h2>
        <button
          type="button"
          className="setup-preview-toggle"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Hide" : "View"}
        </button>
      </header>
      <div id={id} className="setup-preview-body" data-expanded={expanded}>
        {!populated && !busy && (
          <div className="setup-preview-empty">
            <p>
              Your workspace will take shape here as you answer a few questions.
            </p>
            <div aria-hidden="true" className="setup-preview-outline">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
        <AnimatePresence initial={false}>
          {company.trim() && (
            <motion.div
              key="company"
              initial={entry}
              animate={{ opacity: 1, y: 0 }}
              transition={transition}
              className="setup-preview-company"
            >
              <span className="setup-company-initial" aria-hidden="true">
                {company.trim().slice(0, 1).toUpperCase()}
              </span>
              <div>
                <h3>{company}</h3>
                {industry && (
                  <motion.p
                    key={industry}
                    initial={entry}
                    animate={{ opacity: 1, y: 0 }}
                    transition={transition}
                  >
                    {industry}
                  </motion.p>
                )}
                {!!employeeCount && (
                  <p>
                    {employeeCount} {employeeCount === 1 ? "person" : "people"}
                  </p>
                )}
              </div>
            </motion.div>
          )}
          {populated && goal && (
            <motion.section
              key={goal}
              initial={entry}
              animate={{ opacity: 1, y: 0 }}
              transition={transition}
            >
              <h3>Goal</h3>
              <p>{goal}</p>
            </motion.section>
          )}
          {busy && (
            <motion.div
              key="working"
              initial={entry}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={transition}
              className="setup-preview-working"
              role="status"
              aria-live="polite"
            >
              <OprynThinkingOrb
                state="solving"
                size={64}
                decorative
                label="Preparing setup suggestions"
              />
              <div>
                <strong>Understanding your business…</strong>
                <p>Preparing suggestions for you to review.</p>
              </div>
            </motion.div>
          )}
          {!!allAreas.length && (
            <motion.section
              key="areas"
              layout={!reduced}
              initial={entry}
              animate={{ opacity: 1, y: 0 }}
              transition={transition}
            >
              <h3>Starting knowledge</h3>
              <ul className="setup-preview-tags">
                <AnimatePresence initial={false}>
                  {allAreas.map((area) => (
                    <motion.li
                      key={area}
                      layout={!reduced}
                      initial={entry}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={
                        reduced ? { duration: 0 } : motionTokens.layout
                      }
                    >
                      <span>{area}</span>
                      <small>
                        {areas.includes(area) ? "Confirmed" : "Suggested"}
                      </small>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </motion.section>
          )}
          {recommendation && (
            <motion.section
              key={`recommendation-${recommendation}`}
              layout={!reduced}
              initial={entry}
              animate={{ opacity: 1, y: 0 }}
              transition={transition}
            >
              <h3>Recommended first source</h3>
              <p>{names[recommendation] || recommendation}</p>
              <small>
                {recommendedSource ? "Confirmed choice" : "Suggested by Opryn"}
              </small>
              {sourceReason && (
                <p className="setup-preview-secondary">{sourceReason}</p>
              )}
            </motion.section>
          )}
          {source && (
            <motion.section
              key={`source-${source}`}
              initial={entry}
              animate={{ opacity: 1, y: 0 }}
              transition={transition}
            >
              <h3>Selected source</h3>
              <p>{source}</p>
            </motion.section>
          )}
          {title && (
            <motion.section
              key={`knowledge-${title}`}
              initial={entry}
              animate={{ opacity: 1, y: 0 }}
              transition={transition}
            >
              <h3>{approved ? "First approved knowledge" : "First finding"}</h3>
              <p>{title}</p>
              <span
                data-authority-status
                className="setup-preview-status"
                data-approved={approved}
              >
                {approved ? "✓ Approved · ready to use" : "Needs Review"}
              </span>
            </motion.section>
          )}
        </AnimatePresence>
        {children}
        <footer>
          <h3>Next</h3>
          <motion.p
            key={next}
            initial={entry}
            animate={{ opacity: 1, y: 0 }}
            transition={transition}
          >
            {next} <span aria-hidden="true">→</span>
          </motion.p>
        </footer>
      </div>
    </aside>
  );
}
