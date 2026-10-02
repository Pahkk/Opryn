import { gsap, motionScope } from "@/lib/motion/gsap";

/** No pin, no hidden reading states: small entry gestures around the full story. */
export function mountKnowledgeStory(root: HTMLElement) {
  const scope = motionScope(root);
  root.dataset.mobileStory = "true";
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        scope.run(() => {
          const node = entry.target;
          if (node.classList.contains("kc-sources")) {
            gsap.from(node.children, {
              x: (i: number) => (i % 2 ? 14 : -14),
              scale: 0.97,
              duration: 0.5,
              stagger: 0.06,
              ease: "power2.out",
              clearProps: "transform",
            });
          } else if (node.classList.contains("kc-knowledge")) {
            gsap.from(node, {
              scale: 0.97,
              y: 12,
              duration: 0.45,
              ease: "power2.out",
              clearProps: "transform",
            });
          } else {
            gsap.from(node, {
              y: 10,
              duration: 0.35,
              ease: "power2.out",
              clearProps: "transform",
            });
          }
        });
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.15 },
  );
  root
    .querySelectorAll(
      ".kc-sources,.kc-knowledge,.kc-destination,.kc-gap-answer,.kc-new-proposal,.kc-loop",
    )
    .forEach((node) => observer.observe(node));
  const fill = root.querySelector<HTMLElement>(".kc-progress-track i");
  const stage = root.querySelector<HTMLElement>(".kc-stage")!;
  const checkpoints = [
    ".kc-sources",
    ".kc-proposal",
    ".kc-authority",
    ".kc-confirmation",
    ".kc-destinations",
    ".kc-feedback",
  ].map((selector) => root.querySelector<HTMLElement>(selector)!);
  const items = Array.from(
    root.querySelectorAll<HTMLElement>(".kc-progress li"),
  );
  let frame = 0;
  const update = () => {
    frame = 0;
    const rect = stage.getBoundingClientRect();
    const progress = Math.min(
      1,
      Math.max(
        0,
        (90 - rect.top) / Math.max(1, rect.height - innerHeight + 90),
      ),
    );
    if (fill) fill.style.transform = "scaleX(" + progress + ")";
    const active = Math.max(
      0,
      checkpoints.findLastIndex(
        (node) => node.getBoundingClientRect().top < innerHeight * 0.5,
      ),
    );
    items.forEach((node, i) => {
      node.dataset.state =
        i < active ? "complete" : i === active ? "active" : "upcoming";
    });
  };
  const request = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request);
  update();
  return () => {
    window.removeEventListener("scroll", request);
    window.removeEventListener("resize", request);
    cancelAnimationFrame(frame);
    observer.disconnect();
    scope.dispose();
    fill?.style.removeProperty("transform");
    items.forEach((node) => delete node.dataset.state);
    delete root.dataset.mobileStory;
  };
}
