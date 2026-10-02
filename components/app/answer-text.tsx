"use client";

import { MotionRegion } from "@/components/motion/motion-region";

/** Full semantic answer immediately; no simulated typing or per-character renders. */
export function AnswerText({ text }: { text: string }) {
  return (
    <MotionRegion variant="quiet" changeKey={text} className="mt-3">
      <p className="whitespace-pre-wrap break-words text-[15px] leading-7 text-[#43536d]">
        {text}
      </p>
    </MotionRegion>
  );
}
