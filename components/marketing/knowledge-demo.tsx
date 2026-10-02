"use client";

import { useId, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useIsPresent,
} from "motion/react";
import { OprynAction } from "@/components/motion/opryn-action";
import { OprynTrace } from "@/components/motion/opryn-trace";
import { SuccessCheck } from "@/components/motion/success-check";
import { uiTransition } from "@/lib/motion/motion-tokens";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";
import "./knowledge-demo.css";

type Stage = "Teach" | "Review" | "Use";
type Audience = "Your team" | "Your AI" | "Missing answer";

function DemoScene({ children }: { children: ReactNode }) {
  const present = useIsPresent();
  const reduced = useProductReducedMotion();
  return (
    <motion.div
      className="demo-scene"
      inert={!present || undefined}
      aria-hidden={!present || undefined}
      initial={{ opacity: 0, y: reduced ? 0 : 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={uiTransition(reduced)}
    >
      {children}
    </motion.div>
  );
}

/** Local, user-driven illustration. Never submits real approvals/messages or uses AI loaders. */
export function KnowledgeDemo() {
  const [stage, setStage] = useState<Stage>("Teach");
  const [approved, setApproved] = useState(false);
  const [audience, setAudience] = useState<Audience>("Your team");
  const [gap, setGap] = useState<"unknown" | "answered" | "proposed">(
    "unknown",
  );
  const reduced = useProductReducedMotion();
  const id = useId();
  return (
    <LayoutGroup id={id}>
      <div
        className="clear-example knowledge-demo"
        aria-label="Example workspace: revision policy workflow"
        data-motion-owner="motion"
      >
        <OprynTrace />
        <div className="clear-example-top">
          <span>Example workspace</span>
          <button
            className="demo-reset"
            onClick={() => {
              setStage("Teach");
              setApproved(false);
              setGap("unknown");
              setAudience("Your team");
            }}
          >
            Replay
          </button>
        </div>
        <div
          className="demo-stages"
          role="group"
          aria-label="Example workflow stages"
        >
          {(["Teach", "Review", "Use"] as const).map((value, index) => (
            <button
              key={value}
              aria-pressed={stage === value}
              disabled={value === "Use" && !approved}
              onClick={() => setStage(value)}
            >
              {stage === value ? (
                <motion.span
                  className="demo-selection"
                  layoutId={reduced ? undefined : "stage"}
                  transition={uiTransition(reduced)}
                  aria-hidden="true"
                />
              ) : null}
              <small>0{index + 1}</small> {value}
            </button>
          ))}
        </div>
        <div className="demo-source">
          <p className="clear-label">You add · Source stays attached</p>
          <p>
            “Standard projects include two revision rounds. Additional revisions
            require project-lead approval.”
          </p>
        </div>
        <div className="clear-example-policy">
          <p className="clear-label">
            {stage === "Teach"
              ? "Opryn organizes what you provide"
              : "Website Revision Policy"}
          </p>
          <h2>Revision policy</h2>
          <p>
            Two revision rounds included.
            <br />
            Extra rounds require project-lead approval.
          </p>
          <span className={approved ? "clear-approved" : "demo-review-status"}>
            {approved ? <SuccessCheck /> : null}
            {approved ? "Approved · Example" : "Needs review · Example"}
          </span>
        </div>
        <div className="demo-canvas">
          <AnimatePresence initial={false}>
            <DemoScene key={stage}>
              {stage === "Teach" ? (
                <div className="demo-local-action">
                  <p>
                    Information becomes a proposal—not official guidance yet.
                  </p>
                  <OprynAction
                    label="Review example"
                    rolling
                    arrow
                    onClick={() => setStage("Review")}
                  />
                </div>
              ) : stage === "Review" ? (
                <div className="demo-local-action">
                  <p>Your business decides what becomes official.</p>
                  <OprynAction
                    label="Approve example"
                    pendingLabel="Approving…"
                    successLabel="Approved"
                    state={approved ? "success" : "idle"}
                    onClick={() => setApproved(true)}
                  />
                  {approved ? (
                    <button
                      className="demo-text-action"
                      onClick={() => setStage("Use")}
                    >
                      See how it’s used →
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="demo-use">
                  <div
                    className="demo-audiences"
                    role="group"
                    aria-label="Example answer audience"
                  >
                    {(["Your team", "Your AI", "Missing answer"] as const).map(
                      (value) => (
                        <button
                          key={value}
                          aria-pressed={audience === value}
                          onClick={() => setAudience(value)}
                        >
                          {audience === value ? (
                            <motion.span
                              className="demo-selection"
                              layoutId={reduced ? undefined : "audience"}
                              transition={uiTransition(reduced)}
                              aria-hidden="true"
                            />
                          ) : null}
                          {value}
                        </button>
                      ),
                    )}
                  </div>
                  <div
                    className="demo-response"
                    role="status"
                    aria-live="polite"
                  >
                    <AnimatePresence initial={false}>
                      <DemoScene key={`${audience}-${gap}`}>
                        {audience === "Missing answer" ? (
                          <>
                            <p>
                              “What if the customer already paid for the extra
                              revision?”
                            </p>
                            <strong>No approved answer yet.</strong>
                            {gap === "unknown" ? (
                              <OprynAction
                                variant="secondary"
                                label="Ask the right person"
                                onClick={() => setGap("answered")}
                              />
                            ) : (
                              <>
                                <p className="demo-expert">
                                  Example human answer: “Ask the project lead to
                                  confirm the extra revision’s scope.”
                                </p>
                                <OprynAction
                                  variant="secondary"
                                  label="Create proposal"
                                  successLabel="Proposed · Needs review"
                                  state={
                                    gap === "proposed" ? "success" : "idle"
                                  }
                                  onClick={() => setGap("proposed")}
                                />
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            <p>
                              {audience === "Your team"
                                ? "“Can I include a third revision?”"
                                : "“A customer is requesting an additional revision.”"}
                            </p>
                            <strong>
                              Additional revisions require project-lead
                              approval.
                            </strong>
                            <small>
                              Source: Website Revision Policy · Approved
                              {audience === "Your AI"
                                ? " · Authorized connection"
                                : ""}
                            </small>
                          </>
                        )}
                      </DemoScene>
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </DemoScene>
          </AnimatePresence>
        </div>
        <p className="demo-disclosure">
          Interactive example only. No changes to your workspace.
        </p>
        <noscript>
          <div className="clear-example-answer">
            <p>
              After a person approves, your team can ask: “Can I include a third
              revision?”
            </p>
            <strong>Additional revisions require project-lead approval.</strong>
            <small>Source: Website Revision Policy · Example</small>
          </div>
        </noscript>
      </div>
    </LayoutGroup>
  );
}
