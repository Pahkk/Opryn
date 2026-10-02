import { gsap, ScrollTrigger, Flip, SplitText } from "@/lib/motion/story-gsap";
import { prefersReducedMotion } from "@/lib/motion/reduced-motion";

// Timeline units are editorial beats, not wall-clock seconds.
export const STORY_BEATS = {
  information: 0,
  structure: 14,
  review: 31,
  approved: 46,
  use: 60,
  learn: 82,
  final: 97,
} as const;
type Layout =
  "source" | "stack" | "proposal" | "review" | "approved" | "hub" | "learn";

/** Flip's measured geometry is sampled into explicit from/to tweens. Unlike
 * onEnter DOM mutations, every intermediate layout is seekable in both directions. */
export function mountKnowledgeStory(root: HTMLElement) {
  if (prefersReducedMotion(root)) return () => {};
  gsap.registerPlugin(ScrollTrigger, Flip, SplitText);
  const splits: SplitText[] = [];
  let disposed = false;
  let refreshFrame = 0;
  const ctx = gsap.context(() => {}, root);
  // Read the active design system, never restore a superseded slate palette
  // via timeline inline styles. GSAP alone owns these scroll-driven changes.
  const theme = getComputedStyle(root);
  const storyColor = (stage: string, fallback: string) =>
    theme.getPropertyValue(`--story-${stage}`).trim() || fallback;
  root.dataset.enhanced = "true";
  const contentScale =
    innerHeight < 820
      ? gsap.utils.clamp(0.64, 1, (innerHeight - 285) / 500)
      : 1;
  root.style.setProperty("--kc-content-scale", String(contentScale));
  const track = root.querySelector<HTMLElement>(".kc-track")!;
  const distance = Math.round(gsap.utils.clamp(4500, 5200, innerHeight * 5.4));
  root.dataset.scrollDistance = String(distance);
  track.style.setProperty("--kc-distance", distance + "px");
  try {
    ctx.add(() => {
      const q = <T extends Element = HTMLElement>(selector: string) =>
        root.querySelector<T>(selector)!;
      const all = <T extends Element = HTMLElement>(selector: string) =>
        Array.from(root.querySelectorAll<T>(selector));
      const card = q(".kc-knowledge");
      const canvas = q(".kc-canvas");
      const stage = q(".kc-stage");
      const fragments = all(".kc-fragment");
      const endpoints = all(".kc-destination");
      const paths = all<SVGPathElement>(".kc-out-path");
      const feedbackPath = q<SVGPathElement>(".kc-feedback-path");
      const returnPath = q<SVGPathElement>(".kc-return-path");
      const rail = q(".kc-progress-track");
      const fill = q(".kc-progress-track i");
      const marker = q(".kc-progress-track em");
      const railItems = all(".kc-progress li");
      const number = q(".kc-progress-number");
      const layouts = {} as Record<Layout, gsap.TweenVars>;
      const boxes = {} as Record<
        Layout,
        { x: number; y: number; width: number; height: number }
      >;
      const base = canvas.getBoundingClientRect();

      for (const name of [
        "source",
        "stack",
        "proposal",
        "review",
        "approved",
        "hub",
        "learn",
      ] as Layout[]) {
        const probe = q('[data-layout="' + name + '"]');
        const bounds = probe.getBoundingClientRect();
        boxes[name] = {
          x: bounds.left - base.left,
          y: bounds.top - base.top,
          width: bounds.width,
          height: bounds.height,
        };
        // Keep one real document/knowledge DOM node; no replacement card.
        layouts[name] = Flip.fit(card, Flip.getState(probe), {
          getVars: true,
          scale: false,
        }) as gsap.TweenVars;
      }
      const finalFit = Flip.fit(card, Flip.getState(q(".kc-loop-opryn")), {
        getVars: true,
        scale: false,
      }) as gsap.TweenVars;
      const fragmentHome = fragments.map((node) => ({
        x: 0,
        y: 0,
        width: node.offsetWidth,
        height: node.offsetHeight,
      }));
      const fragmentStack = fragments.map((node, i) => {
        const box = boxes.stack;
        const measurement = gsap.context(() => {
          gsap.set(q('[data-layout="stack"]'), {
            x: 7 * (i + 1),
            y: -7 * (i + 1),
          });
        });
        const fit = Flip.fit(node, Flip.getState(q('[data-layout="stack"]')), {
          getVars: true,
          scale: false,
        }) as gsap.TweenVars;
        measurement.revert();
        return { ...fit, height: box.height };
      });
      const retained = fragments.map((node, i) => ({
        x: canvas.clientWidth * (0.1 + i * 0.27) - node.offsetLeft,
        y: canvas.clientHeight - 55 - node.offsetTop,
        width: canvas.clientWidth * 0.25,
        height: 48,
      }));
      // Coordinates come from the actual hub and endpoints in the same canvas.
      const hub = boxes.hub;
      paths.forEach((path, i) => {
        const node = endpoints[i];
        const left = i < 2;
        const x1 = left ? hub.x : hub.x + hub.width;
        const y1 =
          hub.y +
          hub.height * (left ? (i === 0 ? 0.25 : 0.72) : 0.18 + (i - 2) * 0.31);
        const x2 = left
          ? node.offsetLeft + node.offsetWidth + 12
          : node.offsetLeft - 12;
        const y2 = node.offsetTop + 20;
        const bend = (x1 + x2) / 2;
        path.setAttribute(
          "d",
          `M${x1} ${y1} C${bend} ${y1},${bend} ${y2},${x2} ${y2}`,
        );
      });
      const learn = boxes.learn;
      const feedback = q(".kc-feedback");
      feedbackPath.setAttribute(
        "d",
        `M${feedback.offsetLeft - 12} 55 C${learn.x + learn.width + 18} 55,${learn.x + learn.width + 18} ${learn.y + 90},${learn.x + learn.width} ${learn.y + 90}`,
      );
      const proposal = q(".kc-new-proposal");
      returnPath.setAttribute(
        "d",
        `M${proposal.offsetLeft} ${proposal.offsetTop + 40} C${learn.x + learn.width + 12} ${proposal.offsetTop + 40},${learn.x + learn.width + 12} ${learn.y + learn.height - 35},${learn.x + learn.width} ${learn.y + learn.height - 35}`,
      );
      const allPaths = [...paths, feedbackPath, returnPath];
      allPaths.forEach((path) => {
        const length = path.getTotalLength();
        gsap.set(path, {
          strokeDasharray: length,
          strokeDashoffset: length,
          opacity: 0,
        });
      });
      const stageNames = Object.keys(STORY_BEATS).slice(0, 6);
      const stageTimes = Object.values(STORY_BEATS).slice(0, 6);
      const railHeight = Math.min(350, innerHeight - 365);
      railItems.forEach((node, i) => {
        gsap.set(node, {
          position: "absolute",
          top: (stageTimes[i] / 100) * railHeight,
        });
      });
      gsap.set(rail, { height: railHeight, top: 80 });
      gsap.set(fill, { scaleY: 0 });
      gsap.set(marker, { y: 0 });
      gsap.set(card, {
        ...layouts.source,
        opacity: 0,
        transformPerspective: 1200,
      });
      gsap.set(fragments, { opacity: 0, overflow: "hidden" });
      gsap.set(q(".kc-proposal"), {
        autoAlpha: 0,
        scale: contentScale,
        width: 100 / contentScale + "%",
        transformOrigin: "0 0",
      });
      gsap.set(q(".kc-loop-opryn"), { opacity: 0 });
      gsap.set([q(".kc-authority"), q(".kc-confirmation")], { autoAlpha: 0 });
      gsap.set([q(".kc-confirmed"), q(".kc-approved-label")], {
        yPercent: 115,
      });
      gsap.set(endpoints, { opacity: 0, clipPath: "inset(0 0 100% 0)" });
      gsap.set([q(".kc-feedback"), q(".kc-new-proposal"), q(".kc-loop")], {
        autoAlpha: 0,
      });
      gsap.set([q(".kc-gap-result"), q(".kc-gap-route"), q(".kc-gap-answer")], {
        opacity: 0,
        y: 10,
      });
      gsap.set(q(".kc-approval-sweep rect"), {
        strokeDasharray: 1,
        strokeDashoffset: 1,
        opacity: 0,
      });

      const tl = gsap.timeline({
        paused: true,
        defaults: { ease: "power2.inOut" },
      });
      Object.entries(STORY_BEATS).forEach(([name, time]) =>
        tl.addLabel(name, time),
      );
      // Production QA can read phase boundaries, never control application state.
      root.dataset.storyLabels = JSON.stringify(STORY_BEATS);
      all(".kc-headline > p").forEach((node, i) => {
        splits.push(
          SplitText.create(node, {
            type: "lines",
            mask: "lines",
            autoSplit: true,
            aria: "none",
            onSplit(self) {
              const text = gsap.timeline();
              text.set(self.lines, { yPercent: i === 0 ? 0 : 115 }, 0);
              if (i > 0)
                text.to(
                  self.lines,
                  {
                    yPercent: 0,
                    duration: 2.5,
                    stagger: 0.15,
                    ease: "power3.out",
                  },
                  stageTimes[i],
                );
              if (i < 5)
                text.to(
                  self.lines,
                  {
                    yPercent: -115,
                    duration: 2,
                    stagger: 0.1,
                    ease: "power2.inOut",
                  },
                  stageTimes[i + 1],
                );
              tl.add(text, 0);
              return text;
            },
          }),
        );
      });
      const moveCard = (
        from: Layout,
        to: Layout,
        at: number,
        duration: number,
      ) =>
        tl.fromTo(
          card,
          layouts[from],
          { ...layouts[to], duration, immediateRender: false },
          at,
        );

      tl.fromTo(
        card,
        {
          ...layouts.source,
          x: Number(layouts.source.x) - 120,
          opacity: 0,
          rotation: -1.2,
        },
        {
          ...layouts.source,
          opacity: 1,
          rotation: 0,
          duration: 5,
          immediateRender: false,
        },
        1,
      );
      fragments.forEach((node, i) => {
        tl.fromTo(
          node,
          {
            ...fragmentHome[i],
            x: i === 0 ? 120 : 0,
            y: i === 1 ? 80 : i === 2 ? -70 : 0,
            scale: 0.93,
            opacity: 0,
            rotation: i === 0 ? 1.2 : -0.7,
          },
          {
            ...fragmentHome[i],
            scale: 1,
            rotation: 0,
            opacity: 1,
            duration: 5,
            immediateRender: false,
          },
          2 + i * 0.7,
        );
      });
      tl.to(q(".kc-scattered-label"), { opacity: 0, y: -6, duration: 2 }, 14);
      tl.to(root, { backgroundColor: storyColor("structure", "#f4f8ff"), duration: 8 }, 14);
      moveCard("source", "stack", 16, 5);
      tl.to(
        q(".kc-document .kc-fragment-content"),
        { opacity: 0, y: -8, duration: 2 },
        18,
      );
      fragments.forEach((node, i) => {
        tl.fromTo(
          node,
          fragmentHome[i],
          { ...fragmentStack[i], duration: 5, immediateRender: false },
          16 + i * 0.35,
        );
        tl.to(
          node.querySelector(".kc-fragment-content"),
          { opacity: 0, y: -8, duration: 2 },
          19,
        );
        tl.fromTo(
          node,
          fragmentStack[i],
          { ...retained[i], duration: 6, immediateRender: false },
          24,
        );
        tl.to(
          node.querySelector(".kc-fragment-title"),
          { scale: 0.8, transformOrigin: "left top", y: -8, duration: 5 },
          24,
        );
      });
      tl.to(q(".kc-document"), { opacity: 0, y: -18, duration: 2 }, 22);
      moveCard("stack", "proposal", 23, 6);
      tl.fromTo(
        q(".kc-proposal"),
        { autoAlpha: 0, y: 18 },
        { autoAlpha: 1, y: 0, duration: 3, immediateRender: false },
        26,
      );
      tl.to(q(".kc-plane"), { scale: 0.94, opacity: 0.25, duration: 5 }, 31);
      tl.to(fragments, { opacity: 0.5, duration: 4 }, 31);
      moveCard("proposal", "review", 32, 5);
      tl.to(root, { backgroundColor: storyColor("review", "#eaf4ff"), duration: 7 }, 31);
      tl.to(q(".kc-authority"), { autoAlpha: 1, duration: 2 }, 35);
      // A long legible hold precedes the example approval. No simulated click.
      tl.to(
        [q(".kc-pending"), q(".kc-proposed-label")],
        { yPercent: -115, duration: 3 },
        48,
      );
      tl.to(
        [q(".kc-confirmed"), q(".kc-approved-label")],
        { yPercent: 0, duration: 3 },
        48,
      );
      tl.to(
        q(".kc-status"),
        { width: 94, backgroundColor: "#e5ece6", duration: 3 },
        48,
      );
      tl.to(
        q(".kc-authority"),
        { height: 0, autoAlpha: 0, marginTop: 0, duration: 3 },
        48,
      );
      moveCard("review", "approved", 48, 5);
      // A measured internal layout reflow, not a clipped card bottom.
      const provenance = q(".kc-provenance");
      const before = Flip.getState(provenance);
      const measurement = gsap.context(() =>
        gsap.set(provenance, { top: 290 }),
      );
      const metadataFlip = Flip.from(before, {
        duration: 4,
        paused: true,
        clearProps: false,
        scale: true,
        ease: "power2.inOut",
      });
      tl.add(metadataFlip.play(), 49);
      measurement.revert();
      // Keep final CSS baseline for Flip's inverse offset animation.
      gsap.set(provenance, { top: 290 });
      tl.to(q(".kc-confirmation"), { autoAlpha: 1, duration: 2 }, 51);
      tl.to(
        q(".kc-approval-sweep rect"),
        { strokeDashoffset: 0, opacity: 0.8, duration: 3, ease: "power2.out" },
        53,
      ).to(q(".kc-approval-sweep rect"), { opacity: 0, duration: 1.5 }, 56);
      tl.to(root, { backgroundColor: storyColor("approved", "#eaf4ff"), duration: 6 }, 46);
      moveCard("approved", "hub", 60, 4);
      // Scale the contents uniformly while the shared outer shell opens into a hub.
      tl.fromTo(
        q(".kc-proposal"),
        { scale: contentScale, width: 100 / contentScale + "%" },
        {
          scale: 0.9 * contentScale,
          transformOrigin: "0 0",
          width: 100 / (0.9 * contentScale) + "%",
          duration: 4,
          immediateRender: false,
        },
        60,
      );
      tl.to(q(".kc-plane"), { scale: 1.04, opacity: 0.35, duration: 6 }, 60);
      tl.to(fragments, { opacity: 0.2, y: "+=15", duration: 4 }, 60);
      tl.to(root, { backgroundColor: storyColor("use", "#eaf4ff"), duration: 8 }, 60);
      paths.forEach((path, i) => {
        const at = 64 + i * 2.6;
        tl.to(
          path,
          {
            opacity: 1,
            strokeDashoffset: 0,
            duration: 2,
            ease: "power2.inOut",
          },
          at,
        );
        tl.to(
          endpoints[i],
          { opacity: 1, clipPath: "inset(0 0 0% 0)", duration: 1.5 },
          at + 1.7,
        );
      });
      tl.to(endpoints, { opacity: 0, y: -8, duration: 2 }, 82);
      tl.to(paths, { opacity: 0, duration: 2 }, 82);
      tl.to(fragments, { opacity: 0, duration: 2 }, 82);
      moveCard("hub", "learn", 82, 3);
      tl.to(card, { opacity: 0.6, duration: 3 }, 82);
      tl.to(root, { backgroundColor: storyColor("learn", "#fffcf7"), duration: 8 }, 82);
      tl.to(q(".kc-feedback"), { autoAlpha: 1, duration: 1.5 }, 83);
      tl.to(feedbackPath, { opacity: 1, strokeDashoffset: 0, duration: 2 }, 84);
      tl.to(q(".kc-gap-result"), { opacity: 1, y: 0, duration: 1.5 }, 85);
      tl.to(q(".kc-gap-route"), { opacity: 1, y: 0, duration: 1.5 }, 87);
      tl.to(q(".kc-gap-answer"), { opacity: 1, y: 0, duration: 1.5 }, 89);
      tl.to(q(".kc-gap-answer"), { opacity: 0, y: -8, duration: 1 }, 92);
      tl.fromTo(
        q(".kc-new-proposal"),
        { autoAlpha: 0, y: 20, scale: 0.96 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 1.5, immediateRender: false },
        92,
      );
      tl.to(returnPath, { opacity: 1, strokeDashoffset: 0, duration: 1.5 }, 93);
      tl.to(
        q(".kc-new-proposal"),
        { x: -canvas.clientWidth * 0.12, y: -15, duration: 1.5 },
        94,
      );
      tl.to(
        [q(".kc-feedback"), q(".kc-new-proposal"), feedbackPath, returnPath],
        { autoAlpha: 0, duration: 1.5 },
        95,
      );
      tl.fromTo(
        card,
        layouts.learn,
        { ...finalFit, opacity: 1, duration: 2.5, immediateRender: false },
        95,
      );
      tl.to(
        all(".kc-proposal > :not(.kc-knowledge-top), .kc-status"),
        { opacity: 0, duration: 1.5 },
        95,
      );
      tl.fromTo(
        q(".kc-proposal"),
        { scale: 0.9 * contentScale, width: 100 / (0.9 * contentScale) + "%" },
        { scale: 1, width: "100%", duration: 2, immediateRender: false },
        95,
      );
      tl.fromTo(
        q(".kc-loop"),
        { autoAlpha: 0, scale: 0.94, y: 12 },
        { autoAlpha: 1, scale: 1, y: 0, duration: 2, immediateRender: false },
        96,
      );
      tl.to(q(".kc-progress"), { opacity: 0.45, duration: 2 }, 98);
      tl.to({}, { duration: 1 }, 99);
      const syncProgress = () => {
        const progress = tl.time() / 100;
        fill.style.transform = "scaleY(" + progress + ")";
        marker.style.transform = "translateY(" + progress * railHeight + "px)";
        const active = Math.max(
          0,
          stageTimes.findLastIndex((time) => tl.time() >= time),
        );
        railItems.forEach((node, i) => {
          node.dataset.state =
            i < active ? "complete" : i === active ? "active" : "upcoming";
        });
        number.textContent = "0" + (active + 1) + " / 06";
        root.dataset.storyStage = stageNames[active];
        root.dataset.storyProgress = String(progress);
      };
      tl.eventCallback("onUpdate", syncProgress);
      tl.pause(0);
      ScrollTrigger.create({
        id: "opryn-knowledge-centerpiece",
        trigger: track,
        start: "top 88px",
        end: "+=" + distance,
        animation: tl,
        scrub: 0.9,
        pin: stage,
        pinSpacing: false,
        anticipatePin: 1,
        // Layout snapshots are rebuilt together by the React resize lifecycle.
        // Re-invalidating mid-scroll would capture animated values as new starts.
        invalidateOnRefresh: false,
        onRefresh: (self) => {
          // Another lazy homepage section can refresh all triggers while this
          // scrub is catching up. Restore the real playhead, not a stale frame.
          cancelAnimationFrame(refreshFrame);
          refreshFrame = requestAnimationFrame(() => {
            if (disposed) return;
            self.getTween()?.pause();
            tl.totalProgress(self.progress);
            // Refresh restores animation progress with callbacks suppressed.
            // Sync the rail explicitly even when the playhead already matches.
            syncProgress();
          });
        },
        onToggle: (self) => {
          root.dataset.storyActive = String(self.isActive);
        },
      });
    });
  } catch (error) {
    cleanup();
    throw error;
  }
  void document.fonts.ready.then(() => {
    if (!disposed) ScrollTrigger.refresh();
  });
  function cleanup() {
    disposed = true;
    cancelAnimationFrame(refreshFrame);
    ctx.revert();
    splits.forEach((split) => split.revert());
    delete root.dataset.enhanced;
    root.style.removeProperty("--kc-content-scale");
    delete root.dataset.scrollDistance;
    delete root.dataset.storyLabels;
    delete root.dataset.storyStage;
    delete root.dataset.storyProgress;
    delete root.dataset.storyActive;
    track.style.removeProperty("--kc-distance");
    root
      .querySelectorAll<HTMLElement>(".kc-progress li")
      .forEach((node) => delete node.dataset.state);
  }
  return cleanup;
}
