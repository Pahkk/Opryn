"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, X } from "lucide-react";
import { MotionButton } from "@/components/motion/motion-button";

/** Microphone artwork is not in the supplied icon set; retain the functional icon. */
export function AskVoice({
  disabled,
  onText,
  onBusy,
}: {
  disabled: boolean;
  onText: (text: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [state, setState] = useState<
    "idle" | "starting" | "listening" | "transcribing"
  >("idle");
  const [notice, setNotice] = useState("");
  const recording = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const locked = useRef(false);
  const discard = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      discard.current = true;
      if (timer.current) clearTimeout(timer.current);
      if (recording.current?.state === "recording") recording.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
      request.current?.abort();
    };
  }, []);
  function stop(cancel = false) {
    discard.current = cancel;
    if (timer.current) clearTimeout(timer.current);
    if (recording.current?.state === "recording") recording.current.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
  }
  async function start() {
    if (locked.current || disabled) return;
    locked.current = true;
    discard.current = false;
    setNotice("");
    setState("starting");
    onBusy(true);
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error(
          "Voice recording is unavailable in this browser. Type your question instead.",
        );
      const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        audio.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = audio;
      const mimeType = ["audio/webm", "audio/mp4", "audio/ogg"].find((mime) =>
        MediaRecorder.isTypeSupported(mime),
      );
      if (!mimeType)
        throw new Error("This browser's recording format is not supported.");
      const recorder = new MediaRecorder(audio, {
        mimeType,
        audioBitsPerSecond: 64000,
      });
      recording.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = async () => {
        if (!mounted.current) return;
        if (discard.current) {
          setState("idle");
          onBusy(false);
          locked.current = false;
          setNotice("Recording discarded.");
          return;
        }
        setState("transcribing");
        setNotice("Transcribing your question…");
        try {
          request.current = new AbortController();
          const response = await fetch("/api/ask/transcribe", {
            method: "POST",
            headers: { "Content-Type": mimeType },
            body: new Blob(chunks, { type: mimeType }),
            signal: request.current.signal,
          });
          const body = await response.json();
          if (!response.ok)
            throw new Error(body.error ?? "Transcription failed.");
          if (mounted.current) {
            onText(body.text);
            setNotice(
              "Transcription ready. Edit your question before sending.",
            );
          }
        } catch (error) {
          if (mounted.current)
            setNotice(
              error instanceof Error ? error.message : "Transcription failed.",
            );
        } finally {
          if (mounted.current) {
            setState("idle");
            onBusy(false);
            locked.current = false;
          }
        }
      };
      recorder.onerror = () => {
        discard.current = true;
        stop(true);
        setNotice("Recording failed. Please type your question.");
      };
      recorder.start();
      setState("listening");
      setNotice(
        "Listening. Stop to transcribe; nothing is sent as a question yet.",
      );
      timer.current = setTimeout(() => stop(), 60000);
    } catch (error) {
      stream.current?.getTracks().forEach((track) => track.stop());
      if (mounted.current) {
        setState("idle");
        onBusy(false);
        locked.current = false;
        setNotice(
          error instanceof Error ? error.message : "Microphone unavailable.",
        );
      }
    }
  }
  return (
    <div className="relative flex items-center">
      <MotionButton
        type="button"
        disabled={disabled || state === "starting" || state === "transcribing"}
        onClick={() => (state === "listening" ? stop() : void start())}
        aria-label={
          state === "listening"
            ? "Stop recording and transcribe"
            : "Speak a question"
        }
        aria-pressed={state === "listening"}
        className={`grid size-11 place-items-center rounded-lg ${state === "listening" ? "bg-[#EAF4FF] text-[#2855F9]" : "text-[#667085]"}`}
      >
        {state === "listening" ? (
          <Square size={17} aria-hidden="true" />
        ) : (
          <Mic size={19} aria-hidden="true" />
        )}
      </MotionButton>
      {state === "listening" ? (
        <button
          type="button"
          aria-label="Discard recording"
          className="grid size-11 place-items-center"
          onClick={() => stop(true)}
        >
          <X size={16} />
        </button>
      ) : null}
      {notice ? (
        <span
          role="status"
          className="absolute bottom-full right-0 z-10 mb-2 w-56 rounded-xl border border-[#DDE5F0] bg-white p-3 text-xs text-[#14213D]"
        >
          {notice}
        </span>
      ) : null}
    </div>
  );
}
