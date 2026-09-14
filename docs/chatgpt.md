# Connect Opryn to ChatGPT

Opryn exposes one remote MCP server for approved company knowledge.

## Connection details

- Display name: `Opryn`
- Description: `Access your company's approved Opryn knowledge, processes, policies, and owner guidance.`
- MCP URL: `https://www.opryn.app/api/mcp`
- Authentication: OAuth 2.1

## Connect in ChatGPT

1. Make sure your ChatGPT workspace allows custom apps and MCP actions. Availability depends on the ChatGPT plan and workspace policy.
2. In ChatGPT, open **Settings → Apps**. Enable Developer mode under **Advanced Settings** if your workspace requires it.
3. Select **Create** and create a custom app named **Opryn**. Workspace owners can also use **Workspace settings → Apps → Create**.
4. Enter `https://www.opryn.app/api/mcp` as the public Streamable HTTP MCP URL.
5. Scan the tools, continue to Opryn, sign in if needed, choose the business, and approve access.
6. Review the discovered tools and create the app.

Start a new chat, enable Opryn, then try:

```text
@Opryn what is our refund policy?
```

If Opryn returns `unknown`, ChatGPT must not invent a company policy. It should offer `request_owner_guidance`.

## Learn from this conversation

Inside a conversation that contains useful, business-specific context, use:

```text
@Opryn /learn Pahk Marketing
```

ChatGPT should call `learn_from_context` with only relevant context from the current conversation. Opryn does not receive other chats or unrestricted account history. Findings enter Opryn as **Observed / Needs Review**, not Approved company policy.

When Opryn finds a clear policy, ChatGPT should show the policy with **Accept** and **Deny**. It calls `approve_knowledge_proposal` or `deny_knowledge_proposal` only after the signed-in owner/admin explicitly chooses that action. No response means the proposal stays pending in Opryn. Ambiguous high-risk guidance returns **Review Required** instead of one-click acceptance.

Full MCP write actions, including `learn_from_context`, must be allowed by the user's ChatGPT plan and workspace settings. If ChatGPT only permits read tools, the connection can still ask Opryn questions but cannot send learning context.

## Create a process from a conversation

In a conversation that contains the real workflow, ask:

```text
@Opryn create a Client Onboarding process from this conversation.
```

ChatGPT can call the `create_process` write action when the user explicitly asks it to add a structured process to Opryn. It uses `create_process_from_context` when the user asks it to derive a process from the current conversation. Both paths create one Needs Review process with its steps, rules, exceptions, clarification questions, and source. ChatGPT then offers **Approve Now**, **Review First**, **Deny**, or **Later**. `approve_process` and `deny_process` may run only after an explicit choice; direct approval is refused for high-risk or incomplete processes.

Disconnecting the client from **Opryn → AI Connections** revokes its OAuth grant and tokens immediately.

Connecting and the first explicit learning handoff are available during onboarding. Opryn checks the workspace entitlement when a company-knowledge answer tool is used, so authorization does not interrupt first-run setup.
