"use client";
import { motion } from "motion/react";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";
import { OprynLogo } from "@/components/opryn-logo";

/** The guide is Opryn, so it uses the approved brand logo—not a character avatar. */
export function GuideCompanion({ thinking = false }: { thinking?: boolean }) {
  const reduced = useProductReducedMotion();
  return (
    <motion.span
      className="guide-companion"
      aria-hidden="true"
      animate={{ rotate: thinking && !reduced ? -3 : 0 }}
      transition={{ duration: reduced ? 0 : 0.2 }}
    >
      <OprynLogo size="small" className="guide-companion-logo" />
    </motion.span>
  );
}
