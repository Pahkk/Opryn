"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { gsap, immediateContent, motionScope } from "@/lib/motion/gsap";
import { motion } from "@/lib/motion/presets";

/** Native top-layer dialogs escape animated page containers and trap focus.
 * Children provide one scrollable surface; keyboard size follows VisualViewport.
 */
export function DialogSurface({
  children,
  onClose,
  labelledBy,
  label,
  className = "",
  busy = false,
  animate = true,
}: {
  children: ReactNode;
  onClose: () => void;
  labelledBy?: string;
  label?: string;
  className?: string;
  busy?: boolean;
  /** Opt out for security/billing/destructive confirmations. */
  animate?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    dialog.focus({ preventScroll: true });
    document.body.style.overflow = "hidden";
    const viewport = window.visualViewport;
    function resize() {
      dialog!.style.setProperty(
        "--dialog-height",
        `${viewport?.height ?? window.innerHeight}px`,
      );
      dialog!.style.setProperty(
        "--dialog-top",
        `${viewport?.offsetTop ?? 0}px`,
      );
    }
    resize();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    return () => {
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", resize);
      dialog.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    const dialog = ref.current;
    const content = dialog?.querySelector(":scope > .dialog-content");
    if (
      !dialog ||
      !content ||
      !animate ||
      dialog.classList.contains("dialog-navigation") ||
      dialog.querySelector(immediateContent)
    )
      return;
    // Never transform the native top layer: Google Picker can suspend it safely.
    const scope = motionScope(dialog);
    scope.run(() =>
      gsap.fromTo(
        content,
        {
          opacity: 0,
          // Enter from inside the viewport; don't enlarge horizontal scroll bounds.
          x: window.innerWidth >= 768 ? -motion.distance.sheet : 0,
          y: window.innerWidth < 768 ? motion.distance.sheet : 0,
        },
        {
          opacity: 1,
          x: 0,
          y: 0,
          duration: motion.duration.standard,
          ease: motion.ease.drawer,
          clearProps: "opacity,transform",
        },
      ),
    );
    const observer = new MutationObserver(() => {
      if (!dialog.open || dialog.querySelector(immediateContent))
        scope.dispose();
    });
    observer.observe(dialog, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["open", "role", "aria-invalid"],
    });
    return () => {
      observer.disconnect();
      scope.dispose();
    };
  }, [animate]);
  return (
    <dialog
      ref={ref}
      tabIndex={-1}
      aria-labelledby={labelledBy}
      aria-label={label}
      aria-busy={busy || undefined}
      className={`opryn-dialog ${className}`}
      onKeyDown={(event) => {
        if (
          event.key !== "Tab" ||
          !(event.target instanceof Element) ||
          event.target.closest("dialog") !== event.currentTarget
        )
          return;
        const controls = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),summary,[tabindex]:not([tabindex="-1"])',
          ),
        ].filter(
          (element) =>
            element.getClientRects().length &&
            element.getAttribute("aria-hidden") !== "true",
        );
        const first = controls[0];
        const last = controls.at(-1);
        if (!first) {
          event.preventDefault();
          return;
        }
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === event.currentTarget)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === event.currentTarget)
        ) {
          event.preventDefault();
          first.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
