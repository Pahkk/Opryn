"use client";
import { useSyncExternalStore } from "react";
import { useReducedMotion } from "motion/react";
const listeners = new Set<() => void>();
let observer: MutationObserver | undefined;
const snapshot = () =>
  !!document.querySelector('[data-motion="reduced"]') || document.hidden;
const serverSnapshot = () => true;
function notify() {
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    observer = new MutationObserver(notify);
    observer.observe(document.documentElement, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-motion"],
    });
    document.addEventListener("visibilitychange", notify);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      observer?.disconnect();
      observer = undefined;
      document.removeEventListener("visibilitychange", notify);
    }
  };
}
/** One shared account-preference observer; OS and account choices both apply. */
export function useProductReducedMotion() {
  const system = useReducedMotion();
  const account = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return system !== false || account;
}
