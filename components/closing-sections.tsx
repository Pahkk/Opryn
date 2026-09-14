"use client";

import {
  ArrowRight,
  Check,
  ChevronDown,
  Minus,
  UserPlus,
  Users,
  Workflow,
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { CheckItem, SectionIntro } from "./ui";

const audiences = [
  [
    UserPlus,
    "Hiring your first employee",
    "You finally need help, but everything still lives in your head.",
  ],
  [
    Users,
    "Building a team",
    "You have employees, but every question and decision still comes back to you.",
  ],
  [
    Workflow,
    "Removing yourself from operations",
    "You want managers and employees to run day-to-day operations without requiring your constant involvement.",
  ],
];

export function Audience() {
  return (
    <section id="who-its-for" className="section section-wash">
      <div className="container-shell">
        <SectionIntro
          label="Who it's for"
          title="Built for the moment your business outgrows one person."
          center
        />
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {audiences.map(([Icon, title, copy], i) => (
            <article
              key={title as string}
              className="audience-card reveal soft-card group relative overflow-hidden p-7 transition-all hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(22,36,65,.09)]"
            >
              {i === 1 ? (
                <span className="absolute right-5 top-5 rounded-full bg-[#eaf7f1] px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-[#177257]">
                  Recommended
                </span>
              ) : null}
              <span className="grid size-11 place-items-center rounded-xl bg-[#edf2ff] text-[#3158d8] transition-transform group-hover:scale-105">
                <Icon size={19} />
              </span>
              <p className="mt-8 font-mono text-[10px] font-semibold text-[#9aa3af]">
                0{i + 1}
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-[-.03em]">
                {title as string}
              </h3>
              <p className="mt-3 text-sm leading-6 text-[#687487]">
                {copy as string}
              </p>
              <div className="mt-7 flex items-center gap-2 text-xs font-semibold text-[#3158d8]">
                See how Opryn helps <ArrowRight size={13} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const before = [
  "Owner explains everything manually",
  "New hires constantly ask questions",
  "Processes live in people's heads",
  "Same questions get answered repeatedly",
  "New teammates depend on you",
  "Owner cannot disconnect",
  "Knowledge leaves when employees leave",
];
const after = [
  "Work is captured as it happens",
  "Employees get company-specific answers",
  "Knowledge becomes reusable",
  "Owner answers new questions once",
  "Roles have structured onboarding",
  "Knowledge gaps become visible",
  "The business becomes less owner-dependent",
];

export function Comparison() {
  return (
    <section className="section-tight bg-white">
      <div className="container-shell">
        <SectionIntro
          label="The shift"
          title="From constant interruption to a team that can move."
          copy="Opryn turns the knowledge already inside your business into a system your team can rely on."
          center
        />
        <div className="reveal mt-12 grid overflow-hidden rounded-[26px] border border-[#dfe5ec] shadow-[0_24px_65px_rgba(21,34,58,.08)] lg:grid-cols-2">
          <div className="bg-[#f6f7f9] p-7 sm:p-10">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#657083]">
              <Minus size={16} /> Without Opryn
            </div>
            <ul className="mt-7 space-y-4">
              {before.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-3 text-sm text-[#586476]"
                >
                  <span className="size-1.5 rounded-full bg-[#aeb6c1]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative bg-[#14213a] p-7 text-white sm:p-10">
            <div className="absolute inset-y-0 left-0 w-px bg-[#3158d8]" />
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Check size={16} className="text-[#7da1ff]" /> With Opryn
            </div>
            <ul className="mt-7 space-y-4">
              {after.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-3 text-sm text-[#c5cedc]"
                >
                  <span className="grid size-4 place-items-center rounded-full bg-[#3158d8]">
                    <Check size={10} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

const plans = [
  {
    name: "Opryn Core",
    price: "99",
    copy: "Get company knowledge out of your head.",
    items: [
      "Up to 5 employees",
      "Ask Opryn and employee Q&A",
      "Text, audio, documents, and Drive imports",
      "External AI connections and secure API",
      "Processes, roles, and knowledge gaps",
    ],
  },
  {
    name: "Opryn Premium",
    price: "249",
    copy: "Let Opryn learn from how work actually happens.",
    items: [
      "Everything in Core",
      "Up to 20 employees",
      "Video and screen-recording learning",
      "Learn From Calls and advanced insights",
    ],
    featured: true,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="section pricing-section">
      <div className="container-shell">
        <SectionIntro
          label="Pricing"
          title="Get your time back."
          copy="Choose how much of the teaching and answering you want Opryn to handle."
          center
        />
        <div className="mx-auto mt-14 grid max-w-4xl items-stretch gap-5 lg:grid-cols-2">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`reveal relative flex flex-col rounded-[20px] border p-7 ${plan.featured ? "border-[#3158d8] bg-white shadow-[0_24px_60px_rgba(49,88,216,.13)] lg:-translate-y-3" : "border-[#dfe5ec] bg-white"}`}
            >
              {plan.featured && (
                <span className="absolute right-5 top-5 rounded-full bg-[#eaf7f1] px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-[#177257]">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="mt-2 min-h-[40px] text-sm leading-5 text-[#717c8c]">
                {plan.copy}
              </p>
              <div className="mt-6">
                <span className="text-4xl font-semibold tracking-[-.05em]">
                  ${plan.price}
                </span>
                <span className="text-sm text-[#7d8795]">/month</span>
              </div>
              <ul className="my-7 space-y-3">
                {plan.items.map((item) => (
                  <CheckItem key={item}>{item}</CheckItem>
                ))}
              </ul>
              <Link
                href="/pricing"
                className={`button mt-auto ${plan.featured ? "button-primary" : "button-secondary"}`}
              >
                {plan.featured ? "Start Premium" : "Start with Core"}
              </Link>
            </article>
          ))}
        </div>
        <p className="mt-8 text-center text-sm font-medium text-[#657184]">
          Upgrade at any time. Employees are included up to your plan limit.
        </p>
      </div>
    </section>
  );
}

const faqs = [
  [
    "Is this just SOP software?",
    "No. Opryn can generate processes, but the goal is to continuously learn how your company operates and help employees work without constantly relying on the owner.",
  ],
  [
    "Do I have to document everything myself?",
    "No. The goal is the opposite. Record yourself working normally and Opryn turns what you do into reusable company knowledge.",
  ],
  [
    "What happens when Opryn doesn't know the answer?",
    "It escalates the question to the appropriate person. Their answer can then become approved company knowledge.",
  ],
  [
    "Will AI make up answers?",
    "Opryn prioritizes approved company knowledge and shows the source behind answers. When confidence is insufficient, it asks rather than inventing company policy.",
  ],
  [
    "What kinds of businesses is Opryn for?",
    "Growing small businesses where important operational knowledge still lives with the owner or a small number of key employees.",
  ],
  [
    "Can I use Opryn before I hire someone?",
    "Yes. Capturing knowledge before hiring can make onboarding significantly easier.",
  ],
];

export function FAQ() {
  const [open, setOpen] = useState<number>(0);
  return (
    <section className="section bg-white">
      <div className="container-shell grid gap-12 lg:grid-cols-[.65fr_1.35fr] lg:gap-20">
        <SectionIntro
          label="FAQ"
          title="Questions owners usually ask."
          copy="Still wondering whether Opryn fits your business? Start here."
        />
        <div className="divide-y divide-[#e3e8ee] border-y border-[#e3e8ee]">
          {faqs.map(([question, answer], i) => {
            const active = open === i;
            return (
              <div key={question}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-5 py-5 text-left text-[15px] font-semibold"
                  onClick={() => setOpen(active ? -1 : i)}
                  aria-expanded={active}
                >
                  <span>{question}</span>
                  <ChevronDown
                    size={17}
                    className={`shrink-0 text-[#6d7888] transition-transform ${active ? "rotate-180" : ""}`}
                  />
                </button>
                <div
                  className={`grid transition-[grid-template-rows] duration-300 ${active ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                >
                  <div className="overflow-hidden">
                    <p className="max-w-[680px] pb-5 text-sm leading-7 text-[#687487]">
                      {answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function FinalCTA() {
  return (
    <section className="bg-[#0d1729] py-24 text-white">
      <div className="container-shell relative overflow-hidden rounded-[28px] border border-white/10 bg-[#14213a] px-6 py-16 text-center sm:px-12">
        <div className="pointer-events-none absolute left-1/2 top-[-180px] size-[450px] -translate-x-1/2 rounded-full bg-[#3158d8]/25 blur-[90px]" />
        <div className="relative">
          <p className="mb-6 text-xs font-bold uppercase tracking-[.16em] text-[#8fa6fa]">
            Your next chapter
          </p>
          <h2 className="mx-auto max-w-[850px] text-[clamp(36px,5vw,64px)] font-semibold leading-[1.02] tracking-[-.05em]">
            Stop being the only person who knows how your business works.
          </h2>
          <p className="mx-auto mt-6 max-w-[570px] text-lg leading-8 text-[#aeb8c7]">
            Build the systems today that let someone else help you tomorrow.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/signup" className="button button-primary">
              Start Building <ArrowRight size={15} />
            </Link>
            <Link
              href="/pricing"
              className="button border border-white/15 bg-white/5 text-white hover:bg-white/10"
            >
              View Pricing
            </Link>
          </div>
          <p className="mt-5 text-xs text-[#778397]">
            No credit card required.
          </p>
        </div>
      </div>
    </section>
  );
}
