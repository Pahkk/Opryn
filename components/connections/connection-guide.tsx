"use client";
import { DialogSurface } from "@/components/app/dialog-surface";
import { WorkspaceNotice } from "@/components/app/workspace-context";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Check,
  Clipboard,
  ExternalLink,
  FileUp,
  Link2,
  MessageSquareText,
  X,
} from "lucide-react";
import { ProviderLogo } from "@/components/connections/provider-logo";

const MCP_URL = "https://www.opryn.app/api/mcp";

const guides = {
  chatgpt: {
    name: "ChatGPT",
    openLabel: "Connect ChatGPT",
    openUrl: "https://chatgpt.com/#settings/Connectors",
    example: "@Opryn what is our refund policy?",
    connectionDescription:
      "Let ChatGPT check the approved Opryn knowledge this person is allowed to use.",
  },
  claude: {
    name: "Claude",
    openLabel: "Connect Claude",
    openUrl: "https://claude.ai/customize/connectors",
    example: "Use Opryn to check our cancellation policy.",
    connectionDescription:
      "Let Claude check the same approved company knowledge your team uses in Opryn.",
  },
} as const;

type Provider = keyof typeof guides;
type Mode = "connect" | "learn";
type LearningState = {
  id: string;
  name: string;
  status:
    | "received"
    | "processing"
    | "extracting"
    | "organizing"
    | "needs_review"
    | "complete"
    | "failed";
  summary: {
    processes?: number;
    rules?: number;
    faqs?: number;
    clarifications?: number;
  };
  processId?: string | null;
  error?: string | null;
};

export function ConnectionGuide({
  provider,
  connected = false,
  organizationName,
  initialMode = "learn",
  onConnected,
  onImported,
  onClose,
}: {
  provider: Provider;
  connected?: boolean;
  organizationName?: string;
  initialMode?: Mode;
  onConnected?: () => void;
  onImported?: (processId: string) => void;
  onClose: () => void;
}) {
  const guide = guides[provider];
  const fileRef = useRef<HTMLInputElement>(null);
  const onConnectedRef = useRef(onConnected);
  const reportedLearningRef = useRef<string | null>(null);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [copied, setCopied] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);
  const [checking, setChecking] = useState(false);
  const [connectionStarted, setConnectionStarted] = useState(false);
  const [isConnected, setIsConnected] = useState(connected);
  const [learningEnabled, setLearningEnabled] = useState(false);
  const [latestLearning, setLatestLearning] = useState<LearningState | null>(
    null,
  );
  const [title, setTitle] = useState(`${guide.name} conversation`);
  const [conversation, setConversation] = useState("");
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importedProcessId, setImportedProcessId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    onConnectedRef.current = onConnected;
  }, [onConnected]);

  useEffect(() => {
    if (!connectionStarted && !isConnected) return;
    let cancelled = false;
    async function poll() {
      const response = await fetch(
        `/api/onboarding/ai-connections/status?provider=${provider}`,
        { cache: "no-store" },
      ).catch(() => null);
      if (!response?.ok || cancelled) return;
      const body = await response.json().catch(() => ({}));
      if (cancelled) return;
      setIsConnected(Boolean(body.connected));
      setLearningEnabled(Boolean(body.learningEnabled));
      setLatestLearning(body.latestLearning ?? null);
      if (!body.connected) return;
      setChecking(false);
      if (!isConnected) {
        setMessage(`${guide.name} is connected to Opryn.`);
        onConnectedRef.current?.();
      }
    }
    void poll();
    const interval = window.setInterval(() => void poll(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [connectionStarted, guide.name, isConnected, provider]);

  async function copy(value: string, name: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyError(false);
      setCopied(name);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopyError(true);
    }
  }

  async function checkConnection() {
    setChecking(true);
    setMessage("");
    const response = await fetch(
      `/api/onboarding/ai-connections/status?provider=${provider}`,
      { cache: "no-store" },
    );
    const body = await response.json().catch(() => ({}));
    setChecking(false);
    if (!response.ok) {
      setMessage(body.error || "Opryn couldn't check the connection yet.");
      return;
    }
    if (body.connected) {
      setIsConnected(true);
      setLearningEnabled(Boolean(body.learningEnabled));
      setLatestLearning(body.latestLearning ?? null);
      setMessage(`${guide.name} is connected to Opryn.`);
      onConnected?.();
      return;
    }
    setMessage(
      `No ${guide.name} connection yet. Finish the connector setup, then check again.`,
    );
  }

  function openProviderConnection() {
    const width = Math.min(900, window.screen.availWidth);
    const height = Math.min(780, window.screen.availHeight);
    const popup = window.open(
      guide.openUrl,
      `opryn-${provider}-connection`,
      `popup=yes,width=${width},height=${height},left=${Math.max(0, (window.screen.availWidth - width) / 2)},top=${Math.max(0, (window.screen.availHeight - height) / 2)}`,
    );
    if (!popup)
      setMessage(
        `Your browser blocked the ${guide.name} window. Allow popups for Opryn, then try again.`,
      );
    else {
      setConnectionStarted(true);
      setMessage(
        `${guide.name} is open. Sign in there if asked, then add Opryn as a connector.`,
      );
      popup.focus();
    }
  }

  const learnCommand =
    provider === "chatgpt"
      ? `@Opryn /learn ${organizationName || "your business"}`
      : `Use Opryn to learn ${organizationName || "this business"} from this conversation.`;
  const learningComplete =
    latestLearning?.status === "needs_review" ||
    latestLearning?.status === "complete";
  const learningActive = Boolean(
    latestLearning &&
    ["received", "processing", "extracting", "organizing"].includes(
      latestLearning.status,
    ),
  );

  useEffect(() => {
    if (
      !learningComplete ||
      !latestLearning?.processId ||
      reportedLearningRef.current === latestLearning.id
    )
      return;
    reportedLearningRef.current = latestLearning.id;
    onImported?.(latestLearning.processId);
  }, [latestLearning, learningComplete, onImported]);

  async function readConversationFile(file?: File) {
    if (!file) return;
    setMessage("");
    if (file.size > 250_000) {
      setMessage(
        "Choose one conversation under 250 KB. Large account exports should be split into selected conversations first.",
      );
      return;
    }
    const allowed = [".txt", ".md", ".json"];
    if (
      !allowed.some((extension) => file.name.toLowerCase().endsWith(extension))
    ) {
      setMessage("Upload a TXT, Markdown, or JSON conversation file.");
      return;
    }
    const text = await file.text();
    if (!text.trim()) {
      setMessage("That file does not contain a readable conversation.");
      return;
    }
    setConversation(text.slice(0, 100_000));
    setFileName(file.name);
    if (title === `${guide.name} conversation`)
      setTitle(file.name.replace(/\.(txt|md|json)$/i, ""));
  }

  async function importConversation() {
    if (conversation.trim().length < 40) {
      setMessage(
        "Paste enough of the selected conversation for Opryn to understand the business topic.",
      );
      return;
    }
    if (!title.trim()) {
      setMessage("Give this conversation a short name.");
      return;
    }
    setImporting(true);
    setMessage("");
    const response = await fetch("/api/processes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: `Selected ${guide.name} conversation provided during onboarding. Findings require review before they become approved knowledge.`,
        inputType: "text",
        captureMethod: "ai_conversation",
        explanation: conversation.trim(),
      }),
    });
    const body = await response.json().catch(() => ({}));
    setImporting(false);
    if (!response.ok) {
      setMessage(body.error || "Opryn couldn't learn from this conversation.");
      return;
    }
    setImportedProcessId(body.processId);
    setMessage("Opryn found reviewable knowledge in this conversation.");
    onImported?.(body.processId);
  }

  return (
    <DialogSurface
      onClose={onClose}
      busy={importing}
      labelledBy="connection-guide-title"
    >
      <div className="dialog-content w-full rounded-[24px] border border-[var(--opryn-line)] bg-white p-5 shadow-[var(--opryn-shadow-lg)] sm:max-w-[720px] sm:p-8">
        <WorkspaceNotice action="Connecting to" />
        <p className="sr-only" aria-live="polite">
          {copied
            ? `${copied} copied`
            : copyError
              ? "Copy failed. Select and copy the value manually."
              : message}
        </p>

        <div className="flex items-start justify-between gap-5">
          <div className="flex min-w-0 items-start gap-4">
            <ProviderLogo id={provider} name={guide.name} />
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.12em] text-[#146bff]">
                Add a learning source
              </p>
              <h2
                id="connection-guide-title"
                className="mt-1 text-3xl font-extrabold tracking-[-.045em] text-[#071b3d]"
              >
                Add {guide.name} to Opryn
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#65748a]">
                Use Opryn in {guide.name}, bring in a selected conversation, or
                do both. Your full chat history is never read automatically.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-11 shrink-0 place-items-center rounded-full text-[#53657d] transition hover:bg-[#edf2f8]"
            aria-label="Close setup"
          >
            <X size={18} />
          </button>
        </div>

        <div
          className="mt-7 grid grid-cols-2 rounded-[14px] bg-[#edf3fb] p-1.5"
          role="tablist"
        >
          <ModeButton
            active={mode === "learn"}
            onClick={() => {
              setMode("learn");
              setMessage("");
            }}
            icon={<MessageSquareText size={16} />}
          >
            Learn from a chat
          </ModeButton>
          <ModeButton
            active={mode === "connect"}
            onClick={() => {
              setMode("connect");
              setMessage("");
            }}
            icon={<Link2 size={16} />}
          >
            Use Opryn there
          </ModeButton>
        </div>

        {mode === "learn" ? (
          <div className="mt-7">
            {importedProcessId ? (
              <div className="rounded-[18px] border border-[#bed8fb] bg-[#edf5ff] p-6">
                <span className="grid size-10 place-items-center rounded-full bg-[#146bff] text-white">
                  <Check size={19} strokeWidth={3} />
                </span>
                <h3 className="mt-4 text-xl font-bold text-[#071b3d]">
                  Added for review
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#52627a]">
                  Opryn organized what this conversation says about your
                  business. Nothing becomes trusted company knowledge until you
                  approve it.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href={`/app/processes/${importedProcessId}?returnTo=${encodeURIComponent("/onboarding?step=knowledge")}`}
                    className="inline-flex min-h-11 items-center rounded-xl bg-[#146bff] px-4 text-sm font-bold text-white"
                  >
                    Review what Opryn found
                  </Link>
                  <button
                    type="button"
                    onClick={onClose}
                    className="min-h-11 rounded-xl border border-[#c8d4e3] bg-white px-4 text-sm font-bold text-[#17345f]"
                  >
                    Keep setting up
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-5 sm:grid-cols-[1fr_210px]">
                  <label className="block text-sm font-bold text-[#17345f]">
                    Conversation name
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      maxLength={200}
                      className="mt-2 min-h-12 w-full rounded-xl border border-[#cad6e4] bg-white px-4 text-sm outline-none transition focus:border-[#63a0ee] focus:ring-4 focus:ring-[#dbeafe]"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#cad6e4] bg-white px-4 text-sm font-bold text-[#17345f] transition hover:border-[#7eaae0] hover:bg-[#f6f9fd] sm:self-end"
                  >
                    <FileUp size={16} /> {fileName || "Upload chat"}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".txt,.md,.json,text/plain,text/markdown,application/json"
                    className="sr-only"
                    onChange={(event) =>
                      void readConversationFile(event.target.files?.[0])
                    }
                  />
                </div>
                <label className="mt-5 block text-sm font-bold text-[#17345f]">
                  Paste one useful conversation
                  <textarea
                    value={conversation}
                    onChange={(event) =>
                      setConversation(event.target.value.slice(0, 100_000))
                    }
                    rows={9}
                    className="mt-2 min-h-52 w-full resize-y rounded-[16px] border border-[#cad6e4] bg-white p-4 text-sm leading-6 outline-none transition focus:border-[#63a0ee] focus:ring-4 focus:ring-[#dbeafe]"
                    placeholder={`Paste a selected ${guide.name} conversation about a real process, rule, customer question, or decision...`}
                  />
                </label>
                <div className="mt-3 flex items-start justify-between gap-4 text-xs leading-5 text-[#738198]">
                  <p>
                    Only add conversations you are allowed to use. Remove
                    customer details, passwords, payment information, and other
                    sensitive data first.
                  </p>
                  <span className="shrink-0">
                    {conversation.length.toLocaleString()} / 100,000
                  </span>
                </div>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                  <p className="max-w-sm text-xs leading-5 text-[#738198]">
                    Findings start in Needs Review for{" "}
                    {organizationName || "your business"}.
                  </p>
                  <button
                    type="button"
                    onClick={() => void importConversation()}
                    disabled={importing}
                    className="min-h-12 rounded-xl bg-[#146bff] px-5 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(20,107,255,.18)] transition hover:-translate-y-0.5 hover:bg-[#2b7cff] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transform-none"
                  >
                    {importing ? "Opryn is learning…" : "Add to Opryn Learn"}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="mt-7">
            <div className="rounded-[18px] border border-[#dce5ef] bg-white p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold text-[#17345f]">
                    {isConnected
                      ? `${guide.name} is connected`
                      : `Connect Opryn to ${guide.name}`}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-[#65748a]">
                    {guide.connectionDescription}
                  </p>
                </div>
                {isConnected ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#e5f1ff] px-3 py-2 text-xs font-bold text-[#0b5ed7]">
                    <Check size={14} /> Connected
                  </span>
                ) : null}
              </div>

              {!isConnected || !learningEnabled ? (
                <ol className="mt-6 divide-y divide-[#e1e8f0] border-y border-[#e1e8f0]">
                  {(provider === "claude"
                    ? [
                        "Open Claude and sign in there if asked.",
                        "Go to Customize → Connectors → + → Add custom connector.",
                        "Add Opryn using the secure address below.",
                        "Sign into Opryn, choose this business, and approve access.",
                      ]
                    : [
                        "Open ChatGPT and sign in there if asked.",
                        "Open Settings → Apps and add Opryn as a custom app.",
                        "Use the secure Opryn address below.",
                        "Sign into Opryn, choose this business, and approve access.",
                      ]
                  ).map((step, index) => (
                    <li
                      key={step}
                      className="grid grid-cols-[28px_1fr] gap-3 py-3.5 text-sm leading-6"
                    >
                      <span className="font-extrabold text-[#146bff]">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              ) : null}

              {isConnected && !learningEnabled ? (
                <div className="mt-5 rounded-[14px] border border-[#f0d9a4] bg-[#fff8e8] p-4 text-sm leading-6 text-[#745719]">
                  This connection was authorized before conversation learning
                  was added. Reconnect once to enable the new, explicit learning
                  permission.
                </div>
              ) : null}

              <div className="mt-5 rounded-[14px] bg-[#eef4fb] p-4">
                <p className="text-xs font-bold text-[#52627a]">
                  Opryn MCP address
                </p>
                <div className="mt-2 flex overflow-hidden rounded-[10px] border border-[#cad7e7] bg-white">
                  <code className="min-w-0 flex-1 overflow-x-auto p-3 text-xs">
                    {MCP_URL}
                  </code>
                  <button
                    type="button"
                    onClick={() => void copy(MCP_URL, "address")}
                    className="grid size-11 place-items-center border-l border-[#cad7e7] text-[#146bff]"
                    aria-label="Copy Opryn MCP address"
                  >
                    {copied === "address" ? (
                      <Check size={16} />
                    ) : (
                      <Clipboard size={16} />
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={openProviderConnection}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#146bff] px-4 text-sm font-bold text-white"
                >
                  {isConnected && !learningEnabled
                    ? `Reconnect ${guide.name}`
                    : guide.openLabel}{" "}
                  <ExternalLink size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => void checkConnection()}
                  disabled={checking}
                  className="min-h-11 rounded-xl border border-[#cad6e4] bg-white px-4 text-sm font-bold text-[#17345f] disabled:opacity-60"
                >
                  {checking ? "Checking…" : "Check connection"}
                </button>
              </div>
            </div>

            {isConnected && learningEnabled ? (
              <div className="mt-4 overflow-hidden rounded-[18px] border border-[#c9dcf6] bg-[#f2f7ff]">
                <div className="p-5 sm:p-6">
                  <p className="text-xs font-extrabold uppercase tracking-[.1em] text-[#146bff]">
                    Finish setup in {guide.name}
                  </p>
                  <h3 className="mt-2 text-xl font-extrabold tracking-[-.025em] text-[#071b3d]">
                    Learn from this conversation
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#5e6f86]">
                    Use this inside a conversation that contains useful
                    information about your business.
                  </p>
                  {provider === "claude" ? (
                    <p className="mt-3 text-xs font-semibold text-[#5d6e84]">
                      In Claude: Customize → Connectors. Make sure Opryn is
                      enabled for this conversation.
                    </p>
                  ) : null}
                  <div className="mt-4 flex items-center gap-3 rounded-[12px] border border-[#cbd9ed] bg-white p-3">
                    <p className="min-w-0 flex-1 text-sm font-semibold leading-6 text-[#17345f]">
                      {learnCommand}
                    </p>
                    <button
                      type="button"
                      onClick={() => void copy(learnCommand, "learn command")}
                      className="min-h-10 shrink-0 rounded-lg px-3 text-xs font-extrabold text-[#146bff] hover:bg-[#edf5ff]"
                    >
                      {copied === "learn command" ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="mt-4 text-xs leading-5 text-[#6d7d92]">
                    Only when you explicitly ask Opryn to learn, relevant
                    information from that conversation may be sent to your
                    company workspace. Opryn never reads your other chats.
                  </p>
                  <details className="mt-3 text-xs leading-5 text-[#62738a]">
                    <summary className="cursor-pointer font-bold text-[#315f9d]">
                      Learn a process or topic instead
                    </summary>
                    <div className="mt-2 space-y-1 rounded-xl bg-white/70 p-3">
                      <p>
                        <strong>Process:</strong>{" "}
                        {provider === "chatgpt"
                          ? "@Opryn /learn process Client Onboarding"
                          : "Use Opryn to learn the Client Onboarding process from this conversation."}
                      </p>
                      <p>
                        <strong>Topic:</strong>{" "}
                        {provider === "chatgpt"
                          ? "@Opryn /learn topic Refunds"
                          : "Use Opryn to learn about Refunds from this conversation."}
                      </p>
                    </div>
                  </details>
                  <button
                    type="button"
                    onClick={openProviderConnection}
                    className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#146bff] px-4 text-sm font-bold text-white"
                  >
                    Open {guide.name} <ExternalLink size={15} />
                  </button>
                </div>

                {learningActive ? (
                  <div
                    className="border-t border-[#d6e3f4] bg-white/70 p-5"
                    role="status"
                  >
                    <p className="text-sm font-extrabold text-[#17345f]">
                      Opryn is learning from {guide.name}
                    </p>
                    <p className="mt-1 text-sm text-[#63738a]">
                      {latestLearning?.name} · Organizing reviewable findings…
                    </p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#dce8f8]">
                      <span className="opryn-learning-progress block h-full w-2/3 rounded-full bg-[#146bff]" />
                    </div>
                  </div>
                ) : null}

                {learningComplete && latestLearning ? (
                  <div
                    className="border-t border-[#c9dcf6] bg-white p-5"
                    role="status"
                  >
                    <div className="flex items-start gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#146bff] text-white">
                        <Check size={17} strokeWidth={3} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-extrabold text-[#071b3d]">
                          Opryn received {latestLearning.name}.
                        </h4>
                        <p className="mt-1 text-sm leading-6 text-[#63738a]">
                          {formatLearningSummary(latestLearning.summary)}. The
                          important findings are waiting for your review.
                        </p>
                        {latestLearning.processId ? (
                          <Link
                            href={`/app/processes/${latestLearning.processId}`}
                            className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-[#146bff] px-4 text-sm font-bold text-white"
                          >
                            Review what Opryn found
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}

                {latestLearning?.status === "failed" ? (
                  <div className="border-t border-[#f0d4ce] bg-[#fff4f1] p-5 text-sm font-semibold text-[#9a4035]">
                    {latestLearning.error ||
                      "Opryn couldn't organize this conversation. Try again."}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 rounded-[14px] border border-[#dce5ef] bg-[#f6f9fc] p-4">
                <p className="text-xs font-bold text-[#52627a]">
                  Try this after connecting
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <p className="min-w-0 flex-1 text-sm font-medium text-[#17345f]">
                    {guide.example}
                  </p>
                  <button
                    type="button"
                    onClick={() => void copy(guide.example, "example")}
                    className="min-h-10 px-2 text-xs font-bold text-[#146bff]"
                  >
                    {copied === "example" ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {message ? (
          <p
            className={`mt-5 rounded-xl px-4 py-3 text-sm font-semibold ${isConnected || importedProcessId || connectionStarted ? "bg-[#eaf4ff] text-[#0b5ed7]" : "bg-[#fff2ef] text-[#a34539]"}`}
            role="status"
          >
            {message}
          </p>
        ) : null}
        {isConnected && mode === "connect" ? (
          <p className="mt-3 text-sm leading-6 text-[#65748a]">
            You can finish setting up your business now. There is nothing to
            purchase on this step.
          </p>
        ) : null}
      </div>
    </DialogSurface>
  );
}

function ModeButton({
  active,
  icon,
  children,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-3 text-sm font-bold transition ${active ? "bg-white text-[#145fcf] shadow-[0_5px_16px_rgba(40,91,155,.1)]" : "text-[#64748a] hover:text-[#17345f]"}`}
    >
      {icon}
      {children}
    </button>
  );
}

function formatLearningSummary(summary: LearningState["summary"]) {
  const values = [
    summary.processes
      ? `${summary.processes} ${summary.processes === 1 ? "process" : "processes"}`
      : null,
    summary.rules
      ? `${summary.rules} ${summary.rules === 1 ? "rule" : "rules"}`
      : null,
    summary.faqs
      ? `${summary.faqs} common ${summary.faqs === 1 ? "answer" : "answers"}`
      : null,
    summary.clarifications
      ? `${summary.clarifications} ${summary.clarifications === 1 ? "clarification" : "clarifications"}`
      : null,
  ].filter(Boolean);
  return values.length ? values.join(", ") : "Reviewable company context";
}
