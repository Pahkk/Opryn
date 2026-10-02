/** Provider support is independent of Opryn billing. OAuth scopes are not proof
 * that a provider's current plan/surface exposes a write tool. Update notices
 * against official documentation rather than inferring account eligibility. */
export const providerLearningCapabilities = {
  chatgpt: {
    notice:
      "ChatGPT must expose Opryn’s learning action in your account and workspace. Availability depends on the supported plan, web surface and administrator policy. Opryn Pro does not change your ChatGPT plan.",
    helpUrl: "https://developers.openai.com/plugins/deploy/connect-chatgpt",
    refresh:
      "Open your Opryn connection in ChatGPT Plugins, select Refresh, check for learn_from_context, then enable Opryn in a new conversation. Published installations may need an administrator-managed update.",
  },
  claude: {
    notice:
      "Enable Opryn in the Claude conversation and allow its learning action. Connector availability and administrator policy are controlled by Claude, not your Opryn plan.",
    helpUrl:
      "https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp",
    refresh:
      "Check Opryn under Customize → Connectors and enable its tools in the conversation. If the tool is missing, reconnect; an organization owner may need to update the connector.",
  },
} as const;
