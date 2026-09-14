import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  ShieldCheck,
  Sun,
  UserCheck,
} from "lucide-react";
import { AppWindow, ProductButton, Progress, SectionIntro } from "./ui";

const roleGroups = [
  [
    "Core Responsibilities",
    [
      "Verify customer information",
      "Create service requests",
      "Confirm appointments",
    ],
  ],
  [
    "Recurring Tasks",
    [
      "Check voicemail",
      "Review today's appointments",
      "Send payment reminders",
    ],
  ],
];

export function RoleBuilder() {
  return (
    <section
      id="product"
      className="product-story section relative overflow-hidden bg-white"
    >
      <div className="pointer-events-none absolute left-[-220px] top-20 size-[440px] rounded-full bg-[#edf2ff] blur-[110px]" />
      <div className="container-shell relative grid items-center gap-14 lg:grid-cols-[.8fr_1.2fr] lg:gap-20">
        <div className="reveal">
          <SectionIntro
            label="Role builder"
            title="Train for the job, not for a folder of SOPs."
            copy="Opryn organizes knowledge around what a worker actually needs to know. No enormous manual to write, sort, and maintain."
          />
          <button className="button button-primary mt-7">
            Build a role <ArrowRight size={15} />
          </button>
        </div>
        <div className="reveal">
          <AppWindow label="Roles / Customer Service Assistant">
            <div className="grid md:grid-cols-[1fr_185px]">
              <div className="p-5 sm:p-6">
                <div className="mb-5 flex items-start justify-between">
                  <div>
                    <p className="app-kicker">Role playbook</p>
                    <h3 className="app-title mt-1 text-xl">
                      Customer Service Assistant
                    </h3>
                  </div>
                  <span className="tag">
                    <UserCheck size={11} /> Active role
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {roleGroups.map(([title, items]) => (
                    <div
                      key={title as string}
                      className="rounded-xl border border-[#e2e7ed] p-3"
                    >
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#788495]">
                        {title as string}
                      </p>
                      {(items as string[]).map((item) => (
                        <div
                          key={item}
                          className="flex items-center gap-2 py-1 text-[11px] text-[#445064]"
                        >
                          <CheckCircle2 size={12} className="text-[#1b8b69]" />
                          {item}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <aside className="border-t border-[#e5e9ef] bg-[#f8fafd] p-5 md:border-l md:border-t-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#788495]">
                  Knowledge ready
                </p>
                <p className="metric mt-2 text-2xl font-semibold">7 of 9</p>
                <p className="text-[10px] text-[#7c8796]">processes learned</p>
                <div className="my-4">
                  <Progress value={78} />
                </div>
                <div className="flex gap-2 text-[10px] text-[#526075]">
                  <Clock3 size={13} />
                  Estimated onboarding
                  <br />
                  2h 18m
                </div>
                <div className="my-5 border-t border-[#dfe5ec]" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#788495]">
                  Approval boundaries
                </p>
                {[
                  "Refund over $250",
                  "Discount over 10%",
                  "Cancel commercial account",
                ].map((i) => (
                  <div
                    key={i}
                    className="mt-2 flex gap-2 text-[10px] leading-4 text-[#526075]"
                  >
                    <ShieldCheck
                      size={12}
                      className="shrink-0 text-[#756b9a]"
                    />
                    {i}
                  </div>
                ))}
              </aside>
            </div>
          </AppWindow>
        </div>
      </div>
    </section>
  );
}

export function Independence() {
  return (
    <section className="section border-y border-[#e5eaf0] bg-[#f3f6fa]">
      <div className="container-shell">
        <SectionIntro
          label="Owner independence"
          title="See exactly where your business still depends on you."
          copy="Opryn shows what your team can run, where questions still surface, and which knowledge gaps are costing you time."
          center
        />
        <div className="reveal mt-14">
          <AppWindow label="Business health / Owner independence">
            <div className="p-5 sm:p-7">
              <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr_.9fr]">
                <div className="product-card">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="app-kicker">Owner independence</p>
                      <div className="mt-2">
                        <span className="metric text-5xl font-semibold">
                          73
                        </span>
                        <span className="text-sm text-[#9aa3af]"> / 100</span>
                      </div>
                    </div>
                    <div
                      className="grid size-20 place-items-center rounded-full"
                      style={{
                        background: "conic-gradient(#3158d8 73%, #e9edf2 0)",
                      }}
                    >
                      <div className="grid size-[62px] place-items-center rounded-full bg-white text-xs font-semibold text-[#3158d8]">
                        Strong
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 grid grid-cols-3 gap-2 text-[10px]">
                    <Status
                      title="Fully delegated"
                      items={[
                        "Scheduling",
                        "Customer intake",
                        "Routine invoicing",
                      ]}
                      color="#1b8b69"
                    />
                    <Status
                      title="Needs work"
                      items={["Vendor ordering", "Complaints"]}
                      color="#756b9a"
                    />
                    <Status
                      title="Bottlenecks"
                      items={["Payroll issues", "Large refunds"]}
                      color="#c14c55"
                    />
                  </div>
                </div>
                <div className="product-card">
                  <p className="app-kicker">This month</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {[
                      ["54", "Employee questions"],
                      ["39", "Answered by Opryn"],
                      ["72%", "Interruptions avoided"],
                      ["8.4h", "Estimated time saved"],
                    ].map(([num, label]) => (
                      <div key={label} className="rounded-xl bg-[#f7f9fc] p-3">
                        <p className="metric text-xl font-semibold">{num}</p>
                        <p className="mt-1 text-[9px] leading-4 text-[#7a8595]">
                          {label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="product-card flex flex-col">
                  <p className="app-kicker">Biggest knowledge gap</p>
                  <div className="my-auto py-6">
                    <span className="grid size-10 place-items-center rounded-xl bg-[#f0eef6] text-[#756b9a]">
                      <AlertCircle size={18} />
                    </span>
                    <h4 className="mt-3 font-semibold">Vendor Purchasing</h4>
                    <p className="mt-2 text-[11px] leading-5 text-[#6e7989]">
                      Only one person currently understands this process.
                    </p>
                  </div>
                  <ProductButton>Capture process</ProductButton>
                </div>
              </div>
            </div>
          </AppWindow>
        </div>
      </div>
    </section>
  );
}

function Status({
  title,
  items,
  color,
}: {
  title: string;
  items: string[];
  color: string;
}) {
  return (
    <div>
      <div
        className="mb-2 flex items-center gap-1.5 font-semibold"
        style={{ color }}
      >
        <Circle size={7} fill="currentColor" />
        {title}
      </div>
      {items.map((i) => (
        <p className="mb-1 text-[#667183]" key={i}>
          {i}
        </p>
      ))}
    </div>
  );
}

export function VacationReadiness() {
  const items = [
    ["Customer service", "green"],
    ["Scheduling", "green"],
    ["Job management", "green"],
    ["Invoicing", "green"],
    ["Vendor purchasing", "amber"],
    ["Payroll issue escalation", "red"],
  ] as const;
  return (
    <section className="section bg-white">
      <div className="container-shell grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <div className="reveal order-2 lg:order-1">
          <div className="vacation-card mx-auto max-w-[520px] rounded-[26px] border border-[#dee4eb] bg-[#f9fafc] p-5 shadow-[0_24px_60px_rgba(22,34,58,.09)] sm:p-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="app-kicker">Vacation readiness</p>
                <p className="mt-2 text-3xl font-semibold tracking-[-.04em]">
                  82% Ready
                </p>
              </div>
              <span className="grid size-12 place-items-center rounded-full bg-[#f0eef6] text-[#756b9a]">
                <Sun size={23} />
              </span>
            </div>
            <div className="my-6 h-2 rounded-full bg-[#e8ecf1]">
              <div className="h-full w-[82%] rounded-full bg-gradient-to-r from-[#245fc9] to-[#4c8ee2]" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {items.map(([label, tone]) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-lg border border-[#e4e8ed] bg-white px-3 py-2.5 text-[11px] font-medium text-[#465266]"
                >
                  <span
                    className={`size-2 rounded-full ${tone === "green" ? "bg-[#1b8b69]" : tone === "amber" ? "bg-[#756b9a]" : "bg-[#c14c55]"}`}
                  />
                  {label}
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-col items-start justify-between gap-3 rounded-xl border border-[#d9d4e7] bg-[var(--opryn-amber-surface)] p-4 sm:flex-row sm:items-center">
              <p className="text-xs font-medium leading-5 text-[#775a24]">
                Resolve 2 knowledge gaps before leaving for 7 days.
              </p>
              <ProductButton>View gaps</ProductButton>
            </div>
          </div>
        </div>
        <div className="reveal order-1 lg:order-2">
          <SectionIntro
            label="Vacation readiness"
            title="Could your business run for a week without you?"
          />
          <p className="lead mt-6">
            Opryn isn&apos;t about documenting your business.
          </p>
          <p className="mt-4 text-lg leading-8 text-[#657185]">
            It&apos;s about eventually giving you the freedom to step away
            without being involved in every decision.
          </p>
          <div className="mt-8 flex items-center gap-3 text-sm font-semibold">
            <span className="grid size-9 place-items-center rounded-full bg-[#eaf7f2] text-[#1b8b69]">
              <CalendarDays size={17} />
            </span>
            Take the vacation. Keep the business moving.
          </div>
        </div>
      </div>
    </section>
  );
}
