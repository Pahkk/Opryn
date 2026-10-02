"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useAnimate } from "motion/react";
import { uiTransition } from "@/lib/motion/motion-tokens";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";
const immediateContent =
  '[role="alert"], [aria-invalid="true"], [data-motion-immediate]';

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
  const [, animateSurface] = useAnimate();
  const reduced = useProductReducedMotion();
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
    const content = dialog?.querySelector(
      ":scope > .dialog-content, :scope > .needs-you-sheet",
    );
    if (
      !dialog ||
      !content ||
      !animate ||
      reduced ||
      dialog.classList.contains("dialog-navigation") ||
      dialog.querySelector(immediateContent)
    )
      return;
    // Never transform the native top layer: Google Picker can suspend it safely.
    const surface = content as HTMLElement;
    surface.dataset.motionOwner = "motion";
    const reset = () => {
      surface.style.opacity = "1";
      surface.style.transform = "none";
    };
    const playback = animateSurface(
      surface,
      {
        opacity: [0, 1],
        // Enter from inside the viewport, including full-width desktop sheets.
        x: window.innerWidth >= 768 ? [-24, 0] : 0,
        y: window.innerWidth < 768 ? [24, 0] : 0,
      },
      uiTransition(),
    );
    void playback.then(reset);
    const observer = new MutationObserver(() => {
      if (!dialog.open || dialog.querySelector(immediateContent)) {
        playback.stop();
        reset();
      }
    });
    observer.observe(dialog, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["open", "role", "aria-invalid"],
    });
    return () => {
      observer.disconnect();
      playback.stop();
      reset();
    };
  }, [animate, animateSurface, reduced]);
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
