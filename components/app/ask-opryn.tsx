"use client";

import NextImage from "next/image";
import { FormEvent, useRef, useState } from "react";
import {
  ArrowUp,
  ChevronRight,
  CircleAlert,
  ImagePlus,
  LoaderCircle,
  Send,
  TriangleAlert,
  X,
} from "lucide-react";
import { showAppToast } from "@/lib/client-toast";
import { OprynArc } from "@/components/opryn/opryn-arc";
import { OprynSourceChip } from "@/components/opryn/opryn-source-chip";
import { OprynStatus } from "@/components/opryn/opryn-status";
import { AnswerText } from "@/components/app/answer-text";
import { AnswerSources } from "@/components/app/answer-sources";
import { AskIcon, UnknownIcon } from "@/components/opryn-icons/opryn-icons";

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
}: {
  hasKnowledge: boolean;
  prompts: Prompt[];
  initialQuestion: string;
}) {
  const [question, setQuestion] = useState(initialQuestion);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<AttachedImage | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState("");
  const [promptPage, setPromptPage] = useState(0);
  const [conversationId] = useState(() => crypto.randomUUID());
  const inputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pages = Math.max(1, Math.ceil(prompts.length / 4));
  const visiblePrompts = prompts.slice(promptPage * 4, promptPage * 4 + 4);

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
    if (!value || loading || imageBusy) return;
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
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "Opryn could not answer.");
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
    <div
      className={`ask-workspace mx-auto flex max-w-5xl flex-col overflow-hidden rounded-[24px] border border-[var(--opryn-line)] bg-white shadow-[var(--opryn-shadow-sm)] ${messages.length ? "has-messages" : ""}`}
    >
      <div className="flex-1 overflow-y-auto bg-white p-4 sm:p-7">
        {!messages.length ? (
          <div className="ask-empty flex flex-col">
            <span className="grid size-12 place-items-center rounded-xl border border-[#d8e3f4] bg-[var(--opryn-blue-surface)] text-[var(--opryn-blue)]">
              <AskIcon size={22} />
            </span>
            <p className="mt-5 text-[11px] font-semibold tracking-[.07em] text-[var(--opryn-blue)]">
              Your company knowledge
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-.04em] text-[var(--opryn-navy)] sm:text-3xl">
              Start with what Opryn knows.
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-[var(--opryn-muted)]">
              Ask how your company handles something. Opryn gives you the
              approved answer and shows where it came from.
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
                        <button
                          key={index}
                          onClick={() => changePromptPage(index)}
                          aria-label={`Show question set ${index + 1}`}
                          aria-pressed={index === promptPage}
                          className={`grid size-11 place-items-center rounded-xl text-sm ${index === promptPage ? "bg-[var(--opryn-blue-surface)] text-[var(--opryn-blue)]" : "text-[var(--opryn-muted)]"}`}
                        >
                          {index + 1}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="ask-suggestions grid content-start gap-2 sm:grid-cols-2">
                  {visiblePrompts.map((prompt) => (
                    <button
                      key={`${prompt.category}-${prompt.text}`}
                      onClick={() => void ask(undefined, prompt.text)}
                      className="group min-h-[67px] border-b border-[var(--opryn-line)] p-3.5 text-left hover:bg-[var(--opryn-blue-surface)] sm:odd:border-r"
                    >
                      <span className="text-[10px] font-semibold tracking-[.06em] text-[var(--opryn-faint)]">
                        {prompt.category}
                      </span>
                      <span className="mt-1.5 flex items-start justify-between gap-3 text-sm font-medium leading-5 text-[#3f4d63]">
                        {prompt.text}
                        <ChevronRight className="mt-0.5 size-4 shrink-0 text-[#9ba6b5] group-hover:translate-x-0.5 group-hover:text-[var(--opryn-blue)]" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : !hasKnowledge ? (
              <div className="mt-7 rounded-xl border border-[#d9d4e7] bg-[var(--opryn-amber-surface)] p-4 text-sm text-[#645b87]">
                <strong>Opryn needs some company knowledge first.</strong>
                <br />
                Add or accept useful information before employees start asking
                questions.
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mx-auto max-w-4xl space-y-7">
            {messages.map((message) =>
              message.role === "user" ? (
                <div
                  key={message.id}
                  className="ml-auto max-w-[86%] overflow-hidden border-r-2 border-[var(--opryn-blue)] bg-[var(--opryn-blue-surface)] text-sm leading-6 text-[var(--opryn-navy)]"
                >
                  {message.imageUrl ? (
                    <NextImage
                      src={message.imageUrl}
                      alt="Attached case"
                      width={720}
                      height={540}
                      unoptimized
                      className="max-h-72 w-full object-cover"
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
                  {message.text} Your question is still in the input so you can
                  retry.
                </p>
              ) : (
                <AnswerCard
                  key={message.id}
                  message={message}
                  onEscalate={escalate}
                />
              ),
            )}
            {loading ? (
              <div className="opryn-thinking flex items-center gap-3 border-y border-[var(--opryn-line)] bg-[var(--opryn-blue-surface)] p-4 text-sm text-[var(--opryn-muted)]">
                <span className="grid size-9 place-items-center text-[var(--opryn-blue)]">
                  <LoaderCircle className="size-4 animate-spin" />
                </span>
                <div>
                  <p className="font-medium text-[#48566c]">
                    Checking approved company knowledge…
                  </p>
                  <p className="mt-0.5 text-xs">
                    Checking approved processes and rules
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
      <form
        onSubmit={(event) => void ask(event)}
        className="ask-composer border-t border-[var(--opryn-line)] bg-[#fbfcfd] p-3 sm:p-4"
      >
        <div className="mx-auto max-w-4xl rounded-[13px] border border-[#c8d2df] bg-white p-2 shadow-[0_4px_18px_rgba(24,39,75,.04)] focus-within:border-[var(--opryn-blue)] focus-within:ring-4 focus-within:ring-[#146bff]/10">
          {image ? (
            <div className="mb-2 flex items-center gap-3 rounded-lg bg-[#f4f7fb] p-2 pr-3">
              <NextImage
                src={image.dataUrl}
                alt="Image ready to send"
                width={88}
                height={66}
                unoptimized
                className="h-14 w-20 rounded-md object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-[#3f4d63]">
                  {image.name}
                </p>
                <p className="mt-0.5 text-[10px] text-[#7c8797]">
                  Ready for Opryn to review with company knowledge
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setImage(null);
                  if (imageInputRef.current) imageInputRef.current.value = "";
                }}
                aria-label="Remove attached image"
                className="grid size-8 shrink-0 place-items-center rounded-lg text-[#69758a] hover:bg-white hover:text-[#263348]"
              >
                <X className="size-4" />
              </button>
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
            <button
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
            </button>
            <input
              ref={inputRef}
              data-guide="ask.question"
              aria-label="Your company question"
              type="text"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask how your company handles something..."
              className="h-12 min-w-0 flex-1 bg-transparent px-1 text-base outline-none placeholder:text-[#9aa4b2]"
            />
            <button
              disabled={(!question.trim() && !image) || loading || imageBusy}
              aria-label="Ask Opryn"
              className="grid size-10 shrink-0 place-items-center rounded-[8px] bg-[var(--opryn-blue)] text-white hover:bg-[var(--opryn-blue-hover)] disabled:bg-[#c5ccda]"
            >
              <ArrowUp className="size-4" />
            </button>
          </div>
        </div>
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
  );
}

async function prepareQuestionImage(file: File): Promise<AttachedImage> {
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
}: {
  message: Message;
  onEscalate: (id: string) => Promise<void>;
}) {
  const unknown = message.type === "unknown";
  const [showDetails, setShowDetails] = useState(false);
  const [feedback, setFeedback] = useState<"helpful" | "not_right" | null>(
    null,
  );
  const [showReasons, setShowReasons] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);

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
    <div className="max-w-[96%]">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-[var(--opryn-blue)]">
        <span className="relative grid size-7 place-items-center">
          <OprynArc
            size={27}
            progress={unknown ? 55 : 100}
            state={unknown ? "unknown" : "approved"}
          />
        </span>
        {unknown ? "Opryn needs help" : "Opryn answered"}
        {!unknown && message.type === "answer" ? (
          <OprynStatus kind="approved" label="Based on approved knowledge" />
        ) : null}
      </div>
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
                  <p className="text-xs font-semibold text-[#645b87]">
                    Approval needed
                  </p>
                  <p className="mt-1 text-sm leading-5 text-[#74613e]">
                    {message.approvalReason}
                  </p>
                </div>
              ) : null}
              {message.steps?.length || message.importantNote ? (
                <button
                  type="button"
                  onClick={() => setShowDetails((current) => !current)}
                  className="mt-4 text-xs font-semibold text-[#3158d8] hover:underline"
                >
                  {showDetails ? "Hide details" : "Show details"}
                </button>
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
                    <p className="text-xs font-semibold text-[#645b87]">
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
            <button
              disabled={message.sent}
              onClick={() => void onEscalate(message.questionId!)}
              className="opryn-action mt-5 disabled:bg-[#7b8dcc]"
            >
              {message.sent
                ? `Sent to ${message.expertName || "owner"}`
                : `Ask ${message.expertName || "Owner"}`}
              <Send className="size-3.5" />
            </button>
          ) : null}
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
                    <button
                      key={reason}
                      type="button"
                      onClick={() => void submitFeedback("not_right", reason)}
                      className="min-h-9 rounded-lg border border-[#d8dfe8] bg-white px-3 text-xs font-medium text-[#536176] hover:border-[#9aace4]"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-[#718095]">
                <span>Was this useful?</span>
                <button
                  type="button"
                  disabled={feedbackBusy}
                  onClick={() => void submitFeedback("helpful")}
                  className="min-h-11 rounded-lg border border-[#dfe5ed] px-3 font-medium hover:bg-[#f6f8fb]"
                >
                  👍 Helpful
                </button>
                <button
                  type="button"
                  disabled={feedbackBusy}
                  onClick={() => void submitFeedback("not_right", "other")}
                  className="min-h-11 rounded-lg border border-[#dfe5ed] px-3 font-medium hover:bg-[#f6f8fb]"
                >
                  👎 Not Right
                </button>
              </div>
            )}
          </div>
        ) : null}
      </article>
    </div>
  );
}
