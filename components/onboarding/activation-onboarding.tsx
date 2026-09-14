"use client";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import Link from "next/link";
import { OprynLogo } from "@/components/opryn-logo";
import { MotionRegion } from "@/components/motion/motion-region";
import { TeachWorkspace } from "@/components/app/teach-workspace";
import { ProcessReview } from "@/components/app/process-review";
import { CompanyProfileFields } from "./company-profile";
import { WelcomeStory } from "./welcome-story";
import { PlanChoice } from "./plan-choice";
import { SetupContext } from "./setup-context";
import {
  activationGoals,
  activationStages,
  activationStage,
  emptyCompany,
  companyProfileSchema,
  type CompanyProfile,
} from "@/lib/activation";
import "./activation.css";

type Review = ComponentProps<typeof ProcessReview>["initial"] & {
  source: string;
};
type Snapshot = {
  organizationId: string;
  company: CompanyProfile;
  revision: number;
  onboarding: {
    current_step: string;
    selected_goals: string[];
    onboarding_complete: boolean;
    first_test_answered?: boolean;
  };
  sources: { id: string; title: string; status: string }[];
  review: Review | null;
  answered: boolean;
};
export function ActivationOnboarding({
  organizationId,
  plan = "core",
  billingReturn = false,
}: {
  organizationId?: string;
  plan?: "core" | "premium";
  billingReturn?: boolean;
}) {
  const [org, setOrg] = useState(organizationId);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [stage, setStage] = useState<(typeof activationStages)[number]>(
    organizationId ? "teach" : "goal",
  );
  const [goal, setGoal] = useState("answer_questions"),
    [company, setCompany] = useState(emptyCompany);
  const [loading, setLoading] = useState(!!organizationId),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [resume, setResume] = useState(!!organizationId),
    [question, setQuestion] = useState("");
  const [editing, setEditing] = useState(false);
  const [answer, setAnswer] = useState<{
      questionId: string;
      answer: string;
      sources: { label: string; href: string }[];
    } | null>(null),
    [complete, setComplete] = useState(false);
  const pending = useRef(false),
    heading = useRef<HTMLHeadingElement>(null);
  const headers = () => ({
    "Content-Type": "application/json",
    ...(org ? { "x-opryn-organization": org } : {}),
  });
  async function request(path: string, body?: unknown) {
    const response = await fetch(path, {
      method: body ? "POST" : "GET",
      headers: headers(),
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "That didn't finish. Try again.");
    return data;
  }
  async function load(id?: string) {
    const data = (await request(
      `/api/onboarding/activation${id ? `?processId=${encodeURIComponent(id)}` : ""}`,
    )) as Snapshot;
    setSnapshot(data);
    setCompany({ ...emptyCompany, ...data.company });
    return data;
  }
  useEffect(() => {
    if (!organizationId) return;
    const controller = new AbortController();
    void fetch("/api/onboarding/activation", {
      signal: controller.signal,
      cache: "no-store",
      headers: { "x-opryn-organization": organizationId },
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d as Snapshot;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setSnapshot(data);
        setCompany({ ...emptyCompany, ...data.company });
        setGoal(data.onboarding.selected_goals[0] || "answer_questions");
        setStage(
          data.onboarding.first_test_answered
            ? "plan"
            : data.review
              ? data.review.status === "approved"
                ? "try"
                : "review"
              : activationStage(data.onboarding.current_step),
        );
        if (billingReturn) setResume(false);
        if (data.review)
          setQuestion(`What should I know about ${data.review.title}?`);
        // ConnectionAction owns OAuth. Mount the source stage immediately on its return.
        try {
          if (sessionStorage.getItem(`opryn:teach-google:${organizationId}`))
            setResume(false);
        } catch {
          /* Storage is optional. */
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [organizationId, billingReturn]);
  useEffect(() => {
    if (!loading && !resume) heading.current?.focus({ preventScroll: true });
  }, [stage, loading, resume]);
  async function run(work: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Check your connection and retry.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function saveCompany() {
    await run(async () => {
      const profile = companyProfileSchema.parse(company);
      let revision = snapshot?.revision;
      if (!org) {
        const n = profile.employee_count;
        const created = await request("/api/onboarding", {
          name: profile.name,
          industry: profile.industry,
          teamSize:
            n === 1
              ? "just_me"
              : n <= 5
                ? "2_5"
                : n <= 10
                  ? "6_10"
                  : n <= 20
                    ? "11_20"
                    : n <= 50
                      ? "21_50"
                      : "50_plus",
          ownerRole: "Workspace owner",
        });
        setOrg(created.organizationId);
        const data = await load();
        revision = data.revision;
      }
      await request("/api/onboarding/activation", {
        action: "company",
        revision,
        profile,
        goal,
      });
      const data = await load();
      setOrg(data.organizationId);
      setStage("teach");
    });
  }
  async function prepared(id: string) {
    await run(async () => {
      await request("/api/onboarding/activation", {
        action: "source",
        processId: id,
      });
      const data = await load(id);
      setQuestion(
        `What should I know about ${data.review?.title || "this process"}?`,
      );
      setAnswer(null);
      setEditing(false);
      setResume(false);
      setStage(data.review?.status === "approved" ? "try" : "review");
    });
  }
  const titles = {
    goal: "Let’s set up Opryn around your business.",
    company: "Tell Opryn about your company.",
    teach: "Give Opryn something real to learn.",
    review: "Opryn found something worth keeping.",
    try: "Ask your business a question.",
    plan: "Choose how you want to continue.",
  };
  const index = activationStages.indexOf(stage);
  return (
    <main className="activation-root">
      <header className="activation-header">
        <Link href="/app" aria-label="Opryn home">
          <OprynLogo size="small" />
        </Link>
        <Link href={org ? "/app" : "/login"}>Exit setup</Link>
      </header>
      <nav className="activation-progress" aria-label="Setup progress">
        <ol>
          {[
            "Welcome",
            "Company setup",
            "Teach Opryn",
            "Review",
            "Try Opryn",
            "Continue",
          ].map((label, i) => (
            <li
              key={label}
              aria-current={i === index ? "step" : undefined}
              data-done={i < index}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              {label}
            </li>
          ))}
        </ol>
      </nav>
      <div className="activation-content">
        {loading ? (
          <p role="status">Loading your saved setup…</p>
        ) : !snapshot && org ? (
          <>
            <p role="alert">{error || "Setup couldn't load."}</p>
            <button onClick={() => location.reload()}>Try again</button>
          </>
        ) : resume ? (
          <section className="activation-resume">
            <p className="activation-eyebrow">{company.name}</p>
            <h1>Continue setting up Opryn?</h1>
            <p>Your company profile and prepared sources are saved.</p>
            <button
              className="activation-primary"
              onClick={() => setResume(false)}
            >
              Continue setup
            </button>
            <Link href="/app">Start using Opryn</Link>
          </section>
        ) : complete ? (
          <MotionRegion variant="status">
            <p className="activation-status approved">
              Approved knowledge · Sourced answer
            </p>
            <h1>Opryn is ready.</h1>
            <p>
              You’ve created your first approved company knowledge and used it
              to answer a real question.
            </p>
            <Link className="activation-primary" href="/app">
              Go to Opryn →
            </Link>
            <div className="activation-expansion">
              <p>When you’re ready</p>
              <Link href="/app/team">Invite your team →</Link>
              <Link href="/app/integrations">
                Connect Opryn somewhere else →
              </Link>
              <Link href="/app/processes/new">Teach Opryn more →</Link>
            </div>
          </MotionRegion>
        ) : (
          <>
            <header className="activation-title">
              <p className="activation-eyebrow">
                {org ? company.name : "Set up Opryn"}
              </p>
              <h1 ref={heading} tabIndex={-1}>
                {titles[stage]}
              </h1>
              <p>
                {stage === "goal"
                  ? "We’ll tailor setup around what matters most to your business."
                  : stage === "teach"
                    ? "Choose one source. You can add more anytime."
                    : stage === "review"
                      ? "Nothing becomes official until someone approves it."
                      : stage === "try"
                        ? "Use the suggested question or ask your own."
                        : stage === "plan"
                          ? "You’ve already taught Opryn its first piece of company knowledge."
                          : "Give Opryn a little context and it can help finish the setup with you."}
              </p>
            </header>
            {stage !== "goal" && (
              <SetupContext
                company={company.name}
                goal={
                  activationGoals.find(([id]) => id === goal)?.[1] ||
                  "Your setup"
                }
                title={
                  ["review", "try", "plan"].includes(stage)
                    ? snapshot?.review?.title
                    : undefined
                }
                approved={snapshot?.review?.status === "approved"}
              />
            )}
            <MotionRegion changeKey={stage} variant="quiet">
              {stage === "goal" && (
                <div className="setup-welcome-grid">
                  <div>
                    <h2 className="setup-goal-heading">
                      What do you want help with first?
                    </h2>
                    <div className="activation-goals">
                      {activationGoals.map(([id, label]) => (
                        <button
                          type="button"
                          key={id}
                          aria-pressed={id === goal}
                          onClick={() => setGoal(id)}
                        >
                          <span>{label}</span>
                          <span aria-hidden>{id === goal ? "✓" : "→"}</span>
                        </button>
                      ))}
                    </div>
                    <button
                      className="activation-primary"
                      onClick={() => setStage("company")}
                    >
                      Continue →
                    </button>
                  </div>
                  <WelcomeStory />
                </div>
              )}
              {stage === "company" && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void saveCompany();
                  }}
                >
                  <fieldset disabled={busy}>
                    <CompanyProfileFields
                      value={company}
                      onChange={setCompany}
                      organizationId={org}
                      goal={goal}
                    />
                    <button className="activation-primary">
                      {busy ? "Saving company…" : "Save and continue →"}
                    </button>
                  </fieldset>
                </form>
              )}
              {stage === "teach" && org && (
                <>
                  {company.firstTeachQuestion && (
                    <div className="setup-teach-recommendation">
                      <p className="activation-eyebrow">
                        Your starting point · Editable, not policy
                      </p>
                      <h2>{company.firstTeachQuestion}</h2>
                      <p>{company.sourceReason}</p>
                    </div>
                  )}
                  <TeachWorkspace
                    organizationId={org}
                    organizationName={company.name}
                    roles={[]}
                    plan={plan}
                    returnTo="/onboarding"
                    onPrepared={(id) => void prepared(id)}
                  />
                  {!!snapshot?.sources.length && (
                    <section className="activation-saved-sources">
                      <h2>Continue with a saved source</h2>
                      {snapshot.sources.map((s) => (
                        <button
                          disabled={busy}
                          key={s.id}
                          onClick={() => void prepared(s.id)}
                        >
                          {s.title}
                          <span>
                            {s.status === "approved"
                              ? "Try an answer"
                              : "Review findings"}{" "}
                            →
                          </span>
                        </button>
                      ))}
                    </section>
                  )}
                </>
              )}
              {stage === "review" && snapshot?.review && (
                <>
                  <p className="activation-status">
                    Needs Review · {company.name}
                  </p>
                  <p className="activation-note">
                    Source: {snapshot.review.source}
                  </p>
                  {editing ? (
                    <ProcessReview
                      key={snapshot.review.id}
                      initial={snapshot.review}
                      roleOptions={[]}
                      expertOptions={[]}
                      returnTo="/onboarding"
                      onApproved={() => {
                        void run(async () => {
                          await load(snapshot.review!.id);
                          setStage("try");
                        });
                      }}
                    />
                  ) : (
                    <article className="activation-review">
                      <h2>{snapshot.review.title}</h2>
                      <p>{snapshot.review.summary}</p>
                      {snapshot.review.rules.map((rule, i) => (
                        <section key={i}>
                          <h3>{rule.title}</h3>
                          <p>{rule.text}</p>
                        </section>
                      ))}
                      {!!snapshot.review.steps.length && (
                        <ol>
                          {snapshot.review.steps.map((step, i) => (
                            <li key={i}>
                              <strong>{step.title}</strong>
                              <p>{step.description}</p>
                            </li>
                          ))}
                        </ol>
                      )}
                      {snapshot.review.exceptions.map((item, i) => (
                        <p key={i}>
                          <strong>Exception: </strong>
                          {item.text}
                        </p>
                      ))}
                      {snapshot.review.clarifications
                        .filter((q) => !q.answer)
                        .map((q) => (
                          <p key={q.id} className="activation-note">
                            <strong>Needs clarification: </strong>
                            {q.question}
                          </p>
                        ))}
                      <div className="activation-review-actions">
                        <button
                          disabled={
                            busy ||
                            snapshot.review.clarifications.some(
                              (q) => !q.answer,
                            )
                          }
                          className="activation-primary"
                          onClick={() =>
                            void run(async () => {
                              await request(
                                `/api/processes/${snapshot.review!.id}/approve`,
                                {},
                              );
                              await load(snapshot.review!.id);
                              setStage("try");
                            })
                          }
                        >
                          {busy ? "Saving decision…" : "Approve"}
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => setEditing(true)}
                        >
                          Edit
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await request(
                                `/api/processes/${snapshot.review!.id}/deny`,
                                {},
                              );
                              await load();
                              setStage("teach");
                            })
                          }
                        >
                          Deny
                        </button>
                      </div>
                    </article>
                  )}
                </>
              )}
              {stage === "try" && (
                <form
                  className="activation-ask"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      const data = await request("/api/ask", {
                        question,
                        history: [],
                        image: null,
                      });
                      if (data.type !== "answer" || !data.sources?.length)
                        throw new Error(
                          "No sourced answer yet. Review the source or ask a more specific question.",
                        );
                      setAnswer({
                        questionId: data.questionId,
                        answer: data.answer,
                        sources: data.sources,
                      });
                    });
                  }}
                >
                  <label>
                    Your question
                    <textarea
                      required
                      minLength={3}
                      maxLength={4000}
                      value={question}
                      onChange={(e) => {
                        setQuestion(e.target.value);
                        setAnswer(null);
                      }}
                    />
                  </label>
                  <button className="activation-primary" disabled={busy}>
                    {busy ? "Looking up approved knowledge…" : "Ask Opryn →"}
                  </button>
                  {answer && (
                    <MotionRegion variant="status">
                      <article className="activation-answer">
                        <p className="activation-status approved">
                          Answer from approved knowledge
                        </p>
                        <p>{answer.answer}</p>
                        <div>
                          {answer.sources
                            .filter((s) => s.href?.startsWith("/app/"))
                            .map((s, i) => (
                              <Link
                                key={i}
                                href={s.href}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {s.label || "Source"} ↗
                              </Link>
                            ))}
                        </div>
                      </article>
                      <button
                        type="button"
                        disabled={busy}
                        className="activation-primary"
                        onClick={() =>
                          void run(async () => {
                            await request("/api/onboarding/activation", {
                              action: "finish",
                              questionId: answer.questionId,
                            });
                            setStage("plan");
                          })
                        }
                      >
                        Continue →
                      </button>
                    </MotionRegion>
                  )}
                </form>
              )}
              {stage === "plan" && org && (
                <PlanChoice
                  organizationId={org}
                  onComplete={() => setComplete(true)}
                />
              )}
            </MotionRegion>
            {error && (
              <p className="activation-error" role="alert">
                {error}
              </p>
            )}
            {stage !== "goal" && stage !== "teach" && stage !== "plan" && (
              <button
                className="activation-back"
                disabled={busy}
                onClick={() => setStage(stage === "company" ? "goal" : "teach")}
              >
                {stage === "company" ? "Back" : "Choose a different source"}
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
}
