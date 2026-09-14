import Link from "next/link";
import { PLAN_DETAILS, PLAN_FEATURES } from "@/lib/billing/plans";

export function LaunchTrust() {
  return (
    <section className="launch-trust">
      <div className="story-shell">
        <h2>Built to know what it knows.</h2>
        <div className="launch-three">
          <div>
            <h3>Approved knowledge</h3>
            <p>Your business confirmed it.</p>
          </div>
          <div>
            <h3>Source-backed answers</h3>
            <p>See where important answers came from.</p>
          </div>
          <div>
            <h3>Asks when unsure</h3>
            <p>
              Missing guidance should reach a person—not become invented company
              policy.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LaunchPricing() {
  return (
    <section className="launch-pricing">
      <div className="story-shell">
        <h2>One company memory. Two ways to build it.</h2>
        <div className="launch-two">
          <article>
            <h3>Core</h3>
            <p>Build and use your company knowledge.</p>
            <strong className="launch-price">
              <span>${PLAN_DETAILS.core.monthlyPrice}</span>
              <small>/month</small>
            </strong>
            <p>
              Ask Opryn, processes, training, documents, voice/text learning,
              and the Agent API.
            </p>
            <p>One owner + up to {PLAN_FEATURES.core.teamLimit} employees.</p>
            <Link href="/pricing">Explore Core →</Link>
          </article>
          <article>
            <h3>Premium</h3>
            <p>Learn from more sources. Connect deeper into AI.</p>
            <strong className="launch-price">
              <span>${PLAN_DETAILS.premium.monthlyPrice}</span>
              <small>/month</small>
            </strong>
            <p>
              Everything in Core, plus call/video learning, screen recordings,
              ChatGPT, Claude, and remote MCP.
            </p>
            <p>
              One owner + up to {PLAN_FEATURES.premium.teamLimit} employees.
            </p>
            <Link href="/pricing">Explore Premium →</Link>
          </article>
        </div>
        <p className="launch-fine">
          USD, monthly billing. Onboarding offers an eligible 5-day trial once
          per organization. Pending invites count toward seats.{" "}
          <Link href="/pricing">See annual billing and full plan details</Link>.{" "}
          <Link href="/contact">Contact us for larger teams</Link>.
        </p>
      </div>
    </section>
  );
}

export function LaunchClosing() {
  return (
    <section className="launch-closing" id="security">
      <div className="story-shell">
        <div className="launch-two">
          <div>
            <h2>Know what you’re connecting.</h2>
            <p>
              Organization access, reviewable knowledge, and clearly described
              data handling. No invented certifications.
            </p>
            <Link href="/security">How Opryn handles your data →</Link>
          </div>
          <div>
            <h2>Become an early Opryn customer.</h2>
            <p>
              Bring a real workflow. Help shape a product built for day-to-day
              business knowledge.
            </p>
            <Link href="/signup">Get Started →</Link>
            <p>
              <Link href="/contact">Or talk to us first</Link>
            </p>
          </div>
        </div>
        <div className="launch-faq">
          <h2>A few things worth knowing.</h2>
          {[
            [
              "Does Opryn build my AI agent?",
              "No. Keep the AI tools and agents you already use. Opryn gives authorized systems access to approved company context through supported connections.",
            ],
            [
              "Does connecting ChatGPT or Claude import every conversation?",
              "No. Learning uses context you explicitly ask the client to share. Historical material must be provided through supported imports, uploads, or copied context.",
            ],
            [
              "What happens if Opryn does not know?",
              "Opryn can ask for owner or expert guidance rather than invent an undocumented company policy. New findings remain reviewable; your business controls what becomes approved.",
            ],
            [
              "Can I start without connecting another tool?",
              "Yes. Start with text, voice, or a document. Review a useful finding, then ask a real question.",
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
