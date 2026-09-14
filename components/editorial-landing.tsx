import Link from "next/link";

const interruptions = [
  ["9:14", "How do I create a new customer?"],
  ["9:37", "Can I give them a discount?"],
  ["10:08", "Where is the vendor spreadsheet?"],
  ["10:42", "What do we do when an invoice is overdue?"],
];

export function ManifestoBreak() {
  return (
    <section id="why-opryn" className="opryn-manifesto text-white">
      <div className="container-shell">
        <p className="manifesto-kicker">The real bottleneck</p>
        <h2 className="manifesto-title">
          <span>Your business already has a system.</span>
          <strong>Right now, that system is you.</strong>
        </h2>
        <div className="manifesto-footer">
          <p>
            Opryn turns the way you work into answers your team can use—without
            waiting for you to stop what you&apos;re doing.
          </p>
          <div className="manifesto-sequence" aria-label="How Opryn works">
            <span>Teach it</span>
            <i aria-hidden="true" />
            <span>Approve it</span>
            <i aria-hidden="true" />
            <span>Hand it off</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ProblemEditorial() {
  return (
    <section className="editorial-section border-y border-[#e4e8ee] bg-[#f7f8fa]">
      <div className="container-shell grid gap-16 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:gap-24">
        <div>
          <p className="editorial-index">The problem / 01</p>
          <h2 className="editorial-title mt-5">
            You hired help. Why are you still doing everything?
          </h2>
          <p className="mt-7 max-w-[560px] text-lg leading-8 text-[#5f6b7d]">
            Most small businesses do not have an information problem. They have
            a transfer problem. The useful details are still trapped in the
            owner&apos;s memory, inbox, texts, spreadsheets, and habits.
          </p>
          <blockquote className="mt-9 max-w-[560px] border-l-2 border-[#163f98] pl-5 text-2xl font-medium leading-9 tracking-[-.025em] text-[#202b3e]">
            “It&apos;s easier if I just do it myself” is not a people problem.
            It is a system that has not been handed off yet.
          </blockquote>
        </div>
        <div className="border-y border-[#ccd4df] bg-white">
          <div className="flex items-center justify-between border-b border-[#e2e6ec] px-5 py-4">
            <span className="text-xs font-semibold text-[#344052]">Today</span>
            <span className="text-[10px] font-bold uppercase tracking-[.12em] text-[#b34c54]">
              Four interruptions
            </span>
          </div>
          {interruptions.map(([time, question], index) => (
            <div
              key={time}
              className="interruption-row grid grid-cols-[50px_1fr] gap-4 border-b border-[#e7eaef] px-5 py-5 last:border-b-0 sm:grid-cols-[70px_1fr]"
            >
              <span className="font-mono text-[11px] text-[#9099a6]">
                {time}
              </span>
              <div>
                <p className="text-sm font-medium leading-6 text-[#303c4f]">
                  “{question}”
                </p>
                <p className="mt-1 text-[10px] text-[#98a0ab]">
                  {index % 2 ? "Office" : "Customer service"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ProductStory() {
  return (
    <section id="how-it-works" className="editorial-section bg-[#fffdf9]">
      <div className="container-shell">
        <div className="grid gap-10 lg:grid-cols-[.7fr_1.3fr] lg:items-end">
          <div>
            <p className="editorial-index">How it works / 02</p>
            <h2 className="editorial-title mt-5">
              Do the work. Explain the parts that matter.
            </h2>
          </div>
          <p className="max-w-[680px] text-lg leading-8 text-[#606b7c] lg:justify-self-end">
            Opryn turns a normal explanation into something your team can
            follow. You review every rule before it becomes a company answer.
          </p>
        </div>

        <div className="opryn-workbench mt-14 overflow-hidden border border-[#cfd6df] bg-white">
          <div className="grid border-b border-[#dde2e8] md:grid-cols-[.72fr_1.28fr]">
            <div className="border-b border-[#dde2e8] p-6 md:border-b-0 md:border-r sm:p-8">
              <p className="workbench-label">Owner explanation</p>
              <h3 className="mt-4 text-2xl font-semibold tracking-[-.035em]">
                New customer intake
              </h3>
              <p className="mt-5 text-sm leading-7 text-[#667184]">
                “First search by phone number so we don&apos;t create a
                duplicate. Then check whether they have an unpaid balance before
                offering a date.”
              </p>
              <div
                className="mt-8 flex h-12 items-end gap-[4px] border-y border-[#e6e9ee] py-3"
                aria-label="Recorded voice waveform"
              >
                {Array.from({ length: 42 }).map((_, index) => (
                  <i
                    key={index}
                    className="opryn-wave-bar w-[2px] rounded-full bg-[#163f98]"
                    style={{
                      height: `${4 + ((index * 13) % 23)}px`,
                      opacity: 0.35 + ((index * 7) % 6) / 10,
                      animationDelay: `${-((index % 9) * 0.13)}s`,
                    }}
                  />
                ))}
                <span className="ml-auto self-center font-mono text-[10px] text-[#8c95a2]">
                  02:14
                </span>
              </div>
            </div>
            <div className="p-6 sm:p-8">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="workbench-label">Ready for your review</p>
                  <h3 className="mt-3 text-xl font-semibold">
                    New Customer Intake
                  </h3>
                </div>
                <span className="opryn-state opryn-state-review">
                  Needs review
                </span>
              </div>
              <ol className="mt-7 border-t border-[#dfe4ea]">
                {[
                  [
                    "01",
                    "Search for an existing customer",
                    "Use phone number before name or email.",
                  ],
                  [
                    "02",
                    "Check the account balance",
                    "An overdue balance changes what happens next.",
                  ],
                  [
                    "03",
                    "Create the service request",
                    "Confirm the address and preferred appointment window.",
                  ],
                ].map(([number, title, detail]) => (
                  <li
                    key={number}
                    className="grid gap-3 border-b border-[#e4e8ed] py-4 sm:grid-cols-[42px_1fr]"
                  >
                    <span className="font-mono text-[11px] text-[#163f98]">
                      {number}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[#2b3649]">
                        {title}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#737e8e]">
                        {detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <div className="grid md:grid-cols-[1fr_auto] md:items-center">
            <div className="p-6 sm:p-8">
              <p className="workbench-label">One detail is still missing</p>
              <p className="mt-2 text-base font-semibold text-[#263247]">
                Who can approve a customer with an overdue balance?
              </p>
            </div>
            <div className="border-t border-[#dde2e8] px-6 py-5 md:border-l md:border-t-0 sm:px-8">
              <span className="inline-flex rounded-lg bg-[#163f98] px-4 py-2.5 text-xs font-semibold text-white">
                Answer and approve
              </span>
            </div>
          </div>
        </div>

        <div className="mt-10 grid border-y border-[#d8dee6] md:grid-cols-3">
          {[
            ["01", "Teach", "Explain a real task in plain language."],
            ["02", "Review", "Correct anything that should not become policy."],
            [
              "03",
              "Hand it off",
              "Your team gets the approved answer next time.",
            ],
          ].map(([number, title, copy]) => (
            <div
              key={number}
              className="grid grid-cols-[44px_1fr] gap-4 border-b border-[#dfe4ea] py-7 md:border-b-0 md:border-r md:px-7 md:first:pl-0 md:last:border-r-0"
            >
              <span className="editorial-number">{number}</span>
              <div>
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="mt-1 text-xs leading-5 text-[#758091]">{copy}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const sources = [
  "Google Drive",
  "Documents",
  "Voice",
  "Video",
  "Calls",
  "Owner answers",
];

export function KnowledgeFlowEditorial() {
  return (
    <section className="editorial-section border-y border-[#e0e5eb] bg-[#f3f5f8]">
      <div className="container-shell">
        <div className="mx-auto max-w-[790px] text-center">
          <p className="editorial-index justify-center">
            One source of truth / 03
          </p>
          <h2 className="editorial-title mt-5">
            Bring in what your business already knows.
          </h2>
          <p className="mx-auto mt-6 max-w-[650px] text-lg leading-8 text-[#606c7e]">
            Opryn learns from the work already happening. Nothing becomes an
            official company answer until you say so.
          </p>
        </div>

        <div className="knowledge-map mx-auto mt-14 max-w-[980px]">
          <div className="grid grid-cols-2 border-y border-[#cdd5df] sm:grid-cols-3 lg:grid-cols-6">
            {sources.map((source, index) => (
              <div
                key={source}
                className="knowledge-source border-b border-r border-[#dce1e7] px-3 py-4 text-center text-xs font-medium text-[#4f5b6d] last:border-r-0 sm:border-b-0"
                style={{ animationDelay: `${index * 1.4}s` }}
              >
                {source}
              </div>
            ))}
          </div>
          <div className="knowledge-spine" aria-hidden="true" />
          <div className="mx-auto grid max-w-[700px] border border-[#cfd7e1] bg-white sm:grid-cols-[1fr_1px_1fr]">
            <div className="p-7 text-center">
              <p className="workbench-label">Opryn noticed</p>
              <p className="mt-3 text-3xl font-semibold tracking-[-.05em]">
                12
              </p>
              <p className="mt-1 text-xs text-[#798494]">
                items waiting for review
              </p>
            </div>
            <div className="hidden bg-[#dfe4ea] sm:block" />
            <div className="p-7 text-center">
              <p className="workbench-label text-[#177257]">You approved</p>
              <p className="mt-3 text-3xl font-semibold tracking-[-.05em]">
                126
              </p>
              <p className="mt-1 text-xs text-[#798494]">
                trusted knowledge items
              </p>
            </div>
          </div>
          <div className="knowledge-spine" aria-hidden="true" />
          <div className="mx-auto grid max-w-[700px] grid-cols-2 border-y border-[#cdd5df]">
            <div className="border-r border-[#d8dee6] py-5 text-center">
              <p className="text-sm font-semibold">Employees</p>
              <p className="mt-1 text-xs text-[#788393]">Ask Opryn</p>
            </div>
            <div className="py-5 text-center">
              <p className="text-sm font-semibold">Connected tools</p>
              <p className="mt-1 text-xs text-[#788393]">API and MCP</p>
            </div>
          </div>
        </div>
        <p className="mx-auto mt-10 max-w-[720px] text-center text-lg font-medium leading-8 text-[#283448]">
          Teach Opryn once. Let your team and the tools they use learn from the
          same approved source of truth.
        </p>
      </div>
    </section>
  );
}

export function AnswerOnceEditorial() {
  return (
    <section className="editorial-section bg-[#081a36] text-white">
      <div className="container-shell grid gap-14 lg:grid-cols-[.72fr_1.28fr] lg:items-center lg:gap-24">
        <div>
          <p className="editorial-index text-[#91a7f4]">
            The learning loop / 04
          </p>
          <h2 className="editorial-title mt-5 text-white">
            Answer a question once.
          </h2>
          <p className="mt-6 max-w-[470px] text-lg leading-8 text-[#aab4c4]">
            When Opryn does not know, it asks you. Your answer can become an
            approved rule, so the same interruption does not come back tomorrow.
          </p>
        </div>
        <div className="border border-white/15 bg-[#162238]">
          <div className="border-b border-white/10 p-5 sm:p-7">
            <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8390a4]">
              Sarah · Customer service
            </p>
            <p className="mt-3 max-w-[520px] text-base leading-7">
              Can we let a customer pay 50% now and 50% after the job?
            </p>
          </div>
          <div className="grid sm:grid-cols-2">
            <div className="border-b border-white/10 p-5 sm:border-b-0 sm:border-r sm:p-7">
              <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#91a7f4]">
                Opryn asked you
              </p>
              <p className="mt-3 text-sm leading-6 text-[#c0c9d7]">
                “Yes, but only for jobs over $5,000.”
              </p>
            </div>
            <div className="p-5 sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8fc9b4]">
                  Ready to remember
                </p>
                <span className="opryn-state opryn-state-approved">
                  Approved
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6">
                Split payments are allowed on jobs over $5,000.
              </p>
            </div>
          </div>
          <div className="border-t border-white/10 px-5 py-4 text-xs font-medium text-[#93a0b3] sm:px-7">
            Next time, Opryn answers automatically.
          </div>
        </div>
      </div>
    </section>
  );
}

export function OwnerViewEditorial() {
  return (
    <section id="product" className="editorial-section bg-[#fffdf9]">
      <div className="container-shell">
        <div className="max-w-[760px]">
          <p className="editorial-index">Owner view / 05</p>
          <h2 className="editorial-title mt-5">
            See what Opryn handled. Review only what still needs you.
          </h2>
        </div>
        <div className="opryn-dashboard mt-14 overflow-hidden border border-[#cfd6df] bg-white">
          <div className="grid lg:grid-cols-[1.2fr_.8fr]">
            <div className="border-b border-[#dfe4ea] p-6 lg:border-b-0 lg:border-r sm:p-9">
              <div className="grid gap-8 sm:grid-cols-[1fr_auto] sm:items-start">
                <div>
                  <p className="workbench-label">Handled for you this week</p>
                  <p className="mt-3 text-6xl font-semibold tracking-[-.07em]">
                    47
                  </p>
                  <p className="mt-2 text-sm text-[#667184]">
                    employee questions answered
                  </p>
                </div>
                <div className="border-l border-[#dfe4ea] pl-7">
                  <p className="workbench-label">Estimated time returned</p>
                  <p className="mt-3 text-3xl font-semibold tracking-[-.05em]">
                    4h 18m
                  </p>
                </div>
              </div>
              <div className="mt-10 border-t border-[#dfe4ea]">
                {[
                  ["Refund policy", "12 answers", "Customer support"],
                  ["Scheduling", "9 answers", "Office"],
                  ["Commercial deposits", "7 answers", "Sales"],
                ].map(([topic, count, role]) => (
                  <div
                    key={topic}
                    className="grid grid-cols-[1fr_auto] gap-5 border-b border-[#e5e9ee] py-4"
                  >
                    <div>
                      <p className="text-sm font-semibold">{topic}</p>
                      <p className="mt-1 text-[11px] text-[#818b99]">
                        Used by {role}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-[#163f98]">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-[#f7f8fa] p-6 sm:p-9">
              <div className="flex items-end justify-between border-b border-[#dce2e8] pb-5">
                <div>
                  <p className="workbench-label text-[#a36419]">Needs you</p>
                  <p className="mt-2 text-4xl font-semibold tracking-[-.06em]">
                    3
                  </p>
                </div>
                <Link
                  href="/signup"
                  className="text-xs font-semibold text-[#163f98]"
                >
                  Review items →
                </Link>
              </div>
              <div className="py-6">
                <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8b95a3]">
                  Teach next
                </p>
                <h3 className="mt-3 text-xl font-semibold tracking-[-.03em]">
                  Refund exceptions
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#697588]">
                  Your team asked about this eight times. A short answer could
                  remove the next eight interruptions.
                </p>
                <Link
                  href="/signup"
                  className="mt-6 inline-flex border-b border-[#163f98] pb-1 text-sm font-semibold text-[#163f98]"
                >
                  Teach Opryn
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function GrowthEditorial() {
  const stages = [
    [
      "01",
      "Hiring your first employee",
      "Everything still lives in your head. Capture the answers before every handoff becomes another full-time job.",
    ],
    [
      "02",
      "Building a real team",
      "Questions and decisions still come back to you. Give people a reliable place to look first.",
    ],
    [
      "03",
      "Stepping out of daily operations",
      "See which parts of the business still rely on you and teach the gaps one at a time.",
    ],
  ];
  return (
    <section
      id="who-its-for"
      className="editorial-section border-y border-[#e0e5eb] bg-[#f4f6f8]"
    >
      <div className="container-shell grid gap-14 lg:grid-cols-[.72fr_1.28fr] lg:gap-24">
        <div>
          <p className="editorial-index">Built for the handoff</p>
          <h2 className="editorial-title mt-5">
            For the moment your business outgrows one person.
          </h2>
        </div>
        <div className="border-t border-[#cdd5df]">
          {stages.map(([number, title, copy]) => (
            <div
              key={number}
              className="grid gap-4 border-b border-[#d4dbe3] py-8 sm:grid-cols-[54px_220px_1fr] sm:gap-7"
            >
              <span className="editorial-number">{number}</span>
              <h3 className="text-base font-semibold leading-6">{title}</h3>
              <p className="text-sm leading-6 text-[#687487]">{copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PricingEditorial() {
  return (
    <section id="pricing" className="editorial-section bg-[#fffdf9]">
      <div className="container-shell">
        <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
          <div>
            <p className="editorial-index">Pricing</p>
            <h2 className="editorial-title mt-5">Choose how Opryn learns.</h2>
          </div>
          <p className="max-w-[610px] text-lg leading-8 text-[#606c7e] lg:justify-self-end">
            Core gives your team approved company answers. Premium adds learning
            from video, screen recordings, and calls.
          </p>
        </div>
        <div className="mt-14 overflow-hidden border-y border-[#cbd3dd]">
          <div className="grid lg:grid-cols-2">
            <Plan
              name="Core"
              price="$99"
              copy="For owners starting to get knowledge out of their head."
              features={[
                "Ask Opryn and employee Q&A",
                "Up to 5 employees",
                "Text, voice, documents, and Google Drive",
                "Processes, roles, and AI connections",
              ]}
            />
            <Plan
              name="Premium"
              price="$249"
              copy="For owners who want Opryn learning from work as it happens."
              features={[
                "Everything in Core",
                "Up to 20 employees",
                "Video and screen-recording learning",
                "Call learning and advanced insights",
              ]}
              featured
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Plan({
  name,
  price,
  copy,
  features,
  featured = false,
}: {
  name: string;
  price: string;
  copy: string;
  features: string[];
  featured?: boolean;
}) {
  return (
    <article
      className={`p-7 sm:p-10 ${featured ? "border-t border-[#cbd3dd] bg-[#f2f5ff] lg:border-l lg:border-t-0" : ""}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">Opryn {name}</p>
          <p className="mt-4 text-5xl font-semibold tracking-[-.06em]">
            {price}
            <span className="ml-1 text-sm font-normal tracking-normal text-[#7b8594]">
              /month
            </span>
          </p>
        </div>
        {featured ? (
          <span className="text-[10px] font-bold uppercase tracking-[.12em] text-[#177257]">
            Recommended
          </span>
        ) : null}
      </div>
      <p className="mt-5 max-w-[460px] text-sm leading-6 text-[#667184]">
        {copy}
      </p>
      <ul className="mt-8 border-t border-[#d7dde5]">
        {features.map((feature) => (
          <li
            key={feature}
            className="border-b border-[#dce2e8] py-3 text-sm text-[#3f4b5e]"
          >
            {feature}
          </li>
        ))}
      </ul>
      <Link
        href="/pricing"
        className={`mt-8 inline-flex min-h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold ${featured ? "bg-[#163f98] text-white" : "border border-[#cbd3dd] bg-white text-[#2f3b4e]"}`}
      >
        View {name}
      </Link>
    </article>
  );
}

export function FinalEditorial() {
  return (
    <section className="border-t border-[#243047] bg-[#081a36] py-24 text-white sm:py-32">
      <div className="container-shell text-center">
        <p className="mx-auto max-w-[940px] text-[clamp(38px,6vw,76px)] font-semibold leading-[1.02] tracking-[-.06em]">
          Stop being the only person who knows how your business works.
        </p>
        <p className="mx-auto mt-7 max-w-[580px] text-lg leading-8 text-[#aab4c4]">
          Build the systems today that let someone else help you tomorrow.
        </p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/signup" className="button button-primary">
            Start teaching Opryn <span aria-hidden="true">→</span>
          </Link>
          <Link
            href="/pricing"
            className="button border border-white/20 bg-transparent text-white hover:bg-white/5"
          >
            View pricing
          </Link>
        </div>
      </div>
    </section>
  );
}
