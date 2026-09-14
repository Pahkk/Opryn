"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { gsap, motionScope } from "@/lib/motion/gsap";
import { motion } from "@/lib/motion/presets";
import { ProviderLogo } from "@/components/connections/provider-logo";
import { KnowledgeHeroHeading, SharedKnowledgeDemo } from "./knowledge-layer";
import { LaunchPricing } from "./launch-sections";
import { MarketingProof } from "./marketing-proof";
import { marketingIntegrations } from "@/lib/marketing/integrations";
import { KnowledgeCenterpiece, WhyOpryn } from "./knowledge-centerpiece";
import { ProductProof } from "./product-proof";
import {
  DirectionalLink,
  EditorialFeaturePanel,
  EditorialTrust,
} from "./editorial-sections";

export function StoryHome() {
  const rootRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const scope = motionScope(root);
    scope.run(() =>
      gsap.fromTo(
        root.querySelectorAll(
          ".editorial-hero-copy > *, .editorial-hero-layout > #product",
        ),
        { opacity: 0, y: 12 },
        {
          opacity: 1,
          y: 0,
          duration: motion.duration.emphasis,
          stagger: 0.07,
          ease: motion.ease.enter,
          clearProps: "opacity,transform",
        },
      ),
    );
    if (!("IntersectionObserver" in window)) return () => scope.dispose();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            scope.run(() => {
              gsap.fromTo(
                entry.target,
                { opacity: 0, y: 14 },
                {
                  opacity: 1,
                  y: 0,
                  duration: motion.duration.emphasis,
                  ease: motion.ease.enter,
                  clearProps: "opacity,transform",
                },
              );
              const paths = entry.target.querySelectorAll("path[pathLength]");
              if (paths.length)
                gsap.fromTo(
                  paths,
                  { strokeDasharray: 1, strokeDashoffset: 1 },
                  {
                    strokeDashoffset: 0,
                    duration: motion.duration.emphasis,
                    ease: motion.ease.enter,
                    clearProps: "strokeDasharray,strokeDashoffset",
                  },
                );
            });
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.05 },
    );
    root
      .querySelectorAll<HTMLElement>("[data-story-reveal]")
      .forEach((node) => observer.observe(node));
    return () => {
      observer.disconnect();
      scope.dispose();
    };
  }, []);

  return (
    <main className="story-home editorial-home" ref={rootRef}>
      <section className="editorial-hero" id="top">
        <div className="story-shell">
          <div className="editorial-hero-layout">
            <div className="editorial-hero-copy">
              <KnowledgeHeroHeading />
              <p className="editorial-lede">
                Opryn turns your company’s processes, policies, and answers into
                approved knowledge your people and AI can use.
              </p>
              <div className="story-actions">
                <Link
                  href="/signup"
                  className="story-button story-button-primary"
                >
                  Get Started <span aria-hidden="true">→</span>
                </Link>
                <a
                  href="#how-it-works"
                  className="story-button story-button-secondary"
                >
                  See How It Works
                </a>
              </div>
            </div>
            <div id="product">
              <SharedKnowledgeDemo />
            </div>
          </div>
        </div>
      </section>

      <KnowledgeCenterpiece />
      <div id="after-knowledge-story">
        <ProductProof />
      </div>
      <WhyOpryn />

      <section className="editorial-use-cases" id="team-knowledge">
        <div className="story-shell editorial-panels">
          <EditorialFeaturePanel
            title="For your people."
            description="Help new employees learn your processes and give your team a place to find approved answers."
            href="/signup"
            action="Explore team knowledge"
          />
          <EditorialFeaturePanel
            title="For your AI."
            description="Give your existing agents approved company context without maintaining separate knowledge bases."
            href="/ai"
            action="Explore AI connections"
            tint
          />
        </div>
      </section>

      <section className="editorial-integrations" id="integrations">
        <div className="story-shell editorial-integrations-layout">
          <header data-story-reveal>
            <p className="editorial-label">Bring your own tools</p>
            <h2>
              Context for the
              <br />
              tools you use.
            </h2>
            <p>
              Bring knowledge in. Use approved guidance in the tools your team
              already knows.
            </p>
            <DirectionalLink href="/integrations">
              Explore integrations
            </DirectionalLink>
          </header>
          <div className="integration-ledger" data-story-reveal>
            {marketingIntegrations
              .filter((p) =>
                ["google_drive", "slack", "chatgpt", "custom_agent"].includes(
                  p.id,
                ),
              )
              .map((integration) => (
                <div className="integration-ledger-row" key={integration.id}>
                  <ProviderLogo id={integration.id} name={integration.name} />
                  <div>
                    <strong>{integration.name}</strong>
                    <span>{integration.purpose}</span>
                  </div>
                  <span className="integration-status">
                    {integration.status}
                  </span>
                </div>
              ))}
            <DirectionalLink href="/integrations">
              All supported connections
            </DirectionalLink>
          </div>
        </div>
      </section>

      <EditorialTrust />
      <MarketingProof />
      <LaunchPricing />

      <section className="editorial-final">
        <div className="story-shell" data-story-reveal>
          <p className="editorial-label">
            Less repeating. More useful knowledge.
          </p>
          <h2>
            Give your people and AI
            <br />a shared place to start.
          </h2>
          <p>Start with one useful process, policy, or answer.</p>
          <div className="story-actions">
            <Link href="/signup" className="story-button story-button-primary">
              Get Started <span aria-hidden="true">→</span>
            </Link>
            <DirectionalLink href="/contact">Talk to us</DirectionalLink>
          </div>
        </div>
      </section>
    </main>
  );
}
