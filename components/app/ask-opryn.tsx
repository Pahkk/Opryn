"use client";

import NextImage from "next/image";
import Link from "next/link";
import { MotionButton } from "@/components/motion/motion-button";
import { AnswerWorking, ProductStatus } from "./product-feedback";
import { StaggerList } from "@/components/motion/motion-region";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ChevronRight,
  CircleAlert,
  BookOpen,
  ThumbsUp,
  Flag,
  ImagePlus,
  LoaderCircle,
  Send,
  TriangleAlert,
  X,
} from "lucide-react";
import { showAppToast } from "@/lib/client-toast";
import { OprynArc } from "@/components/opryn/opryn-arc";
import { OprynSourceChip } from "@/components/opryn/opryn-source-chip";
import { AnswerText } from "@/components/app/answer-text";
import { AnswerSources } from "@/components/app/answer-sources";
import { AskVoice } from "@/components/app/ask-voice";
import { ASK_VOICE_ENABLED } from "@/lib/ask-features";
import { motion } from "motion/react";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";
import { AskIcon, UnknownIcon } from "@/components/opryn-icons/opryn-icons";
import ButtonCopy from "@/components/smoothui/button-copy";

type Prompt = { category: string; text: string };
type AttachedImage = {
  dataUrl: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  name: string;
  size: number;
};
type Message = {
  id: string;
  role: "user" | "opryn";
  text: string;
  headline?: string;
  steps?: string[];
  importantNote?: string;
  type?: "answer" | "unknown" | "error";
  questionId?: string;
  canEscalate?: boolean;
  sent?: boolean;
  expertName?: string;
  critical?: boolean;
  requiresApproval?: boolean;
  approvalReason?: string;
  related?: {
    content: string;
    source: { id: string; label: string; href: string | null } | null;
  } | null;
  progress?: { state: string; label: string; humanAnswer?: string };
  imageUrl?: string;
  sources?: Array<{
    id: string;
    label: string;
    href: string | null;
    content: string;
  }>;
};

export function AskOpryn({
  hasKnowledge,
  prompts,
  initialQuestion,
  canTest = false,
  workspaceName = "Your company",
  workspaceLogo = null,
}: {
  hasKnowledge: boolean;
  prompts: Prompt[];
  initialQuestion: string;
  canTest?: boolean;
  workspaceName?: string;
  workspaceLogo?: string | null;
}) {
  const [question, setQuestion] = useState(initialQuestion);
  const [businessContext, setBusinessContext] = useState<
    Record<string, string>
  >({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<AttachedImage | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [imageError, setImageError] = useState("");
  const [promptPage, setPromptPage] = useState(0);
  const [conversationId] = useState(() => crypto.randomUUID());
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const requestBusy = useRef(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const pendingQuestions = messages
    .filter(
      (message) =>
        message.type === "unknown" &&
        message.questionId &&
        !["one_time", "denied", "restricted", "dismissed"].includes(
          message.progress?.state ?? "",
        ),
    )
    .map((message) => message.questionId)
    .slice(-10)
    .join(",");

  useEffect(() => {
    if (!pendingQuestions) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let checking = false;
    async function refresh() {
      if (checking || controller.signal.aborted) return;
      clearTimeout(timer);
      checking = true;
      try {
        if (!document.hidden) {
          for (const id of pendingQuestions.split(",")) {
            const response = await fetch(`/api/questions/${id}/progress`, {
              signal: controller.signal,
              cache: "no-store",
            });
            if (response.status === 404 || response.status === 403) {
              setMessages((current) =>
                current.map((message) =>
                  message.questionId === id
                    ? {
                        ...message,
                        progress: {
                          state: "restricted",
                          label:
                            "This question is no longer available with your current access.",
                        },
                      }
                    : message,
                ),
              );
              continue;
            }
            if (!response.ok)
              throw new Error(
                "Progress is temporarily unavailable. Your question is still saved.",
              );
            const progress = await response.json();
            if (controller.signal.aborted) return;
            setMessages((current) =>
              current.map((message) =>
                message.questionId !== id
                  ? message
                  : progress.state === "approved"
                    ? {
                        ...message,
                        type: "answer",
                        text: progress.answer,
                        headline: "Approved answer now available",
                        sources: progress.sources,
                        progress,
                        related: null,
                      }
                    : { ...message, progress },
              ),
            );
            if (progress.state === "approved")
              setAnnouncement(
                "Approved answer now available in your conversation.",
              );
          }
        }
      } catch (error) {
        if (!controller.signal.aborted)
          setAnnouncement(
            error instanceof Error
              ? error.message
              : "Progress could not be checked.",
          );
      } finally {
        checking = false;
        if (!controller.signal.aborted) timer = setTimeout(refresh, 15000);
      }
    }
    const resume = () => {
      if (!document.hidden) void refresh();
    };
    void refresh();
    document.addEventListener("visibilitychange", resume);
    return () => {
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [pendingQuestions]);
  const pages = Math.max(1, Math.ceil(prompts.length / 4));
  const visiblePrompts = prompts.slice(promptPage * 4, promptPage * 4 + 4);
  const latestAnswer = messages.findLast(
    (message) => message.role === "opryn" && message.type !== "error",
  );
  const latestQuestion = messages.findLast(
    (message) => message.role === "user",
  )?.text;

  function changePromptPage(index: number) {
    setPromptPage(index);
  }

  async function ask(event?: FormEvent, prompt?: string) {
    event?.preventDefault();
    const selectedImage = image;
    const history = messages.slice(-6).map((message) => ({
      role: message.role,
      text: message.text.slice(0, 1200),
    }));
    const value =
      (prompt ?? question).trim() ||
      (selectedImage
        ? "What should I do about what is shown in this image?"
        : "");
    if (!value || requestBusy.current || loading || imageBusy || voiceBusy)
      return;
    requestBusy.current = true;
    setQuestion("");
    setImage(null);
    setImageError("");
    if (imageInputRef.current) imageInputRef.current.value = "";
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "user",
        text: value,
        imageUrl: selectedImage?.dataUrl,
      },
    ]);
    setLoading(true);
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: value,
          image: selectedImage,
          conversationId,
          history,
          scopeContext: Object.fromEntries(
            Object.entries(businessContext)
              .filter(([, v]) => v.trim())
              .map(([k, v]) => [
                k,
                v
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              ]),
          ),
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "Opryn could not answer.");
      setAnnouncement(
        body.type === "answer"
          ? "Approved answer ready."
          : "No approved answer yet.",
      );
      setMessages((current) => [
        ...current,
        body.type === "answer"
          ? {
              id: crypto.randomUUID(),
              role: "opryn",
              headline: body.headline,
              text: body.answer,
              steps: body.steps,
              importantNote: body.importantNote,
              requiresApproval: body.requiresApproval,
              approvalReason: body.approvalReason,
              type: "answer",
              questionId: body.questionId,
              sources: body.sources,
            }
          : {
              id: crypto.randomUUID(),
              role: "opryn",
              text: body.closest
                ? "I found related guidance, but not an approved answer to this situation."
                : "I don't have an approved answer to this situation yet.",
              type: "unknown",
              questionId: body.questionId,
              canEscalate: body.canEscalate,
              sent: Boolean(body.routed),
              expertName: body.expert?.name,
              critical: body.critical,
              related: body.closest
                ? { content: body.closest.content, source: body.closest.source }
                : null,
            },
      ]);
    } catch (caught) {
      setQuestion(value);
      setImage(selectedImage);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "opryn",
          type: "error",
          text:
            caught instanceof Error ? caught.message : "Something went wrong.",
        },
      ]);
    } finally {
      requestBusy.current = false;
      setLoading(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  async function attachImage(file?: File) {
    if (!file) return;
    setImageError("");
    setImageBusy(true);
    try {
      setImage(await prepareQuestionImage(file));
    } catch (caught) {
      setImage(null);
      setImageError(
        caught instanceof Error
          ? caught.message
          : "Opryn couldn't prepare that image.",
      );
    } finally {
      setImageBusy(false);
    }
  }

  async function escalate(id: string) {
    const response = await fetch(`/api/questions/${id}/escalate`, {
      method: "POST",
    });
    if (!response.ok) throw new Error();
    showAppToast(
      "Question sent!",
      "You’ll get an answer here after they respond.",
    );
    setMessages((current) =>
      current.map((message) =>
        message.questionId === id ? { ...message, sent: true } : message,
      ),
    );
  }

  return (
    <div className="ask-console">
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      <div
        className={`ask-workspace mx-auto flex max-w-5xl flex-col overflow-hidden rounded-[24px] border border-[var(--opryn-line)] bg-white shadow-[var(--opryn-shadow-sm)] ${messages.length ? "has-messages" : ""}`}
      >
        <div className="flex-1 overflow-y-auto bg-white p-4 sm:p-7">
          <div className="mb-5 flex items-center gap-3 border-b border-[#DDE5F0] pb-4">
            {workspaceLogo ? (
              <NextImage
                src={workspaceLogo}
                alt=""
                width={40}
                height={40}
                unoptimized
                className="size-10 rounded-xl object-contain"
              />
            ) : (
              <span
                aria-hidden="true"
                className="grid size-10 place-items-center rounded-xl bg-[#EEF1F5] font-semibold text-[#14213D]"
              >
                {workspaceName
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((word) => word[0])
                  .join("")
                  .toUpperCase()}
              </span>
            )}
            <div>
              <p className="text-sm font-semibold text-[#14213D]">
                {workspaceName}
              </p>
              <p className="text-xs text-[#667085]">
                Company knowledge · human-approved guidance
              </p>
            </div>
          </div>
          {!messages.length ? (
            <div className="ask-empty flex flex-col">
              <span className="grid size-12 place-items-center rounded-xl border border-[#d8e3f4] bg-[var(--opryn-blue-surface)] text-[var(--opryn-blue)]">
                <AskIcon size={22} />
              </span>
              <p className="mt-5 text-[11px] font-semibold tracking-[.07em] text-[var(--opryn-blue)]">
                Your company knowledge
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-.04em] text-[var(--opryn-navy)] sm:text-3xl">
                What does your company say?
              </h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-[var(--opryn-muted)]">
                Ask anything about how your company works. Check the source, ask
                a follow-up, or find the right person.
              </p>
              {hasKnowledge && prompts.length ? (
                <div className="mt-8 w-full max-w-3xl">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-left text-xs font-semibold text-[var(--opryn-muted)]">
                      Start with approved knowledge
                    </p>
                    {pages > 1 ? (
                      <div className="flex gap-1" aria-label="Question set">
                        {Array.from({ length: pages }, (_, index) => (
                          <MotionButton
                            key={index}
                            onClick={() => changePromptPage(index)}
                            aria-label={`Show question set ${index + 1}`}
                            aria-pressed={index === promptPage}
                            className={`grid size-11 place-items-center rounded-xl text-sm ${index === promptPage ? "bg-[var(--opryn-blue-surface)] text-[var(--opryn-blue)]" : "text-[var(--opryn-muted)]"}`}
                          >
                            {index + 1}
                          </MotionButton>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="ask-suggestions grid content-start gap-2 sm:grid-cols-2">
                    {visiblePrompts.map((prompt) => (
                      <MotionButton
                        key={`${prompt.category}-${prompt.text}`}
                        onClick={() => void ask(undefined, prompt.text)}
                        className="group min-h-[67px] p-3.5 text-left"
                      >
                        <span className="text-[10px] font-semibold tracking-[.06em] text-[var(--opryn-faint)]">
                          {prompt.category}
                        </span>
                        <span className="mt-1.5 flex items-start justify-between gap-3 text-sm font-medium leading-5 text-[#3f4d63]">
                          {prompt.text}
                          <ChevronRight className="mt-0.5 size-4 shrink-0 text-[#9ba6b5] group-hover:translate-x-0.5 group-hover:text-[var(--opryn-blue)]" />
                        </span>
                      </MotionButton>
                    ))}
                  </div>
                </div>
              ) : !hasKnowledge ? (
                <div className="mt-7 rounded-xl border border-[#d9e7f5] bg-[#eaf4ff] p-4 text-sm text-[#315577]">
                  <strong>Start with one useful company answer.</strong>
                  <br />
                  Teach a process or policy, then approve it for your team.
                  <Link
                    href="/app/processes/new"
                    className="mt-3 flex min-h-11 items-center gap-2 font-semibold text-[#2045ce]"
                  >
                    Teach Opryn <ChevronRight size={15} />
                  </Link>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mx-auto max-w-4xl space-y-7">
              <StaggerList
                className="space-y-7"
                changeKey={messages.map((m) => m.id).join(",")}
              >
                {messages.map((message, messageIndex) => (
                  <div key={message.id}>
                    {message.role === "user" ? (
                      <div
                        key={message.id}
                        className="ask-user-message ml-auto max-w-[86%] overflow-hidden text-sm leading-6 text-[var(--opryn-navy)]"
                      >
                        {message.imageUrl ? (
                          <NextImage
                            src={message.imageUrl}
                            alt="Attached case"
                            width={720}
                            height={540}
                            unoptimized
                            className="max-h-72 w-full object-contain"
                          />
                        ) : null}
                        <p className="px-4 py-3.5">{message.text}</p>
                      </div>
                    ) : message.type === "error" ? (
                      <p
                        key={message.id}
                        role="alert"
                        className="rounded-xl border border-[#eed5d7] bg-[#fff4f4] p-4 text-sm leading-6 text-[#99424b]"
                      >
                        {message.text} Your question is still in the input so
                        you can retry.
                      </p>
                    ) : (
                      <AnswerCard
                        key={message.id}
                        message={message}
                        onEscalate={escalate}
                        canTest={canTest}
                        onFollowUp={() => {
                          setQuestion(
                            message.type === "unknown"
                              ? (messages
                                  .slice(0, messageIndex)
                                  .findLast((item) => item.role === "user")
                                  ?.text ?? "")
                              : "Tell me more about this.",
                          );
                          inputRef.current?.focus();
                        }}
                      />
                    )}
                  </div>
                ))}
              </StaggerList>
              <AnswerWorking working={loading} />
            </div>
          )}
        </div>
        <form
          onSubmit={(event) => void ask(event)}
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes("Files")) {
              event.preventDefault();
              setDragging(true);
            }
          }}
          onDragLeave={(event) => {
            if (
              !event.currentTarget.contains(event.relatedTarget as Node | null)
            )
              setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (!loading && !imageBusy)
              void attachImage(event.dataTransfer.files[0]);
          }}
          className="ask-composer border-t border-[var(--opryn-line)] bg-[#fbfcfd] p-3 sm:p-4"
        >
          {dragging ? (
            <p
              role="status"
              className="mb-3 rounded-xl border-2 border-dashed border-[#2855F9] bg-[#EAF4FF] p-4 text-sm"
            >
              Drop an image here to ask about it. It will not become company
              knowledge.
            </p>
          ) : null}
          <div className="mx-auto max-w-4xl rounded-[13px] border border-[#c8d2df] bg-white p-2 shadow-[0_4px_18px_rgba(24,39,75,.04)] focus-within:border-[var(--opryn-blue)] focus-within:ring-4 focus-within:ring-[#146bff]/10">
            {image ? (
              <div className="mb-2 flex items-center gap-3 rounded-lg bg-[#f4f7fb] p-2 pr-3">
                <NextImage
                  src={image.dataUrl}
                  alt="Image ready to send"
                  width={88}
                  height={66}
                  unoptimized
                  className="h-14 w-20 rounded-md object-contain"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-[#3f4d63]">
                    {image.name}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[#7c8797]">
                    Conversation context only · not approved knowledge
                  </p>
                </div>
                <MotionButton
                  type="button"
                  onClick={() => {
                    setImage(null);
                    if (imageInputRef.current) imageInputRef.current.value = "";
                  }}
                  aria-label="Remove attached image"
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-[#69758a] hover:bg-white hover:text-[#263348]"
                >
                  <X className="size-4" />
                </MotionButton>
              </div>
            ) : null}
            <div className="flex items-end gap-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={(event) => void attachImage(event.target.files?.[0])}
              />
              <MotionButton
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={loading || imageBusy}
                aria-label="Attach a photo"
                title="Attach a photo"
                className="grid size-10 shrink-0 place-items-center rounded-lg text-[#637087] transition hover:bg-[#edf2ff] hover:text-[#3158d8] disabled:opacity-50"
              >
                {imageBusy ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <ImagePlus className="size-4" />
                )}
              </MotionButton>
              <textarea
                ref={inputRef}
                data-guide="ask.question"
                aria-label="Your company question"
                rows={2}
                maxLength={4000}
                value={question}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    void ask();
                  }
                }}
                onPaste={(event) => {
                  const file = Array.from(event.clipboardData.files).find(
                    (item) => item.type.startsWith("image/"),
                  );
                  if (file && !loading && !imageBusy) {
                    event.preventDefault();
                    void attachImage(file);
                  }
                }}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask how your company handles something..."
                className="min-h-12 min-w-0 flex-1 resize-y bg-transparent px-1 py-2 text-base outline-none placeholder:text-[#9aa4b2]"
              />
              {ASK_VOICE_ENABLED ? (
                <AskVoice
                  disabled={loading || imageBusy}
                  onBusy={setVoiceBusy}
                  onText={(text) => {
                    setQuestion((current) =>
                      [current.trim(), text]
                        .filter(Boolean)
                        .join(" ")
                        .slice(0, 4000),
                    );
                    inputRef.current?.focus();
                  }}
                />
              ) : null}
              <MotionButton
                disabled={
                  (!question.trim() && !image) ||
                  loading ||
                  imageBusy ||
                  voiceBusy
                }
                aria-label="Ask Opryn"
                className="grid size-10 shrink-0 place-items-center rounded-[8px] bg-[var(--opryn-blue)] text-white hover:bg-[var(--opryn-blue-hover)] disabled:bg-[#c5ccda]"
              >
                <ArrowUp className="size-4" />
              </MotionButton>
            </div>
          </div>
          <details className="mt-3 text-sm text-[#566279]">
            <summary className="cursor-pointer">
              Optional business context
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {[
                { key: "regions", label: "Region" },
                { key: "locations", label: "Location" },
                { key: "departments", label: "Department" },
                { key: "customerTypes", label: "Customer type" },
                { key: "plans", label: "Customer plan" },
                { key: "products", label: "Product" },
              ].map((field) => (
                <label key={field.key}>
                  {field.label}
                  <input
                    disabled={loading}
                    value={businessContext[field.key] ?? ""}
                    maxLength={2400}
                    onChange={(e) =>
                      setBusinessContext((p) => ({
                        ...p,
                        [field.key]: e.target.value,
                      }))
                    }
                    className="mt-1 min-h-11 w-full rounded-xl border border-[#dfe6f0] bg-white px-3"
                  />
                </label>
              ))}
            </div>
          </details>
          {imageError ? (
            <p
              role="alert"
              className="mx-auto mt-2 max-w-4xl text-xs text-[#a83f49]"
            >
              {imageError}
            </p>
          ) : null}
          <p className="mt-3 text-center text-xs text-[var(--opryn-muted)]">
            Grounded in approved company knowledge.
          </p>
        </form>
      </div>
      <aside className="ask-context" aria-label="Answer context">
        <p className="product-kicker">Company answer console</p>
        <h2>
          {latestAnswer ? "Behind this answer" : "An answer you can trust."}
        </h2>
        <p>
          {latestAnswer?.type === "unknown"
            ? "This question needs human guidance before it can become a company answer."
            : "Opryn answers from approved guidance. The source stays attached, so you can check the rule."}
        </p>
        <div className="ask-context-rule">
          <ProductStatus
            status={
              latestAnswer?.type === "unknown"
                ? "unknown"
                : hasKnowledge
                  ? "approved"
                  : "needs_review"
            }
            label={
              latestAnswer?.type === "unknown"
                ? "No approved answer"
                : hasKnowledge
                  ? "Approved knowledge only"
                  : "Teach first"
            }
          />
        </div>
        {latestAnswer?.sources?.slice(0, 3).map((source) => (
          <div className="ask-context-source" key={source.id}>
            <span>Supporting source</span>
            {source.href ? (
              <Link href={source.href}>
                {source.label}
                <ChevronRight size={14} />
              </Link>
            ) : (
              <p>{source.label}</p>
            )}
          </div>
        ))}
        <div className="ask-context-rule">
          <Link href="/app/processes">
            <BookOpen size={15} />
            Open Knowledge
            <ChevronRight size={14} />
          </Link>
          {latestQuestion && canTest ? (
            <Link href="/app/knowledge/test">
              Test a company answer
              <ChevronRight size={14} />
            </Link>
          ) : (
            <Link href="/app/processes/new">
              Teach something useful
              <ChevronRight size={14} />
            </Link>
          )}
          <p>Unapproved suggestions never become policy without review.</p>
        </div>
      </aside>
    </div>
  );
}

async function prepareQuestionImage(file: File): Promise<AttachedImage> {
  if (!file.size || file.size > 20_000_000)
    throw new Error(
      "Choose an image under 20 MB. Opryn prepares a smaller copy for your question.",
    );
  const allowed = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ]);
  if (!allowed.has(file.type))
    throw new Error("Choose a JPG, PNG, WEBP, or GIF image.");
  const maxBytes = 2_621_440;
  let prepared: Blob = file;
  let mimeType = file.type as AttachedImage["mimeType"];
  let name = file.name;

  if (file.type !== "image/gif") {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser couldn't prepare the image.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    prepared = await canvasBlob(canvas, "image/jpeg", 0.82);
    if (prepared.size > maxBytes)
      prepared = await canvasBlob(canvas, "image/jpeg", 0.68);
    mimeType = "image/jpeg";
    name = `${file.name.replace(/\.[^.]+$/, "") || "case-photo"}.jpg`;
  }
  if (!prepared.size || prepared.size > maxBytes)
    throw new Error("That image is too large. Choose one under 2.5 MB.");
  return {
    dataUrl: await readDataUrl(prepared),
    mimeType,
    name,
    size: prepared.size,
  };
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Opryn couldn't prepare that image.")),
      type,
      quality,
    );
  });
}

function readDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Opryn couldn't read that image."));
    reader.readAsDataURL(blob);
  });
}

function AnswerCard({
  message,
  onEscalate,
  onFollowUp,
  canTest,
}: {
  message: Message;
  onEscalate: (id: string) => Promise<void>;
  onFollowUp: () => void;
  canTest: boolean;
}) {
  const reduced = useProductReducedMotion();
  const unknown = message.type === "unknown";
  const [showDetails, setShowDetails] = useState(false);
  const [feedback, setFeedback] = useState<"helpful" | "not_right" | null>(
    null,
  );
  const [showReasons, setShowReasons] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [escalationError, setEscalationError] = useState("");

  async function copyAnswer() {
    try {
      await navigator.clipboard.writeText(message.text);
      showAppToast(
        "Answer copied.",
        "Source references remain available here.",
      );
    } catch (error) {
      showAppToast(
        "Couldn't copy the answer.",
        "Select the answer text and copy it manually.",
      );
      throw error;
    }
  }
  async function routeQuestion() {
    if (!message.questionId || escalating || message.sent) return;
    setEscalating(true);
    setEscalationError("");
    try {
      await onEscalate(message.questionId);
    } catch {
      setEscalationError("The question wasn't sent. Try again.");
    } finally {
      setEscalating(false);
    }
  }

  async function submitFeedback(
    feedbackType: "helpful" | "not_right",
    reason?: string,
  ) {
    if (!message.questionId || feedbackBusy) return;
    setFeedbackBusy(true);
    setFeedbackError("");
    try {
      const response = await fetch(
        `/api/questions/${message.questionId}/feedback`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ feedbackType, reason }),
        },
      );
      if (!response.ok) throw new Error("Feedback was not saved.");
      setFeedback(feedbackType);
      setShowReasons(false);
      showAppToast(
        feedbackType === "helpful"
          ? "Thanks for the feedback."
          : "Sent for review.",
        feedbackType === "helpful"
          ? "This helps Opryn understand what is useful."
          : "Approved knowledge will not change until an owner or expert checks it.",
      );
    } catch {
      setFeedbackError("Your feedback was not saved. Please try again.");
    } finally {
      setFeedbackBusy(false);
    }
  }
  return (
    <motion.div
      layout={!reduced}
      transition={{ duration: reduced ? 0 : 0.2 }}
      className="answer-card"
    >
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-[var(--opryn-blue)]">
        <span className="relative grid size-7 place-items-center">
          <OprynArc
            size={27}
            progress={unknown ? 55 : 100}
            state={unknown ? "unknown" : "approved"}
          />
        </span>
        {unknown ? "Company guidance" : "Company answer"}
        <ProductStatus
          status={unknown ? "unknown" : "approved"}
          label={unknown ? "No approved answer yet" : "Approved answer"}
        />
      </div>
      {message.progress ? (
        <div className="mb-4 rounded-xl border border-[#DDE5F0] bg-[#F4F8FF] p-4 text-sm text-[#14213D]">
          <p className="font-semibold">{message.progress.label}</p>
          {message.progress.humanAnswer ? (
            <>
              <p className="mt-2 whitespace-pre-wrap">
                {message.progress.humanAnswer}
              </p>
              <p className="mt-2 text-xs text-[#667085]">
                This human answer is not approved reusable company knowledge.
              </p>
            </>
          ) : null}
          {["denied", "needs_recheck", "rechecking", "dismissed"].includes(
            message.progress.state,
          ) ? (
            <button
              type="button"
              onClick={onFollowUp}
              className="mt-2 min-h-11 font-semibold text-[#2855F9] underline"
            >
              Clarify or ask a follow-up
            </button>
          ) : null}
        </div>
      ) : null}
      <article
        className={`overflow-hidden rounded-[22px] border bg-white shadow-[0_6px_24px_rgba(25,52,86,.04)] ${unknown ? "border-[#ded8e9]" : "border-[#dce5f1]"}`}
      >
        <div className="p-5 sm:p-6">
          {unknown ? (
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center text-[#9a681b]">
                {message.critical ? (
                  <TriangleAlert size={20} />
                ) : (
                  <UnknownIcon size={20} />
                )}
              </span>
              <div>
                <h3 className="font-semibold text-[#263348]">
                  {message.critical
                    ? "Owner guidance required."
                    : "Opryn doesn't have an approved answer yet."}
                </h3>
                <p className="mt-1 text-sm leading-6 text-[#6a7484]">
                  {message.critical
                    ? "Opryn won't guess about this important company policy."
                    : message.text}
                </p>
                {message.related ? (
                  <div className="mt-4 border-y border-[#e4e8ee] bg-[var(--opryn-blue-surface)] p-3.5">
                    <p className="text-[10px] font-semibold tracking-[.06em] text-[#758195]">
                      Related information
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#56647a]">
                      {message.related.content}
                    </p>
                    {message.related.source ? (
                      <div className="mt-3">
                        <OprynSourceChip
                          label={message.related.source.label}
                          href={message.related.source.href}
                        />
                      </div>
                    ) : null}
                    <p className="mt-2 text-xs text-[#7b8798]">
                      Opryn can confirm this part, but not the full answer.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              <p className="text-[10px] font-semibold tracking-[.07em] text-[var(--opryn-blue)]">
                Answer
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-[-.025em] text-[var(--opryn-navy)]">
                {message.headline || "Here’s what your company knowledge says"}
              </h3>
              <AnswerText text={message.text} />
              {message.requiresApproval && message.approvalReason ? (
                <div className="mt-4 rounded-xl border border-[#d9d4e7] bg-[var(--opryn-amber-surface)] p-4">
                  <p className="text-xs font-semibold text-[#805c0a]">
                    Approval needed
                  </p>
                  <p className="mt-1 text-sm leading-5 text-[#74613e]">
                    {message.approvalReason}
                  </p>
                </div>
              ) : null}
              {message.steps?.length || message.importantNote ? (
                <MotionButton
                  type="button"
                  onClick={() => setShowDetails((current) => !current)}
                  className="mt-4 text-xs font-semibold text-[#3158d8] hover:underline"
                >
                  {showDetails ? "Hide details" : "Show details"}
                </MotionButton>
              ) : null}
              {showDetails && message.steps?.length ? (
                <div className="mt-5 rounded-xl bg-[#f7f9fc] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[.09em] text-[#758195]">
                    What to do
                  </p>
                  <ol className="mt-3 space-y-3">
                    {message.steps.map((step, index) => (
                      <li
                        key={`${step}-${index}`}
                        className="grid grid-cols-[24px_1fr] gap-2.5 text-sm leading-5 text-[#56647a]"
                      >
                        <span className="grid size-6 place-items-center rounded-lg bg-white text-[10px] font-bold text-[#3158d8] shadow-sm">
                          {index + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
              {showDetails && message.importantNote ? (
                <div className="mt-4 flex gap-3 rounded-xl border border-[#d9d4e7] bg-[var(--opryn-amber-surface)] p-4">
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-[#9a681b]" />
                  <div>
                    <p className="text-xs font-semibold text-[#805c0a]">
                      Important
                    </p>
                    <p className="mt-1 text-sm leading-5 text-[#74613e]">
                      {message.importantNote}
                    </p>
                  </div>
                </div>
              ) : null}
            </>
          )}
          {unknown && message.canEscalate ? (
            <MotionButton
              disabled={message.sent || escalating}
              onClick={() => void routeQuestion()}
              className="opryn-action mt-5 disabled:bg-[#7b8dcc]"
            >
              {message.sent
                ? `Sent to ${message.expertName || "owner"}`
                : escalating
                  ? "Sending…"
                  : `Ask ${message.expertName || "Owner"}`}
              <Send className="size-3.5" />
            </MotionButton>
          ) : null}
          {escalationError ? (
            <p role="alert" className="mt-3 text-sm text-[#a03740]">
              {escalationError}
            </p>
          ) : null}
          {unknown && message.sent ? (
            <p role="status" className="mt-3 text-xs text-[#566279]">
              Routed for human guidance. This is not approved company knowledge
              yet.
            </p>
          ) : null}
          <div className="answer-utilities">
            <ButtonCopy onCopy={copyAnswer} idleLabel="Copy answer" />
            {canTest && !unknown ? (
              <Link href="/app/knowledge/test">
                Test an answer
                <ChevronRight size={14} />
              </Link>
            ) : null}
            <MotionButton type="button" onClick={onFollowUp}>
              Ask a follow-up
              <ChevronRight size={14} />
            </MotionButton>
            {unknown ? (
              <Link href="/app/processes/new">
                Teach an answer
                <ChevronRight size={14} />
              </Link>
            ) : null}
          </div>
        </div>
        {message.sources?.length ? (
          <AnswerSources sources={message.sources} />
        ) : null}
        {!unknown && message.type === "answer" && message.questionId ? (
          <div className="border-t border-[#e1e6ed] px-5 py-3 sm:px-6">
            {feedbackError ? (
              <p role="alert" className="mb-2 text-sm text-[#99424b]">
                {feedbackError}
              </p>
            ) : null}
            {feedback ? (
              <p className="text-xs font-medium text-[#177257]">
                {feedback === "helpful"
                  ? "Marked helpful."
                  : "Sent for review."}
              </p>
            ) : showReasons ? (
              <div>
                <p className="text-xs font-semibold text-[#536176]">
                  What was wrong?
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    ["outdated", "Outdated"],
                    ["wrong_policy", "Wrong policy"],
                    ["missing_information", "Missing information"],
                    ["didnt_answer", "Didn't answer my question"],
                    ["other", "Other"],
                  ].map(([reason, label]) => (
                    <MotionButton
                      key={reason}
                      type="button"
                      onClick={() => void submitFeedback("not_right", reason)}
                      className="min-h-9 rounded-lg border border-[#d8dfe8] bg-white px-3 text-xs font-medium text-[#536176] hover:border-[#9aace4]"
                    >
                      {label}
                    </MotionButton>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-[#718095]">
                <span>Was this useful?</span>
                <MotionButton
                  type="button"
                  disabled={feedbackBusy}
                  onClick={() => void submitFeedback("helpful")}
                  className="min-h-11 rounded-lg border border-[#dfe5ed] px-3 font-medium hover:bg-[#f6f8fb]"
                >
                  <ThumbsUp
                    size={13}
                    className="mr-1.5 inline"
                    aria-hidden="true"
                  />
                  Helpful
                </MotionButton>
                <MotionButton
                  type="button"
                  disabled={feedbackBusy}
                  onClick={() => setShowReasons(true)}
                  className="min-h-11 rounded-lg border border-[#dfe5ed] px-3 font-medium hover:bg-[#f6f8fb]"
                >
                  <Flag
                    size={13}
                    className="mr-1.5 inline"
                    aria-hidden="true"
                  />
                  Not right
                </MotionButton>
              </div>
            )}
          </div>
        ) : null}
      </article>
    </motion.div>
  );
}
