# Opryn Everywhere provider setup

Opryn Web, Slack, Microsoft Teams, and External AI Connections all use the same approved Opryn knowledge. Slack and Teams only receive direct interactions with Opryn; Opryn does not ingest workspace history.

## Required Vercel environment variables

Add these to Production, Preview, and Development as appropriate, then redeploy:

```text
COMMUNICATION_CREDENTIALS_ENCRYPTION_KEY=<32 random bytes, hex or base64>

SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_SIGNING_SECRET=
SLACK_REDIRECT_URI=https://www.opryn.app/api/integrations/slack/callback

MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=common
MICROSOFT_REDIRECT_URI=https://www.opryn.app/api/integrations/teams/callback
```

Never expose the encryption key, Slack client secret/signing secret, Microsoft client secret, or installed Slack bot tokens to browser code.

Generate the encryption key once:

```bash
openssl rand -hex 32
```

Changing it later requires re-connecting existing communication integrations.

## Slack

1. Create an app at `https://api.slack.com/apps` using `config/integrations/slack-manifest.json`.
2. In **OAuth & Permissions**, confirm the redirect URL is:
   `https://www.opryn.app/api/integrations/slack/callback`
3. Confirm the minimum bot scopes: `app_mentions:read`, `chat:write`, `commands`, `im:history`.
4. In **Event Subscriptions**, use:
   `https://www.opryn.app/api/webhooks/slack`
5. Subscribe only to `app_mention` and `message.im`.
6. Use the same webhook URL for interactivity and `/opryn`.
7. Copy Client ID, Client Secret, and Signing Secret to Vercel.

The official Slack adapter verifies `X-Slack-Signature`, checks request timestamps, and prevents replay before events enter Opryn.

## Microsoft Teams

1. Register a multi-tenant application in Microsoft Entra ID.
2. Add the web redirect URI:
   `https://www.opryn.app/api/integrations/teams/callback`
3. Add delegated Microsoft Graph permissions: `User.Read`, `Organization.Read.All`, and `offline_access`. Grant admin consent where required.
4. Create an Azure Bot using the same Microsoft application ID.
5. Set the messaging endpoint to:
   `https://www.opryn.app/api/webhooks/teams`
6. Replace both `MICROSOFT_CLIENT_ID` placeholders in `config/integrations/teams-manifest.template.json`, add square color/outline icon files, zip the manifest with those icons, and upload or publish the Teams app for the tenant.
7. Copy the Application (client) ID and client secret to Vercel. Keep `MICROSOFT_TENANT_ID=common` for the multi-tenant connection flow.

The official Teams adapter validates Bot Framework bearer tokens and activities before processing messages.

## Account linking

The first time an unmapped Slack or Teams user asks Opryn, Opryn sends a single-use link valid for 20 minutes. The user signs into Opryn and confirms the connection. The server verifies that the signed-in user belongs to the organization connected to that Slack workspace or Teams tenant.

## Processing and retry behavior

Provider webhooks are authenticated, deduplicated, persisted, and acknowledged quickly. Answering happens immediately after the webhook response. Failed jobs use bounded retries, are retried when subsequent messages arrive, and have a daily Hobby-compatible fallback sweep through `/api/cron/communication-messages`; duplicate provider events do not create duplicate questions. A Pro deployment may safely increase the cron frequency.
