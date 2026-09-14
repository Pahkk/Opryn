import type { Driver } from "driver.js";
import {
  guideTargets,
  targetSelector,
  type TargetId,
} from "@/lib/guide/registry";
import {
  prefersReducedMotion,
  observeMotionPreference,
} from "@/lib/motion/reduced-motion";

/** Wait for an authored, visible target; no model selectors or arbitrary clicks. */
export function waitForGuideTarget(
  id: TargetId,
  signal: AbortSignal,
  timeout = 8000,
): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const finish = (element?: HTMLElement) => {
      observer.disconnect();
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      if (element) resolve(element);
      else reject(new Error("target_unavailable"));
    };
    const check = () => {
      if (signal.aborted) return finish();
      if (document.querySelector("dialog[open]") || document.hidden) return;
      const target = [
        ...document.querySelectorAll<HTMLElement>(targetSelector(id)),
      ].find(
        (el) =>
          el.getBoundingClientRect().width > 0 &&
          el.getBoundingClientRect().height > 0 &&
          !el.closest('[hidden], [aria-hidden="true"]'),
      );
      if (process.env.NODE_ENV === "development") {
        const matches = document.querySelectorAll(targetSelector(id));
        if (matches.length > 1)
          console.warn(`[Opryn Guide] Duplicate target: ${id}`);
      }
      if (target) finish(target);
    };
    const abort = () => finish();
    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["open", "hidden", "style", "class"],
    });
    const timer = setTimeout(() => finish(), timeout);
    signal.addEventListener("abort", abort, { once: true });
    check();
  });
}

export function showSpotlight(options: {
  targetId: TargetId;
  index: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
  onExit: () => void;
  onInteract: () => void;
  onMissing: () => void;
  lastPoint: { current: { x: number; y: number } | null };
  pointer?: boolean;
}) {
  const abort = new AbortController();
  let tour: Driver | undefined;
  let cleanupMotion = () => {};
  let cleanupEvents = () => {};
  let cleaning = false;
  const previousFocus =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  void (async () => {
    try {
      const [target, { driver }, { gsap }, { MotionPathPlugin }] =
        await Promise.all([
          waitForGuideTarget(options.targetId, abort.signal),
          import("driver.js"),
          import("gsap"),
          import("gsap/MotionPathPlugin"),
        ]);
      if (abort.signal.aborted) return;
      const definition = guideTargets[options.targetId];
      const reduced = prefersReducedMotion(target);
      target.scrollIntoView({
        behavior: "instant",
        block: "center",
        inline: "nearest",
      });
      // Never carry a pointer across routes. Measure only after scroll/layout settles.
      await new Promise<void>((resolve) => {
        let previous = target.getBoundingClientRect(),
          stable = 0,
          frames = 0;
        const check = () => {
          if (abort.signal.aborted) return resolve();
          const next = target.getBoundingClientRect();
          stable =
            Math.abs(next.top - previous.top) +
              Math.abs(next.left - previous.left) <
            0.5
              ? stable + 1
              : 0;
          previous = next;
          if (stable >= 3 || ++frames >= 60) resolve();
          else requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      });
      if (abort.signal.aborted) return;
      const pointer = document.createElement("div");
      pointer.className = "opryn-guide-pointer";
      pointer.setAttribute("aria-hidden", "true");
      pointer.innerHTML =
        '<svg viewBox="0 0 26 30" width="26" height="30"><path d="M3 2 22 17 13 18 9 27Z" fill="#536B82" stroke="white" stroke-width="2" stroke-linejoin="round"/></svg>';
      document.body.append(pointer);
      gsap.registerPlugin(MotionPathPlugin);
      const pointerAnchor = target.matches("button,input,select,a,summary")
        ? target
        : (target.querySelector<HTMLElement>(
            "button:not([disabled]),input,a[href],summary",
          ) ?? target);
      const rect = pointerAnchor.getBoundingClientRect();
      const end = {
        x: Math.max(8, Math.min(innerWidth - 35, rect.right - 22)),
        y: Math.max(8, Math.min(innerHeight - 35, rect.top + 12)),
      };
      const start = {
        x: Math.max(12, end.x - 36),
        y: Math.min(innerHeight - 40, end.y + 24),
      };
      options.lastPoint.current = end;
      const ctx = gsap.context(() => {
        gsap.set(pointer, { x: end.x, y: end.y });
        if (!options.pointer) {
          pointer.style.display = "none";
          return;
        }
        if (
          !reduced &&
          matchMedia("(pointer:fine) and (min-width:768px)").matches
        ) {
          gsap.fromTo(
            pointer,
            { x: start.x, y: start.y },
            {
              duration: 0.35,
              ease: "power2.inOut",
              motionPath: {
                path: [
                  start,
                  {
                    x: (start.x + end.x) / 2 - 12,
                    y: (start.y + end.y) / 2 - 16,
                  },
                  end,
                ],
                curviness: 0.7,
              },
              onComplete: () => {
                pointer.style.visibility = "hidden";
              },
            },
          );
        }
      });
      const stop = observeMotionPreference(target, () => {
        ctx.revert();
        pointer.style.transform = `translate(${end.x}px,${end.y}px)`;
      });
      cleanupMotion = () => {
        stop();
        ctx.revert();
        pointer.remove();
      };
      const interact = () => options.onInteract();
      // A real user gesture transfers control to the underlying workflow (including OAuth).
      target.addEventListener("click", interact, { capture: true, once: true });
      const targetObserver = new MutationObserver(() => {
        if (!target.isConnected) options.onMissing();
        else if (document.querySelector("dialog[open]")) options.onInteract();
      });
      targetObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["open"],
      });
      const reposition = () => {
        gsap.killTweensOf(pointer);
        pointer.style.visibility = "hidden";
        tour?.refresh();
      };
      const escape = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          event.preventDefault();
          options.onExit();
        }
      };
      window.addEventListener("resize", reposition);
      window.addEventListener("orientationchange", reposition);
      let measured = false;
      const resizeObserver = new ResizeObserver(() => {
        if (measured) reposition();
        measured = true;
      });
      resizeObserver.observe(target);
      window.addEventListener("scroll", reposition, true);
      window.addEventListener("keydown", escape);
      cleanupEvents = () => {
        targetObserver.disconnect();
        resizeObserver.disconnect();
        target.removeEventListener("click", interact, true);
        window.removeEventListener("resize", reposition);
        window.removeEventListener("orientationchange", reposition);
        window.removeEventListener("scroll", reposition, true);
        window.removeEventListener("keydown", escape);
      };
      tour = driver({
        animate: !reduced,
        duration: 180,
        overlayColor: "#26384a",
        overlayOpacity: 0.48,
        stagePadding: 8,
        stageRadius: Math.min(
          18,
          parseFloat(getComputedStyle(target).borderRadius) || 6,
        ),
        smoothScroll: false,
        allowClose: true,
        disableActiveInteraction: false,
        allowKeyboardControl: true,
        popoverClass: "opryn-guide-coach",
        showButtons: ["previous", "next", "close"],
        onNextClick: options.onNext,
        onPrevClick: options.onBack,
        onCloseClick: options.onExit,
        onDestroyed: () => {
          if (!cleaning) options.onExit();
        },
        onPopoverRender(popover) {
          popover.title.textContent = definition.title;
          popover.description.textContent = definition.description;
          popover.progress.textContent = `Step ${options.index + 1} of ${options.total}`;
          popover.progress.style.display = "block";
          popover.nextButton.textContent =
            options.index === options.total - 1 ? "Finish guide" : "Next";
          popover.previousButton.textContent = "Back";
          popover.previousButton.disabled = options.index === 0;
          popover.closeButton.setAttribute("aria-label", "Exit guide");
          popover.wrapper.setAttribute(
            "aria-label",
            `Step ${options.index + 1} of ${options.total}. ${definition.title}`,
          );
          popover.nextButton.focus({ preventScroll: true });
        },
      });
      tour.highlight({
        element: target,
        popover: {
          showButtons: ["previous", "next", "close"],
          showProgress: true,
          progressText: `Step ${options.index + 1} of ${options.total}`,
          title: definition.title,
          description: definition.description,
          side: innerWidth < 768 ? "bottom" : "left",
          align: "center",
        },
      });
    } catch {
      if (!abort.signal.aborted) options.onMissing();
    }
  })();
  return () => {
    cleaning = true;
    abort.abort();
    cleanupEvents();
    cleanupMotion();
    tour?.destroy();
    if (previousFocus?.isConnected && !document.querySelector("dialog[open]"))
      previousFocus.focus({ preventScroll: true });
  };
}
