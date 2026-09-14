import { gsap, motionScope } from "@/lib/motion/gsap";

/** Unpinned, event-triggered sequences; all content remains readable when motion is unavailable. */
export function mountKnowledgeStory(root: HTMLElement) {
  const scope = motionScope(root);
  root.dataset.mobileStory = "true";
  scope.run(() => {
    gsap.set(root.querySelector(".kc-confirmed"), { yPercent: 115 });
    gsap.set(root.querySelector(".kc-confirmation"), { opacity: 0 });
  });
  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        scope.run(() => {
          const node = entry.target;
          if (node.classList.contains("kc-sources")) {
            gsap.fromTo(
              node.children,
              { x: (i: number) => (i % 2 ? 18 : -18), scale: 0.97 },
              {
                x: 0,
                scale: 1,
                stagger: 0.07,
                duration: 0.5,
                ease: "power2.out",
                clearProps: "transform",
              },
            );
          } else if (node.classList.contains("kc-knowledge")) {
            gsap
              .timeline()
              .fromTo(
                node,
                { scale: 0.96 },
                {
                  scale: 1,
                  duration: 0.5,
                  ease: "power2.out",
                  clearProps: "transform",
                },
              )
              .to(
                node.querySelector(".kc-pending"),
                { yPercent: -115, duration: 0.35 },
                0.35,
              )
              .to(
                node.querySelector(".kc-confirmed"),
                { yPercent: 0, duration: 0.35 },
                0.35,
              )
              .to(
                node.querySelector(".kc-status"),
                {
                  backgroundColor: "var(--editorial-success-surface)",
                  duration: 0.35,
                },
                0.35,
              )
              .to(
                node.querySelector(".kc-authority"),
                { height: 0, opacity: 0, marginTop: 0, duration: 0.35 },
                0.35,
              )
              .to(
                node.querySelector(".kc-confirmation"),
                { opacity: 1, duration: 0.3 },
                0.55,
              );
          } else {
            gsap.fromTo(
              node,
              { clipPath: "inset(0 100% 0 0)" },
              {
                clipPath: "inset(0 0% 0 0)",
                duration: 0.5,
                ease: "power2.out",
                clearProps: "clipPath",
              },
            );
          }
        });
        observer.unobserve(entry.target);
      }),
    { threshold: 0.15 },
  );
  root
    .querySelectorAll(
      ".kc-sources,.kc-knowledge,.kc-destination,.kc-gap-question,.kc-gap-answer",
    )
    .forEach((node) => observer.observe(node));
  const fill = root.querySelector<HTMLElement>(".kc-progress-track i");
  const stage = root.querySelector<HTMLElement>(".kc-stage")!;
  let frame = 0;
  const updateProgress = () => {
    frame = 0;
    const rect = stage.getBoundingClientRect();
    const progress = Math.min(
      1,
      Math.max(
        0,
        (76 - rect.top) / Math.max(1, rect.height - innerHeight + 76),
      ),
    );
    if (fill) fill.style.transform = `scaleX(${progress})`;
  };
  const requestProgress = () => {
    if (!frame) frame = requestAnimationFrame(updateProgress);
  };
  window.addEventListener("scroll", requestProgress, { passive: true });
  window.addEventListener("resize", requestProgress);
  updateProgress();
  return () => {
    window.removeEventListener("scroll", requestProgress);
    window.removeEventListener("resize", requestProgress);
    cancelAnimationFrame(frame);
    fill?.style.removeProperty("transform");
    observer.disconnect();
    scope.dispose();
    delete root.dataset.mobileStory;
  };
}
