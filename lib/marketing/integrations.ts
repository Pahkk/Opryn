// Supported capabilities, not an OAuth-provider inventory or private connection state.
export const marketingIntegrations = [
  {
    id: "google_drive",
    name: "Google Workspace",
    category: "Knowledge",
    direction: "learn",
    purpose: "Teach Opryn from selected Docs, Sheets and Slides.",
    status: "Ready to connect",
    detail:
      "Connect Google, choose files in the picker, then review the findings in Teach Opryn. Connecting does not import or approve your whole Drive.",
    href: "/signup",
  },
  {
    id: "notion",
    name: "Notion",
    category: "Knowledge",
    direction: "learn",
    purpose: "Teach Opryn from selected Notion pages.",
    status: "Ready to connect",
    detail:
      "Connect Notion, choose pages shared with the Opryn connection, then review the imported findings. Opryn does not edit pages or approve findings automatically.",
    href: "/signup",
  },
  {
    id: "files",
    name: "Documents & images",
    category: "Knowledge",
    direction: "learn",
    purpose: "Upload company documents, images and supported files.",
    status: "Ready to use",
    detail:
      "Start in Teach Opryn with a supported document or image. Extracted information stays reviewable, with source references where supported.",
    href: "/signup",
  },
  {
    id: "twilio",
    name: "Call learning",
    category: "Calls",
    direction: "learn",
    purpose: "Learn from selected, authorized business recordings.",
    status: "Premium",
    detail:
      "Upload recordings or configure the supported Twilio connection. Provider setup and recording consent are required. Findings require review before approval.",
    href: "/pricing",
  },
  {
    id: "slack",
    name: "Slack",
    category: "Communication",
    direction: "use",
    purpose: "Ask Opryn through supported mentions and direct messages.",
    status: "Setup required",
    detail:
      "Connect the supported Slack app and link users to their Opryn workspace. Answers use shared company knowledge; Slack history is not automatically imported.",
    href: "/signup",
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    category: "Communication",
    direction: "use",
    purpose: "Use approved answers in supported Teams conversations.",
    status: "Setup required",
    detail:
      "An authorized Microsoft tenant and supported bot setup are required. Users link their Opryn access. Connecting does not copy conversation history.",
    href: "/contact?topic=Integration%20request",
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    category: "AI",
    direction: "use",
    purpose: "Retrieve permitted company context through remote MCP.",
    status: "Premium",
    detail:
      "Configure a supported ChatGPT client with Opryn remote MCP and authorize access. Availability depends on the client's plan and settings. Opryn does not read your entire chat history.",
    href: "/ai",
  },
  {
    id: "claude",
    name: "Claude",
    category: "AI",
    direction: "use",
    purpose: "Use approved knowledge in supported Claude clients.",
    status: "Premium",
    detail:
      "Authorize Opryn through a compatible remote MCP client. Learning uses explicitly shared context. Opryn does not train the underlying model.",
    href: "/ai",
  },
  {
    id: "custom_agent",
    name: "Agent API",
    category: "AI",
    direction: "use",
    purpose: "Give existing agents permission-controlled company context.",
    status: "Advanced setup",
    detail:
      "Included in Core. Create an Opryn connection key and implement retrieval in your own system. Your developer controls the agent, its prompts and final actions.",
    href: "/ai",
  },
  {
    id: "mcp",
    name: "Remote MCP",
    category: "AI",
    direction: "use",
    purpose: "Connect compatible external AI tools to approved knowledge.",
    status: "Premium",
    detail:
      "A compatible client and authorized grant are required. New approved guidance is available on the next permitted lookup; old conversations and external caches are not rewritten.",
    href: "/docs/mcp-development",
  },
] as const;
