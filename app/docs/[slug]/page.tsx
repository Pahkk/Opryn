import Link from "next/link";
import { notFound } from "next/navigation";
import { OprynLogo } from "@/components/opryn-logo";

const guides = {
  chatgpt: {
    title: "Connect Opryn to ChatGPT",
    intro:
      "Ask Opryn from ChatGPT using the same approved company knowledge your team relies on.",
    steps: [
      "In ChatGPT, open Settings → Apps. Enable Developer mode in Advanced Settings if your workspace requires it.",
      "Select Create and make a custom app named Opryn. Workspace owners can also use Workspace settings → Apps → Create.",
      "Use https://www.opryn.app/api/mcp as the public MCP URL.",
      "Sign in to Opryn, choose your business, approve access, then scan and review the discovered tools.",
      "In a relevant business conversation, try: @Opryn /learn Your Business Name",
    ],
  },
  claude: {
    title: "Connect Opryn to Claude",
    intro:
      "Let Claude check approved Opryn knowledge when a question depends on how your company works.",
    steps: [
      "Open Customize → Connectors.",
      "Select + → Add custom connector and name it Opryn.",
      "Use https://www.opryn.app/api/mcp as the server URL, then complete Opryn sign-in and choose your business.",
      "In a relevant conversation, try: Use Opryn to learn Your Business Name from this conversation.",
      "For Team or Enterprise, an organization owner first adds the custom web connector in Organization settings → Connectors.",
    ],
  },
  "mcp-development": {
    title: "Opryn remote MCP setup",
    intro:
      "Connect any compatible AI client to Opryn's OAuth-protected Streamable HTTP server.",
    steps: [
      "Create a remote Streamable HTTP connection.",
      "Use https://www.opryn.app/api/mcp as the MCP URL.",
      "Allow the client to discover OAuth settings and register itself.",
      "Sign in to Opryn, choose a business, and approve the requested scopes.",
    ],
  },
} as const;

export default async function OprynGuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = guides[slug as keyof typeof guides];
  if (!guide) notFound();
  return (
    <main className="opryn-guide min-h-screen bg-[#fafaf7] px-4 py-10 text-[#071b3d] sm:py-16">
      <article className="opryn-guide__article mx-auto max-w-2xl">
        <Link href="/" aria-label="Opryn home">
          <OprynLogo size="large" priority />
        </Link>
        <p className="mt-12 text-xs font-semibold uppercase tracking-[.12em] text-[#146bff]">
          Opryn Everywhere
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-.05em] sm:text-5xl">
          {guide.title}
        </h1>
        <p className="mt-5 text-lg leading-8 text-[#5f6d84]">{guide.intro}</p>
        <ol className="opryn-guide__steps mt-10 border-y border-[#dce3ec]">
          {guide.steps.map((step, index) => (
            <li
              key={step}
              className="opryn-guide__step grid grid-cols-[2rem_1fr] gap-4 border-b border-[#e3e8ef] py-5 last:border-0"
            >
              <span className="font-semibold text-[#146bff]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="leading-7">{step}</span>
            </li>
          ))}
        </ol>
        <div className="opryn-guide__endpoint mt-8 border-l-2 border-[#146bff] bg-[#f3f7ff] p-5">
          <p className="text-sm font-semibold">Opryn MCP URL</p>
          <code className="mt-2 block overflow-x-auto text-sm">
            https://www.opryn.app/api/mcp
          </code>
        </div>
        <p className="mt-8 text-sm leading-6 text-[#69758a]">
          Opryn only returns approved knowledge the signed-in team member is
          allowed to see. When approved guidance is missing, it returns unknown
          instead of inventing policy. Conversation learning happens only when
          the user explicitly asks Opryn to learn from supplied context; it does
          not read the user&apos;s full chat history.
        </p>
        <Link
          href="/app/integrations?filter=ai"
          className="mt-8 inline-flex min-h-11 items-center bg-[#146bff] px-4 text-sm font-semibold text-white"
        >
          Back to Connections
        </Link>
      </article>
    </main>
  );
}
