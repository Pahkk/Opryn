"use client";

import { gsap } from "gsap";
import {
  observeMotionPreference,
  prefersReducedMotion,
} from "./reduced-motion";
export { gsap };

/** No plugins or global defaults. Content is visible in HTML and on any failure.
 * Reverting restores inline styles (including when a preference changes mid-tween).
 * All event/observer-created tweens must be registered through `run`.
 */
export function motionScope(element: Element) {
  const context = gsap.context(() => {}, element);
  let disposed = false;
  const unobserve = observeMotionPreference(element, () => context.revert());
  return {
    run(action: () => void) {
      if (disposed || document.hidden || prefersReducedMotion(element)) return;
      try {
        context.add(action);
      } catch {
        context.revert();
      }
    },
    dispose() {
      disposed = true;
      unobserve();
      context.revert();
    },
  };
}

export const immediateContent =
  '[role="alert"], [data-motion-immediate], [aria-invalid="true"]';
