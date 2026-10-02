"use client";
import { motion } from "motion/react";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";
import { SuccessCheck } from "@/components/motion/success-check";

export function ApprovalMilestone({ title }: { title: string }) {
  const reduced = useProductReducedMotion();
  return (
    <section className="onboarding-milestone" role="status" aria-live="polite">
      {!reduced && (
        <div className="onboarding-confetti" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <motion.span
              key={i}
              style={{ background: ["#2855F9", "#B8D9FF", "#FFD5B5"][i % 3] }}
              initial={{ opacity: 0, x: 0, y: 0 }}
              animate={{
                opacity: [0, 1, 0],
                x: (i - 5.5) * 15,
                y: [-5, -35 - (i % 3) * 12, 30],
                rotate: (i % 2 ? 1 : -1) * 60,
              }}
              transition={{ duration: 0.85, delay: (i % 3) * 0.025 }}
            />
          ))}
        </div>
      )}
      <span className="activation-status approved">
        <SuccessCheck /> Approved
      </span>
      <h2>Your first knowledge is live.</h2>
      <p>
        Opryn can now use <strong>{title}</strong> to answer questions.
      </p>
    </section>
  );
}
