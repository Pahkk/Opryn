import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Flip } from "gsap/Flip";
import { SplitText } from "gsap/SplitText";
import { prefersReducedMotion } from "@/lib/motion/reduced-motion";

/** One reversible scene; React owns the content, GSAP owns only presentation. */
export function mountKnowledgeStory(root: HTMLElement) {
  if (prefersReducedMotion(root)) return () => {};
  gsap.registerPlugin(ScrollTrigger, Flip, SplitText);
  let disposed = false;
  const ctx = gsap.context(() => {}, root);
  const track = root.querySelector<HTMLElement>(".kc-track")!;
  const distance = () =>
    Math.round(Math.min(3800, Math.max(2800, innerHeight * 3.8)));
  try {
    ctx.add(() => {
      root.dataset.enhanced = "true";
      const q = gsap.utils.selector(root);
      const palette = getComputedStyle(root);
      const color = (token: string) => palette.getPropertyValue(token).trim();
      // Word masks wrap naturally; the persistent outer mask moves each headline.
      const headlines = q(".kc-headline>p").map((node) =>
        SplitText.create(node, { type: "words", mask: "words", aria: "none" }),
      );
      const stage = root.querySelector<HTMLElement>(".kc-stage")!;
      const card = root.querySelector<HTMLElement>(".kc-knowledge")!;
      const slot = root.querySelector<HTMLElement>(".kc-hub-slot")!;
      const sources = [...root.querySelectorAll<HTMLElement>(".kc-fragment")];
      const destinations = [
        ...root.querySelectorAll<HTMLElement>(".kc-destination"),
      ];
      const paths = [
        ...root.querySelectorAll<SVGPathElement>(".kc-paths path"),
      ];
      const railItems = [
        ...root.querySelectorAll<HTMLElement>(".kc-progress li"),
      ];
      const railFill = root.querySelector<HTMLElement>(".kc-progress-track i")!;
      const canvas = () => slot.offsetLeft * 2 + slot.offsetWidth;
      let fit: gsap.TweenVars = {};
      const sizePaths = () => {
        track.style.setProperty("--kc-distance", distance() + "px");
        root.dataset.scrollDistance = String(distance());
        // Flip measures the actual element and target, including transform origins.
        // getVars leaves the DOM untouched: the master timeline stays fully reversible.
        const measure = gsap.context(() => {
          gsap.set(card, { x: 0, y: 0, scale: 1, rotationX: 0 });
          slot.style.height = card.offsetHeight * 0.88 + "px";
          fit = Flip.fit(card, slot, {
            scale: true,
            getVars: true,
          }) as gsap.TweenVars;
        });
        measure.revert();
        const left = slot.offsetLeft,
          right = left + slot.offsetWidth,
          top = slot.offsetTop;
        const out = root.querySelectorAll<SVGPathElement>(".kc-out-path");
        destinations.forEach((destination, i) => {
          const isLeft = i < 2;
          const sx = isLeft ? left : right;
          const sy = top + [80, 215, 55, 140, 225][i];
          const ex =
            destination.offsetLeft + (isLeft ? destination.offsetWidth : 0);
          const ey = destination.offsetTop + 22;
          const mid = (sx + ex) / 2;
          out[i].setAttribute(
            "d",
            `M${sx} ${sy} C${mid} ${sy} ${mid} ${ey} ${ex} ${ey}`,
          );
        });
        q(".kc-intake-path")[0].setAttribute(
          "d",
          `M${card.offsetLeft - 70} 265 H${card.offsetLeft}`,
        );
        q(".kc-ecosystem-path")[0].setAttribute(
          "d",
          `M${canvas() * 0.24} 365 H${left} M${right} 365 H${canvas() * 0.76}`,
        );
        // A returning question goes from the usage surface back toward the review queue.
        const feedback = root.querySelector<HTMLElement>(".kc-feedback")!;
        const route = root.querySelector<HTMLElement>(".kc-gap-route")!;
        const fx = feedback.offsetLeft,
          fy = feedback.offsetTop;
        const endY = fy + route.offsetTop + route.offsetHeight / 2;
        q(".kc-feedback-path")[0].setAttribute(
          "d",
          `M${fx - 14} ${fy + 82} C${fx - 42} ${fy + 82} ${fx - 42} ${endY} ${fx} ${endY}`,
        );
        paths.forEach(
          (path) =>
            (path.style.strokeDasharray = String(path.getTotalLength())),
        );
      };
      sizePaths();
      gsap.set(paths, {
        strokeDashoffset: (_, path: SVGPathElement) => path.getTotalLength(),
        opacity: 0,
      });
      gsap.set(q(".kc-headline:not(.kc-headline-0)>p"), { yPercent: 115 });
      gsap.set(
        headlines.flatMap((split) => split.words),
        { yPercent: 18 },
      );
      gsap.set(
        q(
          ".kc-discovery,.kc-ecosystem,.kc-confirmation,.kc-authority,.kc-focus-ring,.kc-feedback",
        ),
        { opacity: 0 },
      );
      gsap.set(q(".kc-gap-route,.kc-gap-answer,.kc-gap-queued"), {
        clipPath: "inset(0 0 100% 0)",
        opacity: 0,
      });
      gsap.set(q(".kc-confirmed,.kc-approved-label"), { yPercent: 115 });
      gsap.set(card, {
        opacity: 0,
        scale: 0.94,
        y: 20,
        rotationX: 5,
        transformPerspective: 1100,
        clipPath: "inset(0 0 86% 0 round 8px)",
      });
      gsap.set(destinations, { opacity: 0, clipPath: "inset(0 100% 0 0)" });
      sources.forEach((source, i) =>
        gsap.set(source, {
          x: [-100, 100, 0, 0][i],
          y: [0, 0, 90, -70][i],
          scale: 0.94,
          opacity: 0,
          rotationX: [3, -3, 2, -2][i],
          transformPerspective: 1000,
        }),
      );
      const tl = gsap.timeline({
        defaults: { ease: "power2.inOut" },
        scrollTrigger: {
          id: "opryn-knowledge-centerpiece",
          trigger: track,
          start: "top 88px",
          end: () => "+=" + distance(),
          scrub: 0.9,
          pin: stage,
          pinSpacing: false,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onRefreshInit: sizePaths,
          onUpdate: (self) => {
            railFill.style.transform = `scaleY(${self.progress})`;
            root.dataset.storyProgress = String(self.progress);
            root.dataset.storyActive = String(self.isActive);
          },
        },
      });
      const labels = {
        intro: 0,
        sources: 6,
        search: 24,
        converge: 38,
        proposal: 53,
        review: 62,
        approved: 76,
        distribution: 90,
        feedback: 113,
        difference: 136,
        final: 143,
      };
      Object.entries(labels).forEach(([name, time]) => tl.addLabel(name, time));
      root.dataset.timelineLabels = JSON.stringify(labels);
      const checkpoints = [
        "intro",
        "proposal",
        "review",
        "approved",
        "distribution",
        "feedback",
      ];
      // Labels, not arbitrary percentages, determine each stage's state.
      tl.eventCallback("onUpdate", () => {
        const time = tl.time();
        let active = 0;
        checkpoints.forEach((label, i) => {
          if (time >= tl.labels[label]) active = i;
        });
        railItems.forEach((item, i) => {
          item.dataset.state =
            i < active ? "complete" : i === active ? "active" : "upcoming";
        });
        root.dataset.storyStage = checkpoints[active];
      });
      const headline = (previous: number, next: number, at: number) => {
        tl.to(
          headlines[next].words,
          { yPercent: 0, duration: 3.5, stagger: 0.035 },
          at + 0.5,
        );
        tl.to(
          q(`.kc-headline-${previous}>p`),
          { yPercent: -115, duration: 3.5 },
          at,
        ).to(
          q(`.kc-headline-${next}>p`),
          { yPercent: 0, duration: 4 },
          at + 0.5,
        );
      };
      // Masked type uses a fixed HTML mask, avoiding font splitting / layout shifts.
      tl.fromTo(
        q(".kc-headline-0>p"),
        { yPercent: 115 },
        { yPercent: 0, duration: 5 },
        0,
      ).to(
        sources,
        {
          x: 0,
          y: 0,
          scale: 1,
          rotationX: 0,
          opacity: 1,
          duration: 8,
          stagger: 1.3,
        },
        "sources",
      );
      tl.to(
        headlines[0].words,
        { yPercent: 0, duration: 4, stagger: 0.035 },
        0,
      );
      headline(0, 1, 24);
      tl.to(q(".kc-scattered-label"), { y: -10, opacity: 0, duration: 3 }, 24)
        .fromTo(
          q(".kc-discovery"),
          { clipPath: "inset(0 0 100% 0)" },
          { clipPath: "inset(0 0 0% 0)", opacity: 1, duration: 5 },
          26,
        )
        .fromTo(
          q(".kc-search-demo strong"),
          { y: 10, opacity: 0 },
          { y: 0, opacity: 1, stagger: 1, duration: 3 },
          30,
        );
      tl.to(
        root,
        { backgroundColor: color("--story-structure"), duration: 10 },
        "converge",
      );
      headline(1, 2, 38);
      tl.to(
        q(".kc-discovery"),
        { clipPath: "inset(0 0 100% 0)", duration: 4 },
        38,
      );
      sources.forEach((source, i) => {
        tl.to(
          source,
          {
            x: () =>
              canvas() / 2 - source.offsetLeft - source.offsetWidth / 2 + i * 6,
            y: () => 220 - source.offsetTop + i * 6,
            scale: 0.92,
            clipPath: "inset(0 0 calc(100% - 88px) 0 round 5px)",
            duration: 10,
          },
          39 + i * 0.45,
        ).to(
          source,
          {
            x: () => canvas() * 0.02 - source.offsetLeft,
            y: () => 280 + i * 70 - source.offsetTop,
            scale: 0.76,
            opacity: 0.6,
            duration: 8,
          },
          51 + i * 0.4,
        );
      });
      tl.to(card, { opacity: 1, duration: 1 }, 49)
        .to(card, { clipPath: "inset(0 0 0% 0 round 8px)", duration: 10 }, 49)
        .to(
          q(".kc-intake-path"),
          { strokeDashoffset: 0, opacity: 1, duration: 6 },
          53,
        );
      headline(2, 3, 62);
      tl.to(card, { scale: 1, y: 0, rotationX: 0, duration: 6 }, 62)
        .to(sources, { opacity: 0.45, duration: 5 }, 62)
        .to(root, { backgroundColor: color("--story-review"), duration: 7 }, 62)
        .to(q(".kc-authority"), { opacity: 1, duration: 3 }, 64)
        .fromTo(
          q(".kc-focus-ring"),
          { x: 65, scale: 1.05 },
          { x: 0, scale: 1, opacity: 1, duration: 4 },
          69,
        );
      headline(3, 4, 76);
      tl.to(
        q(".kc-pending,.kc-proposed-label"),
        { yPercent: -115, duration: 4 },
        76,
      )
        .to(
          q(".kc-confirmed,.kc-approved-label"),
          { yPercent: 0, duration: 4 },
          76,
        )
        .to(
          q(".kc-status"),
          {
            width: 88,
            backgroundColor: color("--editorial-success-surface"),
            color: color("--editorial-success"),
            duration: 4,
          },
          76,
        )
        .to(q(".kc-authority"), { opacity: 0, y: -6, duration: 4 }, 76)
        .to(q(".kc-provenance"), { y: -65, duration: 5 }, 77)
        .to(
          card,
          {
            borderColor: color("--editorial-line"),
            clipPath: "inset(0 0 65px 0 round 8px)",
            duration: 5,
          },
          77,
        )
        .to(q(".kc-confirmation"), { opacity: 1, duration: 3 }, 80)
        .to(
          root,
          { backgroundColor: color("--story-approved"), duration: 7 },
          77,
        )
        .to(q(".kc-intake-path"), { opacity: 0, duration: 3 }, 82);
      sources.forEach((source, i) =>
        tl.to(
          source,
          {
            x: () => canvas() * (0.015 + i * 0.25) - source.offsetLeft,
            y: () => 595 - source.offsetTop,
            scale: 0.62,
            opacity: 0.28,
            duration: 7,
          },
          84,
        ),
      );
      tl.to(
        root,
        { backgroundColor: color("--story-use"), duration: 12 },
        "distribution",
      );
      headline(4, 5, 90);
      tl.to(q(".kc-provenance small"), { opacity: 0, duration: 3 }, 89).to(
        card,
        { clipPath: "inset(0 0 100px 0 round 8px)", duration: 5 },
        89,
      );
      tl.to(
        card,
        {
          x: () => Number(fit.x || 0),
          y: () => Number(fit.y || 0),
          scaleX: () => Number(fit.scaleX || 0.88),
          scaleY: () => Number(fit.scaleY || 0.88),
          duration: 6,
        },
        89,
      );
      q(".kc-out-path").forEach((path, i) => {
        tl.to(
          path,
          { strokeDashoffset: 0, opacity: 1, duration: 3.2 },
          94 + i * 3,
        ).to(
          destinations[i],
          { opacity: 1, clipPath: "inset(0 0% 0 0)", duration: 2.6 },
          96.5 + i * 3,
        );
      });
      headline(5, 6, 113);
      tl.to(
        destinations,
        { clipPath: "inset(0 0 100% 0)", duration: 3, stagger: 0.25 },
        113,
      )
        .to(q(".kc-out-path"), { opacity: 0, duration: 3 }, 113)
        .to(
          card,
          {
            x: () => -canvas() * 0.26,
            y: 28,
            scale: 0.66,
            opacity: 0.7,
            duration: 5,
          },
          114,
        )
        .to(sources, { opacity: 0, duration: 3 }, 114)
        .fromTo(
          q(".kc-feedback"),
          { clipPath: "inset(0 0 100% 0)" },
          { clipPath: "inset(0 0 0% 0)", opacity: 1, duration: 4 },
          115,
        )
        .to(
          q(".kc-feedback-path"),
          { strokeDashoffset: 0, opacity: 0.7, duration: 4 },
          119,
        )
        .to(
          q(".kc-gap-route"),
          { clipPath: "inset(0 0 0% 0)", opacity: 1, duration: 3 },
          121,
        )
        .to(
          q(".kc-gap-answer"),
          { clipPath: "inset(0 0 0% 0)", opacity: 1, duration: 4 },
          124,
        )
        .to(
          q(".kc-gap-queued"),
          { clipPath: "inset(0 0 0% 0)", opacity: 1, duration: 3 },
          129,
        );
      tl.fromTo(
        q(".kc-gap-publish"),
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 2 },
        132,
      );
      headline(6, 7, 128);
      tl.to(
        q(".kc-feedback"),
        { clipPath: "inset(0 0 100% 0)", duration: 4 },
        136,
      )
        .to(q(".kc-feedback-path"), { opacity: 0, duration: 3 }, 136)
        .to(
          card,
          {
            x: () => Number(fit.x || 0),
            y: () => Number(fit.y || 0) - 65,
            scale: 0.88,
            opacity: 1,
            duration: 6,
          },
          137,
        )
        .to(sources, { opacity: 0.22, duration: 4 }, 138)
        .to(q(".kc-ecosystem"), { opacity: 1, duration: 5 }, 140)
        .to(
          q(".kc-ecosystem-path"),
          { strokeDashoffset: 0, opacity: 1, duration: 5 },
          141,
        );
      headline(7, 8, 143);
      tl.to(q(".kc-progress"), { opacity: 0.25, duration: 4 }, 148).to(
        {},
        { duration: 1 },
        152,
      );
      void document.fonts.ready.then(() => {
        if (!disposed) tl.scrollTrigger?.refresh();
      });
    });
  } catch (error) {
    ctx.revert();
    delete root.dataset.enhanced;
    track.style.removeProperty("--kc-distance");
    throw error;
  }
  return () => {
    disposed = true;
    ctx.revert();
    delete root.dataset.enhanced;
    delete root.dataset.storyStage;
    delete root.dataset.timelineLabels;
    delete root.dataset.scrollDistance;
    delete root.dataset.storyProgress;
    delete root.dataset.storyActive;
    track.style.removeProperty("--kc-distance");
    root
      .querySelector<HTMLElement>(".kc-progress-track i")
      ?.style.removeProperty("transform");
    root
      .querySelectorAll<HTMLElement>(".kc-progress li")
      .forEach((el) => delete el.dataset.state);
  };
}
