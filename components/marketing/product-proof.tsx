"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/motion/gsap";
import "./product-proof.css";

const views = [
  {
    id: "teach",
    title: "Teach",
    copy: "Start with information your business already has.",
    alt: "Teach Opryn with choices to explain, upload files, choose Google files, or learn from calls.",
  },
  {
    id: "knowledge",
    title: "Knowledge",
    copy: "Know what’s approved, where it came from, and what needs attention.",
    alt: "Opryn Knowledge library with category navigation, source labels, and review status.",
  },
  {
    id: "needs-you",
    title: "Needs You",
    copy: "The decisions that need a person, ready for review.",
    alt: "Needs You decision queue showing a proposed revision policy ready to accept or edit.",
  },
  {
    id: "connections",
    title: "Connections",
    copy: "Bring knowledge in. Make approved guidance available elsewhere.",
    alt: "Opryn Connections manager with searchable integrations grouped by how they are used.",
  },
] as const;

export function ProductProof() {
  const [active, setActive] = useState(0);
  const root = useRef<HTMLElement>(null);
  const seek = useRef<((index: number) => void) | null>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    let disposed = false;
    let media: ReturnType<typeof gsap.matchMedia> | undefined;
    const observer = new IntersectionObserver(
      async (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        try {
          const { ScrollTrigger } = await import("gsap/ScrollTrigger");
          if (disposed) return;
          gsap.registerPlugin(ScrollTrigger);
          // Decode the selected responsive sources before layering them.
          const images = [...element.querySelectorAll<HTMLImageElement>("img")];
          await Promise.all(
            images.map((image) => {
              image.loading = "eager";
              return image.decode();
            }),
          );
          if (disposed) return;
          media = gsap.matchMedia();
          media.add(
            "(min-width: 1024px) and (min-height: 760px) and (prefers-reduced-motion: no-preference)",
            () => {
              element.dataset.scrollProof = "true";
              const slides = [
                ...element.querySelectorAll<HTMLElement>(".proof-slide"),
              ];
              const frame = element.querySelector<HTMLElement>(".proof-stage")!;
              slides.forEach((slide, index) =>
                slide.setAttribute("aria-hidden", String(index !== 0)),
              );
              const rail = element.querySelector(".proof-scroll-fill");
              const duration = 4;
              const timeline = gsap.timeline({
                scrollTrigger: {
                  id: "opryn-product-proof",
                  trigger: element.querySelector(".proof-track"),
                  start: "top 88px",
                  end: () =>
                    `+=${Math.round(Math.min(2400, innerHeight * 2.3))}`,
                  pin: frame,
                  scrub: 0.55,
                  anticipatePin: 1,
                  invalidateOnRefresh: true,
                },
                onUpdate() {
                  const current = Math.min(3, Math.floor(timeline.time()));
                  setActive((previous) =>
                    previous === current ? previous : current,
                  );
                  slides.forEach((slide, i) => {
                    slide.setAttribute("aria-hidden", String(i !== current));
                  });
                },
              });
              gsap.set(slides.slice(1), {
                clipPath: "inset(100% 0% 0% 0%)",
                y: 28,
              });
              slides.forEach((slide, index) => {
                timeline.addLabel(views[index].id, index);
                if (index) {
                  timeline.to(
                    slides[index - 1],
                    {
                      y: -20,
                      opacity: 0.35,
                      duration: 0.55,
                      ease: "power2.inOut",
                    },
                    index - 0.45,
                  );
                  timeline.to(
                    slide,
                    {
                      clipPath: "inset(0% 0% 0% 0%)",
                      y: 0,
                      duration: 0.55,
                      ease: "power2.inOut",
                    },
                    index - 0.45,
                  );
                }
              });
              timeline.fromTo(
                rail,
                { scaleX: 0 },
                { scaleX: 1, duration, ease: "none" },
                0,
              );
              seek.current = (index) => {
                const trigger = timeline.scrollTrigger!;
                window.scrollTo({
                  top:
                    trigger.start +
                    ((index + 0.35) / duration) * (trigger.end - trigger.start),
                  behavior: "instant",
                });
              };
              ScrollTrigger.refresh();
              return () => {
                seek.current = null;
                delete element.dataset.scrollProof;
                slides.forEach((slide) => slide.removeAttribute("aria-hidden"));
              };
            },
            element,
          );
          media.add(
            "(max-width: 1023px) and (prefers-reduced-motion: no-preference)",
            () => {
              element.querySelectorAll(".proof-slide").forEach((slide) => {
                gsap.fromTo(
                  slide.querySelector(".proof-image"),
                  { clipPath: "inset(7% 0% 0% 0%)", y: 16 },
                  {
                    clipPath: "inset(0% 0% 0% 0%)",
                    y: 0,
                    duration: 0.55,
                    ease: "power2.out",
                    scrollTrigger: {
                      trigger: slide,
                      start: "top 80%",
                      once: true,
                    },
                  },
                );
              });
            },
            element,
          );
        } catch {
          // The full HTML sequence remains readable if images or motion fail.
          media?.revert();
        }
      },
      { rootMargin: "800px" },
    );
    observer.observe(element);
    return () => {
      disposed = true;
      observer.disconnect();
      media?.revert();
    };
  }, []);
  return (
    <section
      ref={root}
      className="product-proof"
      id="inside-opryn"
      aria-labelledby="product-proof-title"
    >
      <div className="story-shell">
        <header className="proof-heading">
          <div>
            <p className="editorial-label">The product, not a promise</p>
            <h2 id="product-proof-title">Inside Opryn.</h2>
          </div>
          <p>
            Actual interface. Example workspace.
            <br />
            No customer data or results shown.
          </p>
        </header>
        <div className="proof-track">
          <div className="proof-stage">
            <nav
              className="public-tabs proof-steps"
              aria-label="Inside Opryn views"
            >
              {views.map((item, index) => (
                <button
                  key={item.id}
                  id={`proof-tab-${item.id}`}
                  aria-current={active === index ? "step" : undefined}
                  onClick={() => seek.current?.(index)}
                >
                  {item.title}
                </button>
              ))}
            </nav>
            <div className="proof-scroll-rail" aria-hidden="true">
              <span className="proof-scroll-fill" />
            </div>
            <div className="proof-slides">
              {views.map((view, index) => (
                <figure
                  className="proof-slide"
                  key={view.id}
                  id={`proof-${view.id}`}
                >
                  <figcaption className="proof-caption">
                    <span className="proof-view-label">
                      0{index + 1} / {view.title}
                    </span>
                    {view.copy}
                  </figcaption>
                  <picture className="proof-image">
                    <source
                      media="(max-width: 600px)"
                      srcSet={`/product-proof/${view.id}-390-retina.webp`}
                      width={390}
                      height={800}
                    />
                    <Image
                      src={`/product-proof/${view.id}-1180-retina.webp`}
                      alt={view.alt}
                      width={1180}
                      height={800}
                      unoptimized
                    />
                  </picture>
                </figure>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
