"use client";

import { PublicAction, PublicReveal } from "./public-motion";
import "./home-motion.css";
import "./bright-home.css";
import { HomeIntegrations } from "./home-integrations";
import { KnowledgeHeroHeading, SharedKnowledgeDemo } from "./knowledge-layer";
import { LaunchPricing } from "./launch-sections";
import { MarketingProof } from "./marketing-proof";
import { KnowledgeCenterpiece } from "./knowledge-centerpiece";
import { ProductProof } from "./product-proof";
import { AnswerEverywhere } from "./answer-everywhere";
import {
  DirectionalLink,
  EditorialTrust,
} from "./editorial-sections";

export function StoryHome() {
  return (
    <main className="story-home editorial-home bright-home">
      <section className="editorial-hero" id="top">
        <div className="story-shell">
          <div className="editorial-hero-layout">
            <div className="editorial-hero-copy">
              <p className="editorial-label">
                Operational knowledge / People + AI
              </p>
              <KnowledgeHeroHeading />
              <p className="editorial-lede">
                Opryn turns your company’s processes, policies, and answers into
                approved knowledge your people and AI can use.
              </p>
              <div className="story-actions">
                <PublicAction href="/signup" rolling>
                  Get Started
                </PublicAction>
                <PublicAction href="#how-it-works" variant="secondary" rolling>
                  See How It Works
                </PublicAction>
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
        <AnswerEverywhere interfacePreview={<ProductProof />} />
      </div>

      <section className="editorial-integrations" id="integrations">
        <PublicReveal className="story-shell editorial-integrations-layout">
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
          <HomeIntegrations />
        </PublicReveal>
      </section>

      <PublicReveal>
        <EditorialTrust />
      </PublicReveal>
      <MarketingProof />
      <PublicReveal>
        <LaunchPricing />
      </PublicReveal>

      <section className="editorial-final">
        <PublicReveal className="story-shell">
          <p className="editorial-label">
            Less repeating. More useful knowledge.
          </p>
          <h2>
            Give your people and AI
            <br />a shared place to start.
          </h2>
          <p>Start with one useful process, policy, or answer.</p>
          <div className="story-actions">
            <PublicAction href="/signup" rolling>
              Get Started
            </PublicAction>
            <DirectionalLink href="/contact">Talk to us</DirectionalLink>
          </div>
        </PublicReveal>
      </section>
    </main>
  );
}
