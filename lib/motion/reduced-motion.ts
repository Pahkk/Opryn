export function prefersReducedMotion(element: Element) {
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !!element.closest('[data-motion="reduced"]')
  );
}

/** Stop active motion immediately when OS/account preference or visibility changes. */
export function observeMotionPreference(element: Element, stop: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  const check = () => {
    if (document.hidden || prefersReducedMotion(element)) stop();
  };
  const observer = new MutationObserver(check);
  for (
    let ancestor: Element | null = element;
    ancestor;
    ancestor = ancestor.parentElement
  ) {
    observer.observe(ancestor, {
      attributes: true,
      attributeFilter: ["data-motion"],
    });
  }
  media.addEventListener("change", check);
  document.addEventListener("visibilitychange", check);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", check);
    document.removeEventListener("visibilitychange", check);
  };
}
