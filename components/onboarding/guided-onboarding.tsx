"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, Mic, Search, X } from "lucide-react";
import type { IconType } from "react-icons";
import {
  FaGithub,
  FaGoogle,
  FaMicrosoft,
  FaSalesforce,
  FaSlack,
} from "react-icons/fa6";
import {
  SiAircall,
  SiAsana,
  SiBitbucket,
  SiBox,
  SiCalendly,
  SiClickup,
  SiConfluence,
  SiDiscord,
  SiDropbox,
  SiFigma,
  SiGmail,
  SiGitlab,
  SiGooglechat,
  SiGoogledocs,
  SiGoogledrive,
  SiHubspot,
  SiIntercom,
  SiJira,
  SiLinear,
  SiLoom,
  SiMailchimp,
  SiMake,
  SiN8N,
  SiNotion,
  SiQuickbooks,
  SiShopify,
  SiSquare,
  SiStripe,
  SiTrello,
  SiXero,
  SiZapier,
  SiZendesk,
  SiZoom,
  SiClaude,
} from "react-icons/si";
import { BsOpenai } from "react-icons/bs";
import { ConnectionGuide } from "@/components/connections/connection-guide";
import { SourceFirstLearning } from "@/components/onboarding/source-first-learning";
import { CredentialConnectionButton } from "@/components/connections/credential-connection";
import {
  OnboardingActions,
  OnboardingShell,
  OnboardingTransition,
} from "@/components/onboarding/onboarding-shell";
import { OprynLearningFlow } from "@/components/opryn/opryn-learning-flow";
import {
  CONNECTION_PROVIDERS,
  recommendedProviderIds,
  type ConnectionProviderId,
} from "@/lib/connections/providers";
import {
  BUSINESS_TYPE_GROUPS,
  POPULAR_BUSINESS_TYPES,
  searchBusinessTypes,
} from "@/lib/onboarding-catalog";
import {
  BUSINESS_TOOLS,
  POPULAR_BUSINESS_TOOL_IDS,
  searchBusinessTools,
  type BusinessTool,
} from "@/lib/onboarding-tools";
import {
  goalSummary,
  onboardingSourceLabel,
  type OnboardingView,
  type OnboardingStep,
} from "@/lib/onboarding";

type LocalStep = "welcome" | "business" | OnboardingStep;
const LOCAL_DRAFT_KEY = "opryn-onboarding-draft-v1";
type LocalOnboardingDraft = {
  step?: string;
  business?: Partial<{
    name: string;
    industry: string;
    teamSize: string;
    ownerRole: string;
  }>;
};
type InitialState = {
  organization: {
    id: string;
    name: string;
    industry: string;
    employeeCount: number;
  };
  businessContext: string;
  plan: "core" | "premium";
  onboarding: {
    current_step: OnboardingStep;
    current_view?: OnboardingView | null;
    selected_goals: string[];
    knowledge_locations: string[];
    selected_tools: string[];
    selected_ai_tools: string[];
    skipped_connections: string[];
    suggested_knowledge_areas: string[];
    first_question: string | null;
    first_answer: string | null;
    first_rule_id: string | null;
    first_knowledge_id: string | null;
    first_test_question: string | null;
    first_test_answered: boolean;
    team_invited: boolean;
  };
  connected: Record<ConnectionProviderId, boolean>;
  returnedConnection: string | null;
  requestedStep: string | null;
  availability: {
    slack: boolean;
    teams: boolean;
  };
};

const goals = [
  [
    "answer_questions",
    "Fewer team questions",
    "Stop answering the same questions all day.",
  ],
  [
    "train_people",
    "Helping new people learn",
    "Give new teammates approved guidance they can follow.",
  ],
  [
    "organize_knowledge",
    "Organizing company knowledge",
    "Bring documents, rules, and processes into one place.",
  ],
  [
    "ai_tools",
    "Giving AI tools company context",
    "Connect ChatGPT, Claude, or an existing agent.",
    "Premium",
  ],
] as const;
const goalPlans: Record<string, { title: string; description: string }> = {
  answer_questions: {
    title: "Give your team reliable answers",
    description: "Opryn will prioritize the questions that interrupt you most.",
  },
  train_people: {
    title: "Make team handoffs easier",
    description:
      "New teammates will see the approved processes and answers their role needs.",
  },
  capture_knowledge: {
    title: "Capture what currently depends on you",
    description:
      "Opryn will suggest the first processes and decisions to teach.",
  },
  organize_knowledge: {
    title: "Create one approved source of truth",
    description:
      "Documents, answers, and processes will feed the same knowledge system.",
  },
  learn_calls: {
    title: "Prepare Call Learning",
    description:
      "Opryn will guide you through reviewing useful knowledge from authorized calls.",
  },
  ai_tools: {
    title: "Prepare your AI connections",
    description:
      "ChatGPT, Claude, or your agent can use the same approved knowledge.",
  },
  owner_independence: {
    title: "Reduce owner-only decisions",
    description: "Opryn will surface what the team still needs you to explain.",
  },
};
const learningSources = [
  [
    "google_drive",
    "Google Drive",
    "Bring in selected documents, policies, and procedures.",
  ],
  [
    "documents",
    "Documents",
    "Upload PDFs, Word files, or company training material.",
  ],
  [
    "in_my_head",
    "Explain It",
    "Tell Opryn how something works using voice or text.",
  ],
  [
    "chatgpt",
    "ChatGPT",
    "Connect for future Opryn access or provide selected conversations.",
  ],
  [
    "claude",
    "Claude",
    "Use Opryn from Claude or provide selected conversation content.",
  ],
  [
    "slack",
    "Slack",
    "Let your team ask Opryn from supported messages and mentions.",
  ],
  [
    "teams",
    "Microsoft Teams",
    "Let your team use approved Opryn knowledge in Teams.",
  ],
  [
    "twilio",
    "Calls",
    "Learn from selected recorded business conversations.",
    "Premium",
  ],
  [
    "video",
    "Video / Screen Recording",
    "Show Opryn how you perform a process.",
    "Premium",
  ],
] as const;
const aiTools = [
  ["chatgpt", "ChatGPT", "Connect now and use approved Opryn knowledge there."],
  [
    "claude",
    "Claude",
    "Connect now and use Opryn when asking about your company.",
  ],
  [
    "gemini",
    "Google Gemini",
    "Tell Opryn you use it so setup can be personalized.",
  ],
  [
    "copilot",
    "Microsoft Copilot",
    "Tell us you use it so Opryn can prioritize future support.",
    "",
  ],
  [
    "perplexity",
    "Perplexity",
    "Tell us you use it so Opryn can prioritize future support.",
    "",
  ],
  [
    "custom_agent",
    "Custom AI Agent",
    "Connect an agent through Opryn's MCP or API.",
    "Premium",
  ],
  [
    "voice_agent",
    "Voice AI Agent",
    "Give an existing phone or voice agent approved answers.",
  ],
  [
    "website_chatbot",
    "Website Chatbot",
    "Ground a customer-facing bot in approved knowledge.",
  ],
  ["zapier", "Zapier", "Use Opryn in an automation workflow."],
  [
    "automation",
    "n8n / Make",
    "Connect a custom workflow through the Opryn API.",
  ],
  ["none", "None yet", "You can add an AI connection later."],
  ["other", "Something else", "You can tell Opryn about it later."],
] as const;
export function GuidedOnboarding({
  firstName,
  initialState = null,
  joinMode = false,
  initialCode = "",
}: {
  firstName: string;
  initialState?: InitialState | null;
  joinMode?: boolean;
  initialCode?: string;
}) {
  const router = useRouter();
  const requested = initialState?.requestedStep;
  const resumedStep =
    requested && isStep(requested)
      ? requested
      : initialState?.returnedConnection
        ? "connections"
        : (initialState?.onboarding.current_step ?? "welcome");
  const initialStep = resumedStep === "tools" ? "knowledge" : resumedStep;
  const [step, setStep] = useState<LocalStep>(
    joinMode ? "business" : initialStep,
  );
  const [organization, setOrganization] = useState(
    initialState?.organization ?? null,
  );
  const [business, setBusiness] = useState({
    name: initialState?.organization.name ?? "",
    industry: initialState?.organization.industry ?? "",
    teamSize: initialState
      ? employeeRange(initialState.organization.employeeCount)
      : "",
    ownerRole: "Owner",
  });
  const [selectedGoals, setSelectedGoals] = useState(
    initialState?.onboarding.selected_goals ?? [],
  );
  const [businessContext, setBusinessContext] = useState(
    initialState?.businessContext ?? "",
  );
  const [locations, setLocations] = useState(
    initialState?.onboarding.knowledge_locations ?? [],
  );
  const [tools, setTools] = useState(
    initialState?.onboarding.selected_tools ?? [],
  );
  const [selectedAi, setSelectedAi] = useState(
    initialState?.onboarding.selected_ai_tools ?? [],
  );
  const [skippedConnections, setSkippedConnections] = useState(
    initialState?.onboarding.skipped_connections ?? [],
  );
  const [connected, setConnected] = useState<
    Record<ConnectionProviderId, boolean>
  >(
    initialState?.connected ?? {
      google_drive: false,
      slack: false,
      teams: false,
      twilio: false,
      chatgpt: false,
      claude: false,
      custom_agent: false,
    },
  );
  const [toolSubstep, setToolSubstep] = useState<"business" | "ai">(
    initialState?.onboarding.current_view === "tools_ai" ? "ai" : "business",
  );
  const [goalConfirmed, setGoalConfirmed] = useState(
    initialState?.onboarding.current_view === "goals_plan",
  );
  const [guide, setGuide] = useState<"chatgpt" | "claude" | null>(null);
  const [guideMode, setGuideMode] = useState<"connect" | "learn">("learn");
  const [manualTeaching, setManualTeaching] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [firstQuestion, setFirstQuestion] = useState(
    initialState?.onboarding.first_question ?? "",
  );
  const [firstAnswer, setFirstAnswer] = useState(
    initialState?.onboarding.first_answer ?? "",
  );
  const [suggestion, setSuggestion] = useState<{
    title: string;
    rule: string;
    clarificationQuestions: string[];
  } | null>(null);
  const [clarificationAnswer, setClarificationAnswer] = useState("");
  const [testQuestion, setTestQuestion] = useState(
    initialState?.onboarding.first_test_question ?? "",
  );
  const [testResult, setTestResult] = useState<{
    headline: string;
    answer: string;
    source: string;
  } | null>(null);
  const [inviteEmails, setInviteEmails] = useState("");
  const [inviteCount, setInviteCount] = useState(
    initialState?.onboarding.team_invited ? 1 : 0,
  );
  const [accessCode, setAccessCode] = useState(initialCode);

  const recommended = useMemo(
    () =>
      recommendedProviderIds({
        knowledgeLocations: locations,
        selectedTools: tools,
        selectedAiTools: selectedAi,
        goals: selectedGoals,
      }),
    [locations, tools, selectedAi, selectedGoals],
  );
  const connectionChoices = useMemo(() => {
    const ids = recommended;
    return CONNECTION_PROVIDERS.filter(
      (provider) =>
        ids.includes(provider.id) &&
        isProviderAvailable(provider, initialState?.availability),
    );
  }, [initialState?.availability, recommended]);
  const selectedSourceLabels = Array.from(
    new Set(locations.map(onboardingSourceLabel)),
  );
  const phase = phaseForStep(step);

  useEffect(() => {
    if (initialState || joinMode) return;
    let saved: LocalOnboardingDraft | null = null;
    try {
      saved = JSON.parse(
        localStorage.getItem(LOCAL_DRAFT_KEY) ?? "null",
      ) as LocalOnboardingDraft | null;
    } catch {
      localStorage.removeItem(LOCAL_DRAFT_KEY);
    }
    if (!saved) return;
    const timeout = window.setTimeout(() => {
      if (saved?.step === "business") setStep("business");
      if (saved?.business)
        setBusiness((current) => ({ ...current, ...saved.business }));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [initialState, joinMode]);

  useEffect(() => {
    if (initialState || joinMode || organization) return;
    localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify({ step, business }));
  }, [business, initialState, joinMode, organization, step]);

  useEffect(() => {
    if (!organization || joinMode || step === "welcome" || step === "business")
      return;
    const currentView: OnboardingView =
      step === "goals" && goalConfirmed
        ? "goals_plan"
        : step === "tools"
          ? toolSubstep === "ai"
            ? "tools_ai"
            : "tools_business"
          : step;
    void fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentStep: step, currentView }),
      keepalive: true,
    });
    window.history.replaceState(null, "", `/onboarding?step=${step}`);
  }, [goalConfirmed, joinMode, organization, step, toolSubstep]);

  async function createBusiness() {
    if (
      !business.name.trim() ||
      !business.industry ||
      !business.teamSize ||
      !business.ownerRole
    ) {
      setError(
        "Add your business name, industry, team size, and role to continue.",
      );
      return;
    }
    setBusy(true);
    setError("");
    if (organization) {
      const response = await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          business,
          currentStep: "goals",
          currentView: "goals",
        }),
      });
      const body = await response.json().catch(() => ({}));
      setBusy(false);
      if (!response.ok)
        return setError(
          body.error || "Opryn couldn't update the business details.",
        );
      setOrganization({
        ...organization,
        name: business.name,
        industry: business.industry,
        employeeCount: employeeCountForRange(business.teamSize),
      });
      setStep("goals");
      return;
    }
    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(business),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok)
      return setError(body.error || "Opryn couldn't create the business.");
    setOrganization({
      id: body.organizationId,
      name: business.name,
      industry: business.industry,
      employeeCount: employeeCountForRange(business.teamSize),
    });
    localStorage.removeItem(LOCAL_DRAFT_KEY);
    router.push("/app?welcome=1");
    router.refresh();
  }

  async function saveLearningSources() {
    const aiSelections = locations.filter(
      (source) => source === "chatgpt" || source === "claude",
    );
    setSelectedAi(aiSelections);
    return saveStep(
      "goals",
      {
        knowledgeLocations: locations,
        selectedAiTools: aiSelections,
      },
      "knowledge_location_selected",
    );
  }

  async function saveStep(
    next: OnboardingStep,
    payload: Record<string, unknown>,
    event?: string,
  ) {
    setBusy(true);
    setError("");
    const response = await fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...payload,
        currentStep: next,
        completedStep: step,
        event,
        eventMetadata: { step },
      }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(body.error || "Opryn couldn't save this step.");
      return false;
    }
    setStep(next);
    window.history.replaceState(null, "", `/onboarding?step=${next}`);
    return true;
  }

  async function analyzeKnowledge(clarify = false) {
    if (!firstQuestion.trim() || !firstAnswer.trim()) {
      setError(
        "Add the repeated question and the answer your team should follow.",
      );
      return;
    }
    if (clarify && !clarificationAnswer.trim()) {
      setError("Answer Opryn's clarification before continuing.");
      return;
    }
    setBusy(true);
    setError("");
    const response = await fetch("/api/onboarding/first-knowledge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "analyze",
        question: firstQuestion,
        answer: firstAnswer,
        clarificationAnswers:
          clarify && suggestion?.clarificationQuestions[0]
            ? [
                {
                  question: suggestion.clarificationQuestions[0],
                  answer: clarificationAnswer,
                },
              ]
            : [],
      }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok)
      return setError(body.error || "Opryn couldn't review this answer.");
    setSuggestion({
      title: body.title,
      rule: body.rule,
      clarificationQuestions: body.clarificationQuestions ?? [],
    });
    if (clarify) setClarificationAnswer("");
  }

  async function approveKnowledge() {
    if (!suggestion) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/onboarding/first-knowledge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "approve",
        question: firstQuestion,
        answer: firstAnswer,
        title: suggestion.title,
        rule: suggestion.rule,
      }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok)
      return setError(body.error || "Opryn couldn't approve this answer.");
    setTestQuestion(body.testQuestion || firstQuestion);
    setStep("test");
    window.history.replaceState(null, "", "/onboarding?step=test");
  }

  async function runTest() {
    if (!testQuestion.trim()) return setError("Ask a complete test question.");
    setBusy(true);
    setError("");
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: testQuestion,
        history: [],
        image: null,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.type !== "answer") {
      setBusy(false);
      setError(
        body.type === "unknown"
          ? "Opryn needs one more detail before it can answer this. Go back and make the rule more specific."
          : body.error || "Opryn couldn't test this answer.",
      );
      return;
    }
    setTestResult({
      headline: body.headline || "Based on your approved answer",
      answer: body.answer,
      source:
        body.sources?.[0]?.label ||
        suggestion?.title ||
        "Approved company knowledge",
    });
    await fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        currentStep: "invite",
        completedStep: "test",
        firstTestQuestion: testQuestion,
        firstTestAnswered: true,
        event: "first_test_question",
        eventMetadata: { answered: true },
      }),
    });
    setBusy(false);
  }

  async function inviteTeam() {
    const emails = Array.from(
      new Set(
        inviteEmails
          .split(/[\s,;]+/)
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      ),
    );
    if (!emails.length)
      return setError("Add at least one team email, or choose Do this later.");
    setBusy(true);
    setError("");
    let delivered = 0;
    for (const email of emails) {
      const response = await fetch("/api/team/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (response.ok) delivered += 1;
      else {
        const body = await response.json().catch(() => ({}));
        setBusy(false);
        return setError(body.error || `Opryn couldn't invite ${email}.`);
      }
    }
    setInviteCount(delivered);
    await finishOnboarding(true);
  }

  async function finishOnboarding(teamInvited: boolean) {
    setBusy(true);
    setError("");
    const response = await fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        currentStep: "complete",
        completedStep: "invite",
        teamInvited,
        onboardingComplete: true,
        event: "onboarding_completed",
        eventMetadata: {
          activated: Boolean(
            testResult || initialState?.onboarding.first_test_answered,
          ),
        },
      }),
    });
    setBusy(false);
    if (!response.ok)
      return setError(
        "Opryn couldn't finish setup. Your progress is still saved.",
      );
    setStep("complete");
  }

  async function joinTeam() {
    if (accessCode.trim().length < 8)
      return setError("Enter the code from your invitation.");
    setBusy(true);
    const response = await fetch("/api/invites/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: accessCode }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok)
      return setError(body.error || "Opryn couldn't join this team.");
    router.push("/app");
    router.refresh();
  }

  const transitionKey = `${step}:${goalConfirmed ? "summary" : "select"}:${toolSubstep}:${suggestion ? (suggestion.clarificationQuestions.length ? "clarify" : "review") : "input"}:${testResult ? "answered" : "question"}`;

  if (joinMode)
    return (
      <OnboardingShell phase={0}>
        <StepHeading
          eyebrow="Join your team"
          title="Enter your Opryn access code."
          description="Use the code included in the invitation from your business."
        />
        <label className="mt-8 block text-sm font-semibold">
          Access code
          <input
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value)}
            className="onboarding-input mt-2 uppercase tracking-[.12em]"
            autoComplete="one-time-code"
          />
        </label>
        <ErrorMessage message={error} />
        <OnboardingActions
          next={() => void joinTeam()}
          nextLabel="Join Team"
          busy={busy}
        />
      </OnboardingShell>
    );

  return (
    <OnboardingShell
      phase={phase}
      onHelp={() => setAssistantOpen(true)}
      exitHref={organization ? "/app" : "/"}
    >
      <OnboardingTransition transitionKey={transitionKey}>
        {step === "welcome" ? (
          <div className="-m-5 border-t-[6px] border-[#2782ff] bg-[#eef5ff] px-6 py-12 sm:-m-10 sm:px-10 sm:py-16 lg:-m-14 lg:px-14 lg:py-20">
            <p className="text-sm font-extrabold uppercase tracking-[.13em] text-[#146bff]">
              Welcome, {firstName}
            </p>
            <h1 className="mt-5 max-w-[680px] text-5xl font-extrabold leading-[.98] tracking-[-.065em] text-[#071b3d] sm:text-7xl">
              Your business knows a lot.
              <br />
              <span className="text-[#146bff]">Let&apos;s put it to work.</span>
            </h1>
            <p className="mt-7 max-w-[590px] text-lg font-medium leading-8 text-[#53657d]">
              Opryn will use a few short answers to prepare the right starting
              setup, then help you teach one useful answer.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setStep("business")}
                className="min-h-12 rounded-xl bg-[#1975ff] px-6 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(20,107,255,.3)] transition hover:-translate-y-px hover:bg-[#2f83ff] motion-reduce:transform-none"
              >
                Set Up My Business
              </button>
              <Link
                href="/"
                className="inline-flex min-h-12 items-center rounded-xl px-4 text-sm font-bold text-[#60728a] transition-colors hover:bg-white hover:text-[#17345f]"
              >
                I&apos;ll do this later
              </Link>
            </div>
          </div>
        ) : null}

        {step === "business" ? (
          <>
            <StepHeading
              eyebrow="Your business"
              title="Let’s make Opryn feel like your business."
              description="Four quick details are enough to personalize what Opryn recommends next."
            />
            <div className="mt-10 grid gap-5 sm:grid-cols-[minmax(0,1fr)_230px]">
              <Field
                label="Business name"
                value={business.name}
                onChange={(name) => setBusiness({ ...business, name })}
                placeholder="Johnson Plumbing"
              />
              <label className="block text-sm font-semibold">
                Your role
                <select
                  value={business.ownerRole}
                  onChange={(event) =>
                    setBusiness({ ...business, ownerRole: event.target.value })
                  }
                  className="onboarding-input mt-2"
                >
                  {["Owner", "Founder", "Manager", "Operations", "Other"].map(
                    (role) => (
                      <option key={role}>{role}</option>
                    ),
                  )}
                </select>
              </label>
            </div>
            <div className="mt-9 border-t border-[#e1e6ed] pt-8">
              <IndustrySelector
                value={business.industry}
                onChange={(industry) => setBusiness({ ...business, industry })}
              />
            </div>
            <fieldset className="mt-8 rounded-[18px] bg-[#f1f5fb] px-5 py-5 sm:px-6">
              <legend className="px-1 text-sm font-bold text-[#17345f]">
                How many people are on the team?
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  ["just_me", "Just me"],
                  ["2_5", "2–5"],
                  ["6_10", "6–10"],
                  ["11_20", "11–20"],
                  ["21_50", "21–50"],
                  ["50_plus", "50+"],
                ].map(([value, label]) => (
                  <ChoiceButton
                    key={value}
                    selected={business.teamSize === value}
                    onClick={() =>
                      setBusiness({ ...business, teamSize: value })
                    }
                  >
                    {label}
                  </ChoiceButton>
                ))}
              </div>
            </fieldset>
            <ErrorMessage message={error} />
            <OnboardingActions
              back={() => setStep("welcome")}
              next={() => void createBusiness()}
              busy={busy}
            />
          </>
        ) : null}

        {step === "goals" ? (
          <>
            {!goalConfirmed ? (
              <>
                <StepHeading
                  eyebrow="A little context"
                  title="What does your business do?"
                  description="A short description helps Opryn understand what it reads. It will never use this to invent company policy."
                />
                <div className="mt-8 rounded-[20px] border border-[#d6e1ef] bg-[#f7faff] p-5 sm:p-6">
                  <textarea
                    value={businessContext}
                    onChange={(event) => setBusinessContext(event.target.value)}
                    rows={4}
                    className="onboarding-input min-h-32 resize-y bg-white"
                    placeholder="We're a marketing agency that builds websites, runs advertising, and manages client campaigns."
                    aria-label="What your business does"
                  />
                  <div className="mt-3">
                    <DictationButton onText={setBusinessContext} />
                  </div>
                </div>
                <div className="mt-9">
                  <p className="text-sm font-bold text-[#17345f]">
                    What should Opryn help with most?
                  </p>
                  <p className="mt-1 text-sm text-[#718095]">
                    Pick anything that matters. This only shapes your starting
                    setup.
                  </p>
                </div>
                <SelectionList
                  options={goals}
                  selected={selectedGoals}
                  onToggle={(value) =>
                    setSelectedGoals(toggle(selectedGoals, value))
                  }
                  compact
                />
                <button
                  type="button"
                  onClick={() =>
                    setSelectedGoals(
                      selectedGoals.length === goals.length
                        ? []
                        : goals.map((goal) => goal[0]),
                    )
                  }
                  className="mt-4 min-h-10 rounded-full bg-[#edf4ff] px-4 text-sm font-bold text-[#0b5ed7] transition hover:bg-[#e0ecff]"
                >
                  {selectedGoals.length === goals.length
                    ? "Clear all"
                    : "All of the above"}
                </button>
                <ErrorMessage message={error} />
                <OnboardingActions
                  back={() => setStep("knowledge")}
                  next={() =>
                    selectedGoals.length
                      ? setGoalConfirmed(true)
                      : setError("Choose at least one goal.")
                  }
                />
              </>
            ) : (
              <div className="py-4 sm:py-8">
                <StepHeading
                  eyebrow="Your starting plan"
                  title="Got it. Opryn will start here."
                  description={`Opryn will ${goalSummary(selectedGoals)}. Next, connect only the sources that can help with that.`}
                />
                <div className="mt-8 overflow-hidden rounded-[22px] border border-[#cfe0f7] bg-[#eef5ff] px-5 shadow-[0_16px_42px_rgba(40,91,155,.08)] sm:px-7">
                  {selectedGoals.slice(0, 4).map((goal, index) => {
                    const plan = goalPlans[goal];
                    if (!plan) return null;
                    return (
                      <div
                        key={goal}
                        className="onboarding-sequence-item grid gap-3 border-b border-[#d6e4f5] py-6 last:border-0 sm:grid-cols-[52px_1fr]"
                        style={{ animationDelay: `${index * 70}ms` }}
                      >
                        <span className="font-mono text-lg font-extrabold text-[#146bff]">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <h2 className="text-lg font-bold text-[#071b3d]">
                            {plan.title}
                          </h2>
                          <p className="mt-1 text-sm font-medium leading-6 text-[#5c6f87]">
                            {plan.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {selectedGoals.length > 4 ? (
                  <p className="mt-4 text-sm text-[#65748a]">
                    Plus {selectedGoals.length - 4} more goal
                    {selectedGoals.length - 4 === 1 ? "" : "s"} Opryn will keep
                    in view as your workspace grows.
                  </p>
                ) : null}
                <OnboardingActions
                  back={() => setGoalConfirmed(false)}
                  next={() =>
                    void saveStep(
                      "connections",
                      { selectedGoals, businessContext },
                      "goal_selected",
                    )
                  }
                  nextLabel="Continue"
                  busy={busy}
                />
              </div>
            )}
          </>
        ) : null}

        {step === "knowledge" ? (
          <>
            <StepHeading
              eyebrow="Opryn Learn"
              title="How should Opryn learn your business?"
              description="You don't need to write everything down. Start with the tools and information you already use."
            />
            <LearningSourceSelector
              options={learningSources}
              selected={locations}
              onToggle={(value) => setLocations(toggle(locations, value))}
              onOpenAi={(provider) => {
                if (!locations.includes(provider))
                  setLocations((current) => [...current, provider]);
                setGuideMode("connect");
                setGuide(provider);
              }}
            />
            <ErrorMessage message={error} />
            <OnboardingActions
              next={() => void saveLearningSources()}
              nextLabel="Continue"
              skip={() =>
                void saveStep(
                  "goals",
                  { knowledgeLocations: [] },
                  "step_skipped",
                )
              }
              busy={busy}
            />
          </>
        ) : null}

        {step === "tools" ? (
          <>
            {toolSubstep === "business" ? (
              <>
                <StepHeading
                  eyebrow="Your current tools"
                  title="What software does your business already use?"
                  description="Choose what is already part of the work. Opryn will only offer connections that are ready to authorize."
                />
                <ToolList
                  tools={BUSINESS_TOOLS}
                  selected={tools}
                  onToggle={(value) => setTools(toggle(tools, value))}
                />
                <OnboardingActions
                  back={() => setStep("knowledge")}
                  next={() => setToolSubstep("ai")}
                  skip={() => setToolSubstep("ai")}
                />
              </>
            ) : (
              <>
                <StepHeading
                  eyebrow="AI tools"
                  title="What AI tools do you already use?"
                  description="Opryn can eventually give those tools the same approved knowledge your team uses."
                />
                <SelectionList
                  options={aiTools}
                  selected={selectedAi}
                  onToggle={(value) =>
                    setSelectedAi(
                      value === "none"
                        ? ["none"]
                        : toggle(
                            selectedAi.filter((item) => item !== "none"),
                            value,
                          ),
                    )
                  }
                  compact
                />
                <ErrorMessage message={error} />
                <OnboardingActions
                  back={() => setToolSubstep("business")}
                  next={() =>
                    void saveStep(
                      "connections",
                      { selectedTools: tools, selectedAiTools: selectedAi },
                      "integration_selected",
                    )
                  }
                  skip={() =>
                    void saveStep(
                      "connections",
                      { selectedTools: tools, selectedAiTools: [] },
                      "step_skipped",
                    )
                  }
                  busy={busy}
                />
              </>
            )}
          </>
        ) : null}

        {step === "connections" ? (
          <>
            <StepHeading
              eyebrow="Recommended for you"
              title={
                recommended.length
                  ? "Connect the sources that are useful now."
                  : "No account connection is required."
              }
              description="Selected conversations, documents, and explanations can be added without connecting an entire account."
            />
            {connectionChoices.length ? (
              <div className="mt-8 divide-y divide-[#e0e7f0] overflow-hidden rounded-[22px] border border-[#e0e7f0] bg-white px-5 sm:px-6">
                {connectionChoices.map((provider) => {
                  const isAvailable = isProviderAvailable(
                    provider,
                    initialState?.availability,
                  );
                  return (
                    <ConnectionRow
                      key={provider.id}
                      provider={provider}
                      connected={connected[provider.id]}
                      available={isAvailable}
                      skipped={skippedConnections.includes(provider.id)}
                      plan={initialState?.plan ?? "core"}
                      onGuide={() => {
                        if (
                          provider.id === "chatgpt" ||
                          provider.id === "claude"
                        ) {
                          setGuideMode("connect");
                          setGuide(provider.id);
                        }
                      }}
                      onSkip={() =>
                        setSkippedConnections((current) =>
                          Array.from(new Set([...current, provider.id])),
                        )
                      }
                      onConnected={() =>
                        setConnected((current) => ({
                          ...current,
                          [provider.id]: true,
                        }))
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <div className="mt-8 rounded-[20px] border border-[#d6e1ef] bg-[#f4f8fd] p-6">
                <p className="font-semibold text-[#17345f]">
                  Start with an explanation or upload.
                </p>
                <p className="mt-2 text-sm leading-6 text-[#65748a]">
                  Opryn can learn its first useful answer without access to any
                  outside account.
                </p>
              </div>
            )}
            <ErrorMessage message={error} />
            <OnboardingActions
              back={() => {
                setGoalConfirmed(true);
                setStep("goals");
              }}
              next={() =>
                void saveStep(
                  "setup",
                  { skippedConnections },
                  connectedCount(connected)
                    ? "integration_connected"
                    : undefined,
                )
              }
              skip={() =>
                void saveStep(
                  "setup",
                  { skippedConnections: recommended },
                  "step_skipped",
                )
              }
              busy={busy}
            />
          </>
        ) : null}

        {(step === "setup" || step === "teach") &&
        !manualTeaching &&
        organization ? (
          <>
            <SourceFirstLearning
              organizationId={organization.id}
              name={organization.name}
              connected={connected}
              onTestComplete={() => setStep("invite")}
              onExplain={() => {
                setManualTeaching(true);
                void saveStep("teach", {}, undefined);
              }}
              onConnect={(provider) => {
                setGuideMode("connect");
                setGuide(provider);
              }}
            />
            <button
              type="button"
              className="mt-8 min-h-12 text-sm font-semibold text-[#52627a]"
              onClick={() => setStep("connections")}
            >
              ← Back to connections
            </button>
          </>
        ) : null}

        {step === "teach" && manualTeaching ? (
          <>
            <StepHeading
              eyebrow="Your first approved answer"
              title="What should Opryn know?"
              description="One real answer is enough to make Opryn useful. It will ask for clarification only when something important is missing."
            />
            {busy ? (
              <div className="mt-8">
                <OprynLearningFlow
                  sources={
                    selectedSourceLabels.length
                      ? selectedSourceLabels
                      : ["Owner explanation"]
                  }
                  active
                  detail="Opryn is reading your answer, looking for the important rule and any missing limit or exception."
                />
              </div>
            ) : !suggestion ? (
              <div className="mt-8 space-y-6">
                <Field
                  label="What question do you answer repeatedly?"
                  value={firstQuestion}
                  onChange={setFirstQuestion}
                  placeholder="When can someone receive a refund?"
                />
                <label className="block text-sm font-semibold">
                  What&apos;s the answer?
                  <textarea
                    value={firstAnswer}
                    onChange={(event) => setFirstAnswer(event.target.value)}
                    rows={5}
                    className="onboarding-input mt-2 min-h-32 resize-y"
                    placeholder="Managers can approve refunds up to $500. Anything above that needs me."
                  />
                </label>
                <DictationButton
                  onText={(text) =>
                    setFirstAnswer(
                      (current) => `${current}${current ? " " : ""}${text}`,
                    )
                  }
                />
              </div>
            ) : suggestion.clarificationQuestions.length ? (
              <div className="mt-8 rounded-[22px] border border-[#cfe0f7] bg-[#f1f6fe] p-5 shadow-[0_12px_30px_rgba(40,91,155,.06)] sm:p-6">
                <p className="text-xs font-semibold text-[#146bff]">
                  One useful clarification
                </p>
                <h2 className="mt-3 text-xl font-semibold tracking-[-.03em]">
                  {suggestion.clarificationQuestions[0]}
                </h2>
                <input
                  value={clarificationAnswer}
                  onChange={(event) =>
                    setClarificationAnswer(event.target.value)
                  }
                  className="onboarding-input mt-5 bg-white"
                  placeholder="Add the missing limit or exception"
                />
              </div>
            ) : (
              <div className="knowledge-approval-card mt-8 rounded-[22px] border border-[#cfe0f7] bg-[#f7faff] p-6 shadow-[0_12px_30px_rgba(40,91,155,.06)]">
                <p className="text-xs font-semibold text-[#146bff]">
                  Opryn learned
                </p>
                <input
                  value={suggestion.title}
                  onChange={(event) =>
                    setSuggestion({ ...suggestion, title: event.target.value })
                  }
                  className="mt-3 w-full border-0 bg-transparent p-0 text-2xl font-semibold tracking-[-.04em] outline-none"
                  aria-label="Knowledge title"
                />
                <textarea
                  value={suggestion.rule}
                  onChange={(event) =>
                    setSuggestion({ ...suggestion, rule: event.target.value })
                  }
                  rows={4}
                  className="mt-4 w-full resize-y border-0 bg-transparent p-0 text-base leading-7 text-[#42526a] outline-none"
                  aria-label="Approved company answer"
                />
                <p className="mt-4 text-xs text-[#728099]">
                  Nothing becomes company knowledge until you approve it.
                </p>
              </div>
            )}
            <ErrorMessage message={error} />
            <OnboardingActions
              back={() => {
                if (suggestion) setSuggestion(null);
                else {
                  setManualTeaching(false);
                  setStep("setup");
                }
              }}
              next={() =>
                suggestion?.clarificationQuestions.length
                  ? void analyzeKnowledge(true)
                  : suggestion
                    ? void approveKnowledge()
                    : void analyzeKnowledge()
              }
              nextLabel={
                suggestion?.clarificationQuestions.length
                  ? "Update Answer"
                  : suggestion
                    ? "Approve"
                    : "Let Opryn Review It"
              }
              busy={busy}
            />
          </>
        ) : null}

        {step === "test" ? (
          <>
            <StepHeading
              eyebrow="See the value"
              title="Try asking Opryn as an employee."
              description="This checks the approved answer you just taught—not generic information."
            />
            <div className="mt-8 rounded-[22px] border border-[#d5e3f4] bg-[#eef5ff] p-5 shadow-[0_14px_36px_rgba(40,91,155,.07)] sm:p-7">
              <label className="text-xs font-extrabold uppercase tracking-[.08em] text-[#496784]">
                Employee question
                <textarea
                  value={testQuestion}
                  onChange={(event) => setTestQuestion(event.target.value)}
                  rows={3}
                  className="mt-3 w-full resize-none rounded-2xl border border-[#c7d7ea] bg-white p-4 text-base text-[#071b3d] outline-none transition focus:border-[#5793f5] focus:ring-4 focus:ring-[#146bff]/10"
                />
              </label>
              {testResult ? (
                <div className="mt-5 rounded-2xl border border-[#cfe0f7] bg-white p-5 shadow-[0_10px_28px_rgba(40,91,155,.06)]">
                  <p className="text-sm font-extrabold text-[#146bff]">
                    {testResult.headline}
                  </p>
                  <p className="mt-2 text-lg leading-7">{testResult.answer}</p>
                  <p className="mt-4 text-xs font-semibold text-[#60728a]">
                    Source · {testResult.source}
                  </p>
                </div>
              ) : null}
            </div>
            {testResult ? (
              <div className="mt-6 rounded-2xl bg-[#eaf3ff] px-5 py-5">
                <h2 className="text-2xl font-semibold tracking-[-.04em]">
                  That&apos;s one question your team won&apos;t need to ask you
                  next time.
                </h2>
              </div>
            ) : null}
            <ErrorMessage message={error} />
            <OnboardingActions
              back={() => setStep("teach")}
              next={() => (testResult ? setStep("invite") : void runTest())}
              nextLabel={testResult ? "Continue" : "Ask Opryn"}
              busy={busy}
            />
          </>
        ) : null}

        {step === "invite" ? (
          <>
            <StepHeading
              eyebrow="Bring in your team"
              title="Ready to let your team use it?"
              description="Your team can ask Opryn instead of tracking you down for repeat questions."
            />
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {locations.includes("slack") ? (
                <Link
                  href="/app/integrations/slack"
                  className="rounded-[16px] border border-[#d6e1ef] bg-[#f7faff] p-4 text-sm font-semibold text-[#17345f] hover:border-[#9bb7dc]"
                >
                  Connect Slack
                  <span className="mt-1 block text-xs font-normal leading-5 text-[#718095]">
                    Let teammates ask Opryn where they already talk.
                  </span>
                </Link>
              ) : null}
              {locations.includes("teams") ? (
                <Link
                  href="/app/integrations/teams"
                  className="rounded-[16px] border border-[#d6e1ef] bg-[#f7faff] p-4 text-sm font-semibold text-[#17345f] hover:border-[#9bb7dc]"
                >
                  Connect Microsoft Teams
                  <span className="mt-1 block text-xs font-normal leading-5 text-[#718095]">
                    Make the same approved answer available in Teams.
                  </span>
                </Link>
              ) : null}
              {selectedAi.some(
                (tool) => tool === "chatgpt" || tool === "claude",
              ) ? (
                <Link
                  href="/app/integrations?filter=ai"
                  className="rounded-[16px] border border-[#d6e1ef] bg-[#f7faff] p-4 text-sm font-semibold text-[#17345f] hover:border-[#9bb7dc]"
                >
                  Give your AI tools Opryn access
                  <span className="mt-1 block text-xs font-normal leading-5 text-[#718095]">
                    ChatGPT and Claude use the same approved Opryn knowledge.
                  </span>
                </Link>
              ) : null}
            </div>
            <label className="mt-8 block text-sm font-semibold">
              Work emails
              <textarea
                value={inviteEmails}
                onChange={(event) => setInviteEmails(event.target.value)}
                rows={4}
                className="onboarding-input mt-2 resize-y"
                placeholder={"sarah@company.com\nalex@company.com"}
              />
            </label>
            <p className="mt-3 text-xs leading-5 text-[#728099]">
              One email per line. Each person receives a secure Opryn invitation
              and access code.
            </p>
            <ErrorMessage message={error} />
            <OnboardingActions
              back={() => setStep("test")}
              next={() => void inviteTeam()}
              nextLabel="Invite Team"
              skip={() => void finishOnboarding(false)}
              busy={busy}
            />
          </>
        ) : null}

        {step === "complete" ? (
          <div className="-m-5 border-t-[6px] border-[#2782ff] bg-[#eef5ff] px-6 py-12 sm:-m-10 sm:px-10 sm:py-16 lg:-m-14 lg:px-14 lg:py-20">
            <div className="setup-completion-mark mb-8" aria-hidden="true">
              <Check size={26} strokeWidth={3} />
            </div>
            <p className="text-sm font-extrabold uppercase tracking-[.13em] text-[#146bff]">
              Setup complete
            </p>
            <h1 className="mt-4 text-5xl font-extrabold tracking-[-.065em] text-[#071b3d] sm:text-7xl">
              You&apos;re ready.
            </h1>
            <p className="mt-6 max-w-xl text-lg font-medium leading-8 text-[#53657d]">
              You have a real approved answer, a working Ask Opryn result, and a
              starting plan built around {organization?.name ?? business.name}.
            </p>
            <dl className="mt-10 grid gap-3 sm:grid-cols-3">
              <SummaryMetric value="1" label="approved answer" />
              <SummaryMetric
                value={String(connectedCount(connected))}
                label="connected sources"
              />
              <SummaryMetric value={String(inviteCount)} label="team invites" />
            </dl>
            <div className="mt-8 rounded-2xl border border-[#cfe0f7] bg-white px-5 py-5">
              <p className="text-xs font-extrabold uppercase tracking-[.12em] text-[#146bff]">
                Next best step
              </p>
              <h2 className="mt-2 text-xl font-bold text-[#071b3d]">
                Teach Opryn your first exception or approval limit.
              </h2>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/app"
                className="inline-flex min-h-12 items-center rounded-xl bg-[#1975ff] px-6 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(20,107,255,.18)] transition hover:-translate-y-0.5 hover:bg-[#2f83ff] motion-reduce:transform-none"
              >
                Go to Opryn
              </Link>
              <Link
                href="/app/processes/new"
                className="inline-flex min-h-12 items-center rounded-xl border border-[#bfd0e5] bg-white px-5 text-sm font-bold text-[#17345f] transition hover:border-[#75a9ef] hover:bg-[#f8fbff]"
              >
                Teach One More Thing
              </Link>
            </div>
          </div>
        ) : null}
      </OnboardingTransition>

      {guide ? (
        <ConnectionGuide
          provider={guide}
          connected={connected[guide]}
          organizationName={organization?.name ?? business.name}
          initialMode={guideMode}
          onConnected={() =>
            setConnected((current) => ({ ...current, [guide]: true }))
          }
          onImported={() => {
            if (!locations.includes(guide))
              setLocations((current) => [...current, guide]);
          }}
          onClose={() => setGuide(null)}
        />
      ) : null}
      {assistantOpen ? (
        <SetupAssistant
          goals={selectedGoals}
          locations={locations}
          tools={tools}
          onClose={() => setAssistantOpen(false)}
        />
      ) : null}
    </OnboardingShell>
  );
}

function StepHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header>
      <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#146bff]">
        {eyebrow}
      </p>
      <h1 className="mt-3 max-w-[700px] text-4xl font-extrabold leading-[1.04] tracking-[-.055em] sm:text-[3.25rem]">
        {title}
      </h1>
      <p className="mt-4 max-w-[620px] text-base font-medium leading-7 text-[#5f6f86]">
        {description}
      </p>
    </header>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={`block text-sm font-semibold ${className}`}>
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="onboarding-input mt-2"
      />
    </label>
  );
}

function IndustrySelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<
    { name: string; reason: string }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const matches = searchBusinessTypes(query);

  async function askOpryn() {
    if (query.trim().length < 3) {
      setSearchError("Describe what the business does in a few words first.");
      return;
    }
    setSearching(true);
    setSearchError("");
    const response = await fetch("/api/onboarding/industry-search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const body = await response.json().catch(() => ({}));
    setSearching(false);
    if (!response.ok) {
      setSearchError(body.error || "Opryn couldn't match that description.");
      return;
    }
    setSuggestions(body.suggestions ?? []);
    if (!body.suggestions?.length)
      setSearchError(
        "No close match yet. You can use your own description below.",
      );
  }

  return (
    <fieldset>
      <legend className="text-sm font-bold text-[#17345f]">
        What kind of business is it?
      </legend>
      <p className="mt-1 text-sm text-[#728099]">
        Choose the closest match, or type your own.
      </p>
      {value ? (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-[#eaf2ff] px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-[#728099]">
              Selected
            </p>
            <p className="mt-1 text-sm font-semibold text-[#071b3d]">{value}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange("")}
            className="min-h-10 text-xs font-semibold text-[#146bff]"
          >
            Change
          </button>
        </div>
      ) : null}
      <div className="mt-4 rounded-2xl border border-[#cfd9e7] bg-white p-2 focus-within:border-[#146bff] focus-within:ring-4 focus-within:ring-[#146bff]/10">
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSuggestions([]);
            setSearchError("");
          }}
          className="min-h-11 w-full border-0 bg-transparent px-3 text-sm outline-none"
          placeholder="Search, or describe what your business does"
          aria-label="Search business types"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e6eaf0] px-2 pt-2">
          <p className="text-xs text-[#728099]">
            Try “we install cameras for homes” or “I build mobile apps.”
          </p>
          <button
            type="button"
            onClick={() => void askOpryn()}
            disabled={searching || query.trim().length < 3}
            className="min-h-10 rounded-xl bg-[#146bff] px-4 text-xs font-semibold text-white transition hover:bg-[#095de5] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {searching ? "Finding a match…" : "Help me match it"}
          </button>
        </div>
      </div>
      {searchError ? (
        <p role="status" className="mt-3 text-sm text-[#9b3540]">
          {searchError}
        </p>
      ) : null}
      {suggestions.length ? (
        <div className="mt-5 border-y border-[#dfe5ed]">
          <p className="py-3 text-[11px] font-semibold uppercase tracking-[.1em] text-[#146bff]">
            Opryn’s closest matches
          </p>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.name}
              type="button"
              onClick={() => onChange(suggestion.name)}
              className="block w-full rounded-xl border-t border-[#e6eaf0] px-3 py-4 text-left transition hover:bg-[#f2f6fc]"
            >
              <span className="font-semibold text-[#071b3d]">
                {suggestion.name}
              </span>
              <span className="mt-1 block text-sm leading-5 text-[#65748a]">
                {suggestion.reason}
              </span>
            </button>
          ))}
        </div>
      ) : query ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {matches.map((industry) => (
            <IndustryChoice
              key={industry}
              industry={industry}
              selected={value === industry}
              onSelect={onChange}
            />
          ))}
          <button
            type="button"
            onClick={() => onChange(query.trim())}
            className="min-h-10 rounded-full border border-dashed border-[#9fb2cc] px-4 text-xs font-semibold text-[#52627a]"
          >
            Use “{query.trim()}”
          </button>
        </div>
      ) : (
        <>
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[.1em] text-[#728099]">
            Popular choices
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {POPULAR_BUSINESS_TYPES.map((industry) => (
              <IndustryChoice
                key={industry}
                industry={industry}
                selected={value === industry}
                onSelect={onChange}
              />
            ))}
          </div>
        </>
      )}
      <details className="mt-5 rounded-2xl bg-[#f4f6f9] px-5 py-4">
        <summary className="cursor-pointer text-sm font-semibold text-[#146bff] marker:text-[#9aabc1]">
          Browse all business types
        </summary>
        <div className="mt-5 grid gap-6 md:grid-cols-3">
          {BUSINESS_TYPE_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-[#728099]">
                {group.label}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {group.options.map((industry) => (
                  <IndustryChoice
                    key={industry}
                    industry={industry}
                    selected={value === industry}
                    onSelect={onChange}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </details>
    </fieldset>
  );
}

function IndustryChoice({
  industry,
  selected,
  onSelect,
}: {
  industry: string;
  selected: boolean;
  onSelect: (industry: string) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(industry)}
      className={`min-h-10 rounded-full border px-4 text-left text-xs font-semibold transition duration-200 ease-[cubic-bezier(.22,1,.36,1)] hover:-translate-y-0.5 hover:shadow-sm active:scale-[.99] motion-reduce:transform-none ${
        selected
          ? "border-[#8db9ff] bg-[#dceaff]/70 text-[#0a3c82] shadow-[0_6px_18px_rgba(20,107,255,.08)]"
          : "border-[#d6dee9] bg-white text-[#52627a] hover:border-[#9cb6dc]"
      }`}
    >
      {industry}
    </button>
  );
}

function ChoiceButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-11 rounded-full border px-5 text-sm font-bold transition duration-200 ease-[cubic-bezier(.22,1,.36,1)] hover:-translate-y-0.5 hover:shadow-sm active:scale-[.99] motion-reduce:transform-none ${selected ? "border-[#8db9ff] bg-[#dceaff]/70 text-[#0a3c82] shadow-[0_6px_18px_rgba(20,107,255,.08)]" : "border-[#d6dee9] bg-white text-[#52627a] hover:border-[#7ea7e0] hover:text-[#123665]"}`}
    >
      {children}
    </button>
  );
}

function SelectionList({
  options,
  selected,
  onToggle,
  compact = false,
}: {
  options: readonly (readonly [string, string, string?, string?])[];
  selected: string[];
  onToggle: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`mt-8 overflow-hidden rounded-[20px] border border-[#dfe5ed] ${compact ? "grid gap-px bg-[#dfe5ed] sm:grid-cols-2" : "divide-y divide-[#dfe5ed]"}`}
    >
      {options.map(([value, title, description, badge]) => {
        const active = selected.includes(value);
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(value)}
            className={`group flex min-h-[76px] w-full items-center gap-4 px-5 py-4 text-left transition duration-200 ease-[cubic-bezier(.22,1,.36,1)] hover:relative hover:z-[1] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(40,91,155,.08)] active:scale-[.99] motion-reduce:transform-none ${active ? "bg-[#dceaff]/65 text-[#071b3d]" : "bg-white hover:bg-[#edf4ff]"} ${compact ? "sm:px-5" : ""}`}
          >
            <span
              className={`grid size-5 shrink-0 place-items-center rounded-full border ${active ? "border-[#6da8ff] bg-[#146bff]/80 text-white" : "border-[#b8c4d3]"}`}
            >
              {active ? <Check size={12} strokeWidth={3} /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2 font-bold">
                <span className="text-[#071b3d]">{title}</span>
                {badge ? (
                  <span className="text-[10px] font-extrabold uppercase tracking-[.08em] text-[#146bff]">
                    {badge}
                  </span>
                ) : null}
              </span>
              {description ? (
                <span className="mt-1 block text-sm leading-5 text-[#5e6f87]">
                  {description}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function LearningSourceSelector({
  options,
  selected,
  onToggle,
  onOpenAi,
}: {
  options: readonly (readonly [string, string, string, string?])[];
  selected: string[];
  onToggle: (value: string) => void;
  onOpenAi: (provider: "chatgpt" | "claude") => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? options : options.slice(0, 6);
  return (
    <div className="mt-8">
      <div className="grid gap-3 sm:grid-cols-2">
        {visible.map(([value, title, description, badge]) => {
          const active = selected.includes(value);
          const aiConversation = value === "chatgpt" || value === "claude";
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() =>
                aiConversation
                  ? onOpenAi(value as "chatgpt" | "claude")
                  : onToggle(value)
              }
              className={`group flex min-h-[118px] items-start gap-4 rounded-[18px] border p-5 text-left transition duration-200 ease-[cubic-bezier(.22,1,.36,1)] hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(40,91,155,.09)] active:scale-[.99] motion-reduce:transform-none ${active ? "border-[#83afea] bg-[#e7f0fc]" : "border-[#d8e0e9] bg-white hover:border-[#a9bfdb]"}`}
            >
              <ToolLogo id={value} name={title} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <strong className="text-base text-[#17345f]">{title}</strong>
                  {badge ? (
                    <span className="text-[10px] font-bold tracking-[.06em] text-[#5d6e84]">
                      {badge}
                    </span>
                  ) : null}
                </span>
                <span className="mt-1.5 block text-sm leading-5 text-[#65748a]">
                  {description}
                </span>
              </span>
              {aiConversation && !active ? (
                <span className="shrink-0 text-xs font-extrabold text-[#146bff]">
                  Add
                </span>
              ) : (
                <span
                  className={`grid size-5 shrink-0 place-items-center rounded-full border ${active ? "border-[#5793e3] bg-[#245fc9] text-white" : "border-[#bdc8d5]"}`}
                >
                  {active ? <Check size={12} strokeWidth={3} /> : null}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {options.length > 6 ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-4 min-h-11 rounded-[10px] border border-[#cbd7e5] bg-white px-4 text-sm font-semibold text-[#53657d] hover:border-[#8eadd2] hover:bg-[#f7faff]"
        >
          {expanded ? "Show Fewer Sources" : "See More Sources"}
        </button>
      ) : null}
      <p className="mt-4 text-xs leading-5 text-[#78869a]">
        Choose ChatGPT or Claude to add a selected conversation or connect Opryn
        for future questions. Opryn never reads your full chat history
        automatically.
      </p>
    </div>
  );
}

function ToolList({
  tools,
  selected,
  onToggle,
}: {
  tools: readonly BusinessTool[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<
    { tool: BusinessTool; reason: string }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const normalized = query.trim().toLowerCase();
  const localMatches = normalized ? searchBusinessTools(query, 16) : [];
  const visibleTools = normalized
    ? aiSuggestions.length
      ? aiSuggestions.map(({ tool }) => tool)
      : localMatches
    : tools.filter(
        ([value]) =>
          POPULAR_BUSINESS_TOOL_IDS.includes(
            value as (typeof POPULAR_BUSINESS_TOOL_IDS)[number],
          ) || selected.includes(value),
      );

  async function askOpryn() {
    if (query.trim().length < 2) {
      setSearchError("Enter a software name or describe what it helps you do.");
      return;
    }
    setSearching(true);
    setSearchError("");
    const response = await fetch("/api/onboarding/tool-search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const body = await response.json().catch(() => ({}));
    setSearching(false);
    if (!response.ok) {
      setSearchError(body.error || "Opryn couldn't search for that tool.");
      return;
    }
    setAiSuggestions(body.suggestions ?? []);
    if (!body.suggestions?.length)
      setSearchError("No close match found. You can still add it by name.");
  }

  return (
    <div className="mt-8">
      <div
        className="flex min-h-12 items-stretch overflow-hidden rounded-2xl border border-[#d4dce7] bg-white transition focus-within:border-[#5793f5] focus-within:ring-4 focus-within:ring-[#146bff]/10"
        role="search"
      >
        <span className="grid w-12 shrink-0 place-items-center border-r border-[#e3e8ef] text-[#6f7e93]">
          <Search size={17} aria-hidden="true" />
        </span>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setAiSuggestions([]);
            setSearchError("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void askOpryn();
            }
          }}
          maxLength={70}
          className="min-w-0 flex-1 border-0 bg-transparent px-3 py-3 text-sm text-[#071b3d] outline-none"
          placeholder="Search GitHub, Slack, Jobber, QuickBooks…"
          aria-label="Search business software"
        />
        <button
          type="button"
          onClick={() => void askOpryn()}
          disabled={searching || query.trim().length < 2}
          className="m-1.5 min-h-9 shrink-0 rounded-xl bg-[#146bff] px-3 text-xs font-semibold text-white transition hover:bg-[#095de5] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {searching ? "Searching…" : "Ask Opryn"}
        </button>
      </div>
      <p className="mt-2 text-xs leading-5 text-[#728099]">
        Search by name, or describe it: “the app we use for job scheduling.”
      </p>
      {searchError ? (
        <p role="status" className="mt-2 text-sm text-[#9b3540]">
          {searchError}
        </p>
      ) : null}
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-[#728099]">
          {aiSuggestions.length
            ? "Opryn’s closest matches"
            : normalized
              ? `${localMatches.length} catalog match${localMatches.length === 1 ? "" : "es"}`
              : "Popular with small businesses"}
        </p>
        {selected.length ? (
          <p className="text-xs font-semibold text-[#146bff]">
            {selected.length} selected
          </p>
        ) : null}
      </div>
      {visibleTools.length ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {visibleTools.map(([value, title, category]) => {
            const aiReason = aiSuggestions.find(
              ({ tool }) => tool[0] === value,
            )?.reason;
            const active = selected.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => onToggle(value)}
                aria-pressed={active}
                className={`flex min-h-[68px] items-center gap-3 rounded-2xl border px-4 text-left transition duration-200 ease-[cubic-bezier(.22,1,.36,1)] hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(40,91,155,.09)] active:scale-[.99] motion-reduce:transform-none ${active ? "border-[#8db9ff] bg-[#dceaff]/65 shadow-[0_6px_18px_rgba(20,107,255,.08)]" : "border-[#d6dee9] bg-white hover:border-[#7ea7e0]"}`}
              >
                <ToolLogo id={value} name={title} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-[#071b3d]">
                    {title}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[#66758b]">
                    {aiReason || category}
                  </span>
                </span>
                {active ? <Check size={15} className="text-[#146bff]" /> : null}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 border border-dashed border-[#cbd5e2] px-4 py-6 text-center">
          <p className="text-sm font-semibold text-[#52627a]">
            That tool isn&apos;t listed yet.
          </p>
          <p className="mt-1 text-xs text-[#7b8799]">
            Ask Opryn to identify it, or add the name exactly as you use it.
          </p>
          <button
            type="button"
            onClick={() => onToggle(`other:${query.trim()}`)}
            className="mt-3 min-h-10 rounded-[7px] border border-[#b9c6d8] px-4 text-xs font-semibold"
          >
            Add “{query.trim()}”
          </button>
        </div>
      )}
      {!normalized ? (
        <p className="mt-4 text-xs leading-5 text-[#7b8799]">
          Search the full catalog for dozens of popular tools. Opryn can also
          identify software that is not listed yet.
        </p>
      ) : null}
      {selected.some((value) => value.startsWith("other:")) ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {selected
            .filter((value) => value.startsWith("other:"))
            .map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onToggle(value)}
                className="min-h-9 rounded-full border border-[#b8c9e0] bg-[#edf4ff] px-3 text-xs font-semibold text-[#0b57c8]"
                aria-label={`Remove ${value.slice(6)}`}
              >
                {value.slice(6)} ×
              </button>
            ))}
        </div>
      ) : null}
    </div>
  );
}

const toolIcons: Record<string, IconType> = {
  slack: FaSlack,
  teams: FaMicrosoft,
  google_chat: SiGooglechat,
  discord: SiDiscord,
  gmail: SiGmail,
  outlook: FaMicrosoft,
  google_workspace: FaGoogle,
  microsoft_365: FaMicrosoft,
  google_drive: SiGoogledrive,
  google_docs: SiGoogledocs,
  notion: SiNotion,
  dropbox: SiDropbox,
  onedrive: FaMicrosoft,
  sharepoint: FaMicrosoft,
  quickbooks: SiQuickbooks,
  hubspot: SiHubspot,
  salesforce: FaSalesforce,
  github: FaGithub,
  gitlab: SiGitlab,
  bitbucket: SiBitbucket,
  jira: SiJira,
  linear: SiLinear,
  asana: SiAsana,
  trello: SiTrello,
  clickup: SiClickup,
  confluence: SiConfluence,
  figma: SiFigma,
  box: SiBox,
  xero: SiXero,
  stripe: SiStripe,
  square: SiSquare,
  shopify: SiShopify,
  zendesk: SiZendesk,
  intercom: SiIntercom,
  mailchimp: SiMailchimp,
  calendly: SiCalendly,
  loom: SiLoom,
  zapier: SiZapier,
  make: SiMake,
  n8n: SiN8N,
  aircall: SiAircall,
  zoom_phone: SiZoom,
  chatgpt: BsOpenai,
  claude: SiClaude,
};

function ToolLogo({ id, name }: { id: string; name: string }) {
  const Icon = toolIcons[id];
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#d9e0e9] bg-white text-lg text-[#17345f] shadow-[0_4px_12px_rgba(40,91,155,.05)]">
      {Icon ? (
        <Icon aria-hidden="true" />
      ) : (
        <span className="text-[11px] font-bold">
          {name.slice(0, 2).toUpperCase()}
        </span>
      )}
    </span>
  );
}

function ConnectionRow({
  provider,
  connected,
  available,
  skipped,
  plan,
  onGuide,
  onSkip,
  onConnected,
}: {
  provider: (typeof CONNECTION_PROVIDERS)[number];
  connected: boolean;
  available: boolean;
  skipped: boolean;
  plan: "core" | "premium";
  onGuide: () => void;
  onSkip: () => void;
  onConnected: () => void;
}) {
  const connectsDuringOnboarding =
    provider.id === "chatgpt" || provider.id === "claude";
  const premiumLocked =
    provider.premium && plan !== "premium" && !connectsDuringOnboarding;
  const returnTo = encodeURIComponent("/onboarding?step=connections");
  const href =
    provider.id === "slack"
      ? `/api/integrations/slack/connect?returnTo=${returnTo}`
      : provider.id === "teams"
        ? `/api/integrations/teams/connect?returnTo=${returnTo}`
        : provider.id === "google_drive"
          ? `/app/integrations?provider=google_drive&returnTo=${encodeURIComponent("/onboarding?step=knowledge")}`
          : provider.id === "twilio"
            ? "/app/integrations/twilio"
            : provider.href;
  const action =
    !premiumLocked && (provider.id === "chatgpt" || provider.id === "claude")
      ? onGuide
      : undefined;
  const credentialGuide = provider.authMode === "credential_guide";
  return (
    <div className="grid gap-4 py-5 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="flex items-start gap-3">
        <ToolLogo id={provider.id} name={provider.name} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{provider.name}</h2>
            <span
              className={`text-[11px] font-semibold ${connected ? "text-[#146bff]" : "text-[#7b8799]"}`}
            >
              {connected
                ? "Connected"
                : skipped
                  ? "Skipped"
                  : premiumLocked
                    ? "Premium"
                    : "Needs setup"}
            </span>
          </div>
          <p className="mt-1 text-sm leading-6 text-[#65748a]">
            {provider.description}
          </p>
          <p className="mt-1 text-xs text-[#8792a3]">{provider.setupTime}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!connected && available && !skipped ? (
          <>
            {credentialGuide && !premiumLocked ? (
              <CredentialConnectionButton
                provider={provider}
                connected={connected}
                onConnected={onConnected}
              />
            ) : action ? (
              <button
                type="button"
                onClick={action}
                className="min-h-10 rounded-xl border border-[#cbd5e2] bg-white px-4 text-xs font-semibold transition hover:-translate-y-0.5 hover:border-[#146bff] hover:shadow-sm motion-reduce:transform-none"
              >
                Connect
              </button>
            ) : (
              <Link
                href={premiumLocked ? "/pricing" : href}
                target={provider.id === "twilio" ? "_blank" : undefined}
                className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-[#cbd5e2] bg-white px-4 text-xs font-semibold transition hover:-translate-y-0.5 hover:border-[#146bff] hover:shadow-sm motion-reduce:transform-none"
              >
                {premiumLocked
                  ? "Explore Premium"
                  : provider.id === "google_drive"
                    ? "Connect"
                    : "Connect"}
                {provider.id === "twilio" ? <ExternalLink size={13} /> : null}
              </Link>
            )}
            <button
              type="button"
              onClick={onSkip}
              className="min-h-10 px-2 text-xs font-semibold text-[#7b8799]"
            >
              Later
            </button>
          </>
        ) : null}
        {connected ? (
          <span className="onboarding-check-in inline-flex items-center gap-1 rounded-full bg-[#e4f1ff] px-3 py-2 text-xs font-bold text-[#0b5ed7]">
            <Check size={14} /> Ready
          </span>
        ) : null}
      </div>
    </div>
  );
}

function DictationButton({ onText }: { onText: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  function start() {
    const Constructor =
      (window as SpeechWindow).SpeechRecognition ??
      (window as SpeechWindow).webkitSpeechRecognition;
    if (!Constructor) {
      setUnsupported(true);
      return;
    }
    const recognition = new Constructor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.onresult = (event) => onText(event.results[0][0].transcript);
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  }
  return (
    <div>
      <button
        type="button"
        onClick={start}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#ccd5e2] bg-white px-4 text-sm font-semibold text-[#52627a] transition hover:-translate-y-0.5 hover:border-[#75a9ef] hover:shadow-sm motion-reduce:transform-none"
      >
        <Mic size={16} /> {listening ? "Listening…" : "Speak instead"}
      </button>
      {unsupported ? (
        <p role="status" className="mt-2 text-xs text-[#7b8799]">
          Voice input isn&apos;t available in this browser. You can type the
          answer instead.
        </p>
      ) : null}
    </div>
  );
}

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};
type SpeechRecognitionConstructor = new () => {
  lang: string;
  interimResults: boolean;
  start: () => void;
  onresult: (event: {
    results: { [key: number]: { [key: number]: { transcript: string } } };
  }) => void;
  onend: () => void;
};

function SetupAssistant({
  goals,
  locations,
  tools,
  onClose,
}: {
  goals: string[];
  locations: string[];
  tools: string[];
  onClose: () => void;
}) {
  const [topic, setTopic] = useState<"connect" | "teach" | null>(null);
  const connection = locations.includes("google_drive")
    ? "Start with Google Drive because that's where you said company knowledge already lives."
    : tools.includes("slack")
      ? "Start with Slack so your team can ask Opryn where they already work."
      : "You can skip connections and teach Opryn one repeated answer first.";
  const teaching = goals.includes("answer_questions")
    ? "Start with the question that interrupts you most often. Pricing limits, refunds, and scheduling exceptions are usually useful."
    : "Start with one decision or task only you know how to handle today.";
  return (
    <div
      className="fixed inset-0 z-[130] flex justify-end bg-[#071b3d]/25"
      role="dialog"
      aria-modal="true"
      aria-label="Opryn setup assistant"
    >
      <div className="mt-auto h-auto max-h-[85vh] w-full overflow-y-auto rounded-t-[28px] bg-[#fafaf7] p-6 shadow-[-20px_0_60px_rgba(7,27,61,.16)] sm:mt-0 sm:h-full sm:max-w-[410px] sm:rounded-l-[28px] sm:rounded-tr-none sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#146bff]">Setup help</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-.04em]">
              What are you unsure about?
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-full hover:bg-[#edf1f6]"
            aria-label="Close setup help"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mt-7 space-y-2">
          <button
            type="button"
            onClick={() => setTopic("connect")}
            className="min-h-12 w-full rounded-xl border border-[#d6dee9] bg-white px-4 text-left text-sm font-semibold transition hover:border-[#8db9ff] hover:bg-[#f6f9ff]"
          >
            What should I connect?
          </button>
          <button
            type="button"
            onClick={() => setTopic("teach")}
            className="min-h-12 w-full rounded-xl border border-[#d6dee9] bg-white px-4 text-left text-sm font-semibold transition hover:border-[#8db9ff] hover:bg-[#f6f9ff]"
          >
            What should I teach first?
          </button>
        </div>
        {topic ? (
          <div className="mt-6 rounded-2xl border border-[#cfe0f7] bg-[#f0f5fd] p-5 text-sm leading-7 text-[#42526a]">
            {topic === "connect" ? connection : teaching}
          </div>
        ) : null}
        <p className="mt-8 text-xs leading-5 text-[#7b8799]">
          Opryn uses only the setup choices you&apos;ve made here. It won&apos;t
          invent company policy.
        </p>
      </div>
    </div>
  );
}

function SummaryMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-[#cfe0f7] bg-white p-5 shadow-[0_8px_22px_rgba(40,91,155,.05)]">
      <dt className="text-4xl font-extrabold tracking-[-.06em] text-[#146bff]">
        {value}
      </dt>
      <dd className="mt-1 text-xs font-bold text-[#60728a]">{label}</dd>
    </div>
  );
}
function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <p
      role="alert"
      className="mt-6 rounded-xl border border-[#f0cfd3] bg-[#fff3f3] px-4 py-3 text-sm font-medium text-[#9b3540]"
    >
      {message}
    </p>
  ) : null;
}
function toggle(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}
function isStep(value: string): value is OnboardingStep {
  return [
    "goals",
    "knowledge",
    "tools",
    "connections",
    "setup",
    "teach",
    "test",
    "invite",
    "complete",
  ].includes(value);
}
function phaseForStep(step: LocalStep) {
  if (step === "welcome" || step === "business") return 0;
  if (step === "knowledge" || step === "tools") return 1;
  if (step === "goals") return 2;
  if (step === "connections" || step === "setup") return 3;
  return 4;
}
function employeeRange(count: number) {
  if (count <= 1) return "just_me";
  if (count <= 5) return "2_5";
  if (count <= 10) return "6_10";
  if (count <= 20) return "11_20";
  if (count <= 50) return "21_50";
  return "50_plus";
}
function employeeCountForRange(range: string) {
  return (
    {
      just_me: 1,
      "2_5": 3,
      "6_10": 8,
      "11_20": 15,
      "21_50": 35,
      "50_plus": 51,
    }[range] ?? 1
  );
}
function connectedCount(connected: Record<ConnectionProviderId, boolean>) {
  return Object.values(connected).filter(Boolean).length;
}

function isProviderAvailable(
  provider: (typeof CONNECTION_PROVIDERS)[number],
  availability:
    | {
        slack: boolean;
        teams: boolean;
      }
    | undefined,
) {
  if (!provider.supported) return false;
  if (provider.id === "slack") return availability?.slack ?? false;
  if (provider.id === "teams") return availability?.teams ?? false;
  return true;
}
