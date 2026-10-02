"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useMotionTemplate,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import {
  OprynAction,
  type ActionState,
} from "@/components/motion/opryn-action";
import { OprynIcon } from "@/components/opryn-icons/opryn-icon";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";
import "./public-editorial.css";

const sceneEntrance = {
  settled: { opacity: [0, 1], y: [12, 0], scale: [0.97, 1] },
};
const sceneStatic = { settled: { opacity: 1, y: 0, scale: 1 } };

function subscribeCompact(listener: () => void) {
  const media = window.matchMedia("(max-width: 760px)");
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
const compactSnapshot = () => window.matchMedia("(max-width: 760px)").matches;
const serverCompactSnapshot = () => false;

/** A labeled marketing example, not a learning job or a backend approval.
 * Only discrete milestones render. Pointer/rail animation stays in Motion values.
 * Offscreen, hidden-tab, user-paused and reduced-motion states settle completely. */
function useExampleSequence() {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { amount: 0.2 });
  const prefersReduced = useProductReducedMotion();
  // A small screen is a readable, settled vertical flow—not a miniature loop.
  const compact = useSyncExternalStore(
    subscribeCompact,
    compactSnapshot,
    serverCompactSnapshot,
  );
  const reduced = prefersReduced || compact;
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  const [phase, setPhase] = useState(5);
  const [manualApproval, setManualApproval] = useState<ActionState | null>(
    null,
  );
  const manualTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (manualTimer.current) clearTimeout(manualTimer.current);
    },
    [],
  );
  const running = visible && !hidden && !reduced && !paused;
  useEffect(() => {
    if (!running) return;
    let timers: ReturnType<typeof setTimeout>[] = [];
    const cycle = () => {
      setPhase(0);
      timers = [
        setTimeout(() => setPhase(1), 2000),
        setTimeout(() => setPhase(2), 2850),
        setTimeout(() => setPhase(3), 3550),
        setTimeout(() => setPhase(4), 4500),
        setTimeout(() => setPhase(5), 6000),
        setTimeout(() => setPhase(6), 7650),
        setTimeout(cycle, 8000),
      ];
    };
    // Let the entrance finish before the first sequence.
    const intro = setTimeout(cycle, 650);
    return () => {
      clearTimeout(intro);
      timers.forEach(clearTimeout);
    };
  }, [running]);
  const settledPhase = manualApproval === "pending" ? 1 : running ? phase : 5;
  const approval: ActionState =
    manualApproval ??
    (settledPhase === 2
      ? "pending"
      : settledPhase >= 3 && settledPhase !== 6
        ? "success"
        : "idle");
  const approveExample = () => {
    if (manualTimer.current) return;
    setPaused(true);
    setManualApproval("pending");
    manualTimer.current = setTimeout(
      () => {
        setManualApproval("success");
        manualTimer.current = null;
      },
      reduced ? 0 : 700,
    );
  };
  const togglePaused = () => {
    if (manualTimer.current) clearTimeout(manualTimer.current);
    manualTimer.current = null;
    setManualApproval(null);
    setPaused((value) => !value);
  };
  return {
    ref,
    phase: settledPhase,
    approval,
    paused,
    togglePaused,
    approveExample,
    reduced,
    running,
  };
}

function DepthLayer({
  x,
  y,
  factor,
  reduced,
  className,
  children,
}: {
  x: MotionValue<number>;
  y: MotionValue<number>;
  factor: number;
  reduced: boolean;
  className: string;
  children: ReactNode;
}) {
  const dx = useTransform(x, (value) => value * factor);
  const dy = useTransform(y, (value) => value * factor);
  return (
    <motion.div
      className={className}
      style={reduced ? undefined : { x: dx, y: dy }}
    >
      {children}
    </motion.div>
  );
}

function ExampleApprovalCheck() {
  const reduced = useProductReducedMotion();
  return (
    <motion.svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      initial={false}
      animate={
        reduced
          ? undefined
          : { color: ["#2D9A67", "#14213D"], scale: [0.9, 1.06, 1] }
      }
      transition={{ duration: 0.6 }}
    >
      <motion.circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="1.5"
        initial={{ pathLength: reduced ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: reduced ? 0 : 0.2 }}
      />
      <motion.path
        d="m7 12 3 3 7-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: reduced ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: reduced ? 0 : 0.25, delay: reduced ? 0 : 0.15 }}
      />
    </motion.svg>
  );
}

export function KnowledgeFlowScene({ ai = false }: { ai?: boolean }) {
  const [editHelp, setEditHelp] = useState(false);
  const sequence = useExampleSequence();
  const {
    ref,
    phase,
    approval,
    paused,
    togglePaused,
    approveExample,
    reduced,
  } = sequence;
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 180, damping: 26 });
  const y = useSpring(rawY, { stiffness: 180, damping: 26 });
  const lightX = useMotionValue(50);
  const lightY = useMotionValue(50);
  const lightOpacity = useMotionValue(0);
  const light = useMotionTemplate`radial-gradient(circle at ${lightX}% ${lightY}%, rgba(40,85,249,.10), transparent 65%)`;
  const enter = (threshold: number) => ({
    opacity: phase >= threshold && phase !== 6 ? 1 : 0,
    y: reduced || phase >= threshold ? 0 : 12,
  });
  const rail = (threshold: number) =>
    phase >= threshold && phase !== 6 ? 1 : 0;
  return (
    <div
      className={`knowledge-flow ${ai ? "knowledge-flow-ai" : ""}`}
      ref={ref}
      data-example-phase={phase}
      data-flow-running={sequence.running}
    >
      <motion.div
        className="knowledge-flow-stage"
        role="group"
        aria-label={
          ai
            ? "Example knowledge flow: approved knowledge, Opryn, permissions, connected AI"
            : "Example knowledge flow: business knowledge, Opryn, human review, approved knowledge, team and connected AI use"
        }
        initial={false}
        animate="settled"
        variants={reduced ? sceneStatic : sceneEntrance}
        transition={{ duration: reduced ? 0 : 0.5 }}
        onPointerMove={(event) => {
          if (
            reduced ||
            event.pointerType !== "mouse" ||
            !window.matchMedia("(hover: hover) and (pointer: fine)").matches
          )
            return;
          const box = event.currentTarget.getBoundingClientRect();
          const px = (event.clientX - box.left) / box.width;
          const py = (event.clientY - box.top) / box.height;
          rawX.set((px - 0.5) * 16);
          rawY.set((py - 0.5) * 10);
          lightX.set(px * 100);
          lightY.set(py * 100);
          lightOpacity.set(1);
        }}
        onPointerLeave={() => {
          rawX.set(0);
          rawY.set(0);
          lightOpacity.set(0);
        }}
      >
        <h2 className="sr-only">
          {ai
            ? "Approved guidance for compatible connected AI"
            : "From a source to reviewed company guidance"}
        </h2>
        <div className="flow-ring-motif" aria-hidden="true" />
        <div className="flow-dot-texture" aria-hidden="true" />
        <motion.div
          className="flow-pointer-light"
          aria-hidden="true"
          style={
            reduced
              ? { opacity: 0 }
              : { background: light, opacity: lightOpacity }
          }
        />
        <svg
          className="flow-connectors"
          viewBox="0 0 600 500"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          {[
            "M225 135 H250 Q270 135 270 140 H290",
            "M330 192 V215 Q330 232 280 232 H190 V250",
            "M310 325 H368 Q398 325 398 280 H420",
            ai
              ? "M310 340 H345 Q365 340 365 380 H475 V395"
              : "M510 305 V363 Q510 382 475 382 V395",
          ].map((d, index) => (
            <g key={d}>
              <path
                d={d}
                stroke="#2855F9"
                strokeOpacity=".12"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <motion.path
                d={d}
                stroke="#2855F9"
                strokeWidth="3"
                strokeLinecap="round"
                initial={false}
                animate={{
                  pathLength: rail([0, 1, 4, 5][index]),
                  opacity: phase === 6 ? 0 : 0.8,
                }}
                transition={{ duration: reduced ? 0 : 0.55 }}
              />
            </g>
          ))}
        </svg>
        <DepthLayer
          x={x}
          y={y}
          factor={0.4}
          reduced={reduced}
          className="flow-position flow-source"
        >
          <motion.article
            className="flow-object flow-source-object"
            animate={enter(0)}
            transition={{ duration: reduced ? 0 : 0.32 }}
            aria-label={
              ai
                ? "Approved company knowledge"
                : "Business source: refund policy"
            }
          >
            <div className="flow-object-heading">
              <span className="flow-document-symbol" aria-hidden="true">
                ▤
              </span>
              <span>{ai ? "Approved knowledge" : "Business knowledge"}</span>
            </div>
            <h3>{ai ? "Reviewed guidance" : "Refund policy"}</h3>
            <p>
              {ai
                ? "Source + approved revision"
                : "Refunds over $500 need manager approval."}
            </p>
            <small>
              {ai ? "Source attached" : "Customer Service Handbook"}
            </small>
          </motion.article>
        </DepthLayer>
        <DepthLayer
          x={x}
          y={y}
          factor={0.2}
          reduced={reduced}
          className="flow-position flow-center"
        >
          <div className="flow-opryn-center">
            <Image
              src="/opryn-mark.png"
              width={1254}
              height={1254}
              sizes="96px"
              alt="Opryn"
              priority
            />
            <span>{ai ? "Checks access" : "Organizes"}</span>
          </div>
        </DepthLayer>
        <DepthLayer
          x={x}
          y={y}
          factor={0.6}
          reduced={reduced}
          className="flow-position flow-review"
        >
          <motion.article
            className="flow-object flow-review-object"
            inert={phase < 1 || phase === 6}
            animate={enter(1)}
            transition={{ duration: reduced ? 0 : 0.32 }}
            aria-label={ai ? "Connection permissions" : "Human review example"}
          >
            <div className="flow-object-heading">
              <span>
                {ai
                  ? "Permission"
                  : approval === "success"
                    ? "Human review · Approved"
                    : "Ready to review"}
              </span>
              <span className="flow-review-dot" aria-hidden="true" />
            </div>
            <h3>
              {ai
                ? "Selected knowledge only"
                : "Refunds over $500 require manager approval."}
            </h3>
            {ai ? (
              <p className="flow-access-status">Allowed · Access controlled</p>
            ) : (
              <div className="flow-review-actions">
                <OprynAction
                  label="Approve"
                  pendingLabel="Approving…"
                  successLabel="Approved"
                  successIcon={<ExampleApprovalCheck />}
                  state={approval}
                  announce={false}
                  onClick={approveExample}
                  className="flow-approval-action"
                />
                <button
                  type="button"
                  className="flow-edit-example"
                  onClick={() => setEditHelp((value) => !value)}
                  disabled={approval === "pending"}
                  aria-expanded={editHelp}
                >
                  Edit
                </button>
                {editHelp && (
                  <p className="flow-edit-help">
                    In your workspace, edit the proposal before approving. This
                    is an example only.
                  </p>
                )}
              </div>
            )}
          </motion.article>
        </DepthLayer>
        <DepthLayer
          x={x}
          y={y}
          factor={0.8}
          reduced={reduced}
          className="flow-position flow-question"
        >
          <motion.article
            className="flow-object flow-question-object"
            inert={phase < 4 || phase === 6}
            animate={enter(4)}
            transition={{ duration: reduced ? 0 : 0.32 }}
            aria-label={ai ? "Compatible connected AI" : "Team question"}
          >
            <div className="flow-object-heading">
              {!ai && <OprynIcon name="team" size={30} />}
              <span>{ai ? "Connected AI" : "Team / AI use"}</span>
            </div>
            <h3>
              {ai ? "Authorized connection" : "Can I refund a $750 order?"}
            </h3>
            {ai && <small>Supported connection required</small>}
          </motion.article>
        </DepthLayer>
        <DepthLayer
          x={x}
          y={y}
          factor={1}
          reduced={reduced}
          className="flow-position flow-answer"
        >
          <motion.article
            className="flow-object flow-answer-object"
            inert={phase < 5 || phase === 6}
            animate={enter(5)}
            transition={{ duration: reduced ? 0 : 0.32 }}
            aria-label={
              ai
                ? "Team access to approved guidance"
                : "Answer from approved refund policy"
            }
          >
            <div className="flow-object-heading">
              <span>{ai ? "Your team" : "Approved knowledge"}</span>
              <span className="flow-approved-mark" aria-hidden="true">
                ✓
              </span>
            </div>
            <h3>
              {ai
                ? "Approved guidance. Source attached."
                : "Manager approval is required."}
            </h3>
            <small>
              {ai
                ? "Workspace access rules apply"
                : "Customer Service Handbook"}
            </small>
          </motion.article>
        </DepthLayer>
      </motion.div>
      <div className="flow-caption">
        <span>Example workflow</span>
        <button
          type="button"
          onClick={togglePaused}
          aria-label={
            reduced
              ? "Static knowledge flow example"
              : paused
                ? "Play knowledge flow example"
                : "Pause knowledge flow example"
          }
          disabled={reduced}
        >
          {reduced ? "Static view" : paused ? "Play ↗" : "Pause Ⅱ"}
        </button>
      </div>
    </div>
  );
}

export function HumanReviewExample() {
  const { ref, approval, paused, togglePaused, approveExample, reduced } =
    useExampleSequence();
  return (
    <div className="human-review-example" ref={ref}>
      <p className="editorial-eyebrow">Example review—not a live workspace</p>
      <ol className="human-review-steps">
        <li>
          <span className="flow-step-number">01 / Proposal</span>
          <h3>Refund policy</h3>
          <p>Refunds over $500 require manager approval.</p>
        </li>
        <li>
          <span className="flow-step-number">02 / Human review</span>
          <h3>Your business decides.</h3>
          <OprynAction
            label="Approve"
            pendingLabel="Approving…"
            successLabel="Approved"
            successIcon={<ExampleApprovalCheck />}
            state={approval}
            announce={false}
            onClick={approveExample}
            className="flow-approval-action"
          />
        </li>
        <li data-approved={approval === "success"}>
          <span className="flow-step-number">03 / Approved knowledge</span>
          <h3>Ready for allowed lookups.</h3>
          <p>Only after a person approves.</p>
        </li>
      </ol>
      <button
        type="button"
        className="flow-example-control"
        disabled={reduced}
        onClick={togglePaused}
        aria-label={
          reduced
            ? "Static human review example"
            : paused
              ? "Play human review example"
              : "Pause human review example"
        }
      >
        {reduced
          ? "Static example"
          : paused
            ? "Play example →"
            : "Pause example Ⅱ"}
      </button>
    </div>
  );
}
