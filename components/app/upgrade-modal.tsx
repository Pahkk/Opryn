"use client";

import { useRouter } from "next/navigation";
import { Eye, MessageSquareText, ShieldCheck, X } from "lucide-react";

export function PremiumBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-[#eaf7f1] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.08em] text-[#177257] ${className}`}
    >
      Premium
    </span>
  );
}

export function UpgradeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  if (!open) return null;
  return (
    <div
      className="mobile-sheet-overlay fixed inset-0 z-[150] grid place-items-center bg-[#0d1729]/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="premium-heading"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section className="mobile-sheet-panel relative w-full max-w-xl overflow-hidden rounded-[24px] border border-white/10 bg-white shadow-[0_30px_90px_rgba(13,23,41,.3)]">
        <div className="bg-[#111d34] px-6 py-7 text-white sm:px-8">
          <PremiumBadge className="bg-[#2a3d5d] text-[#b9c8ff]" />
          <h2
            id="premium-heading"
            className="mt-4 text-2xl font-semibold tracking-[-.04em]"
          >
            Teach Opryn by showing it.
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#bdc8da]">
            With Opryn Premium, upload videos, record workflows, and let Opryn
            learn from real business calls.
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close upgrade dialog"
            className="absolute right-4 top-4 grid size-9 place-items-center rounded-lg text-[#b8c4d6] hover:bg-white/10"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-4 p-6 sm:p-8">
          <Benefit
            icon={<Eye />}
            title="Watch your workflow"
            copy="Opryn combines what you say with the screens and actions it can see."
          />
          <Benefit
            icon={<MessageSquareText />}
            title="Learn from real calls"
            copy="Turn sales and customer conversations into reusable company knowledge."
          />
          <Benefit
            icon={<ShieldCheck />}
            title="Teach once"
            copy="Capture what actually happens so employees do not have to keep asking you."
          />
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-xl px-4 text-sm font-semibold text-[#657184] hover:bg-[#f3f5f8]"
            >
              Maybe Later
            </button>
            <button
              type="button"
              onClick={() => router.push("/pricing?upgrade=premium")}
              className="min-h-11 rounded-xl bg-[#3158d8] px-5 text-sm font-semibold text-white shadow-[0_9px_22px_rgba(49,88,216,.2)] hover:bg-[#2446b8]"
            >
              Upgrade to Premium
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Benefit({
  icon,
  title,
  copy,
}: {
  icon: React.ReactNode;
  title: string;
  copy: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#edf2ff] text-[#3158d8] [&>svg]:size-4">
        {icon}
      </span>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-[#6f7c90]">{copy}</p>
      </div>
    </div>
  );
}
