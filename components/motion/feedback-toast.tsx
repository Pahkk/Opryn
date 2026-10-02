"use client";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { X } from "lucide-react";
import type { AppToastMessage } from "@/lib/client-toast";
import { uiTransition } from "@/lib/motion/motion-tokens";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";

function Toast({
  toast,
  onDismiss,
}: {
  toast: AppToastMessage;
  onDismiss: () => void;
}) {
  const reduced = useProductReducedMotion();
  const present = useIsPresent();
  return (
    <motion.div
      role="status"
      aria-live="polite"
      inert={!present || undefined}
      aria-hidden={!present || undefined}
      className="fixed left-4 right-4 top-20 z-[120] rounded-2xl border border-[#bfd4f7] bg-white p-4 pr-12 shadow-[var(--opryn-shadow-lg)] sm:left-auto sm:right-6 sm:w-full sm:max-w-sm"
      data-motion-owner="motion"
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduced ? 0 : -4 }}
      transition={uiTransition(reduced)}
    >
      <p className="text-sm font-semibold text-[var(--opryn-navy)]">
        {toast.title}
      </p>
      {toast.description ? (
        <p className="mt-1 text-xs leading-5 text-[var(--opryn-muted)]">
          {toast.description}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg text-[var(--opryn-muted)] hover:bg-[#eaf4ff]"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </motion.div>
  );
}

/** Existing safe toast event architecture. No success check on a generic/error notice. */
export function FeedbackToast({
  toast,
  onDismiss,
}: {
  toast: AppToastMessage | null;
  onDismiss: () => void;
}) {
  return (
    <AnimatePresence initial={false}>
      {toast ? (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ) : null}
    </AnimatePresence>
  );
}
