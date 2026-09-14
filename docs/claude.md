# Connect Opryn to Claude

Opryn uses the same remote MCP server and approved company knowledge used by ChatGPT, Opryn Web, Slack, and the Agent API.

## Connection details

- Server name: `Opryn`
- Remote MCP URL: `https://www.opryn.app/api/mcp`
- Transport: Streamable HTTP
- Authentication: OAuth 2.1

## Connect in Claude

For Claude Pro or Max on the web:

1. Open **Customize → Connectors**.
2. Select **+**, then **Add custom connector**.
3. Name it `Opryn` and enter `https://www.opryn.app/api/mcp`.
4. Complete Opryn sign-in, select the business, and approve access.

For Claude Team or Enterprise, an organization owner first adds the custom web connector from **Organization settings → Connectors → Add → Custom → Web**. Team members can then open **Customize → Connectors** and enable Opryn.

For Claude Code:

```bash
claude mcp add --transport http Opryn https://www.opryn.app/api/mcp
```

Then run `/mcp`, choose Opryn, and complete browser authentication. Sign in to Opryn if needed, select the business, and approve access.

Connecting is available during onboarding. Opryn checks the workspace entitlement when a company-knowledge tool is actually used, rather than blocking authorization.

Example:

```text
Use Opryn to check our refund policy.
```

To send relevant context from the current Claude conversation into Opryn, say:

```text
Use Opryn to learn Pahk Marketing from this conversation.
```

Claude should call `learn_from_context`. Opryn receives only the context Claude supplies after this explicit request; it does not read other Claude conversations or account history. Findings remain **Observed / Needs Review** until approved in Opryn.

When Opryn finds a clear policy, Claude should present **Accept** and **Deny**. It calls the shared `approve_knowledge_proposal` or `deny_knowledge_proposal` tool only after the authenticated owner/admin explicitly decides. If Claude cannot show buttons, the user can simply tell Opryn to accept or deny that exact proposal. Unresolved high-risk guidance must be reviewed inside Opryn.

To create a structured process, say:

```text
Use Opryn to create our Client Onboarding process from this conversation.
```

Claude can call the same `create_process` write action used by ChatGPT when the user explicitly asks it to add a structured process to Opryn. It uses `create_process_from_context` when deriving a process from the current conversation. Opryn keeps the result in Needs Review and offers **Approve Now**, **Review**, **Deny**, or **Later**. It only calls `approve_process` or `deny_process` after the owner/admin explicitly chooses. High-risk or incomplete company policy always requires individual review in Opryn.

Claude may select Opryn automatically for clear company-specific questions. Opryn does not require the literal `@Opryn` text.

If an answer is unknown, Claude must not infer or invent company policy. It can call `request_owner_guidance` when the user wants the right expert or owner to answer.
