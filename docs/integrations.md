# Opryn integrations

Premium ChatGPT/Claude conversation learning, entitlement enforcement, migration and provider tool refresh instructions are documented in [premium-conversation-learning.md](./premium-conversation-learning.md).

Nango is authentication and provider-API infrastructure. It is never presented as a customer-facing product. Opryn owns workspace authorization, source selection, ingestion, review, approval, retrieval, unknown-question routing, and audit state.

## Shared lifecycle

Knowledge sources use one pipeline:

`selected provider content → normalized source → extracted process → Needs Review → approved Opryn knowledge`

Source updates create a new reviewable process. They never overwrite active approved knowledge. Disconnecting a provider stops future access but does not silently delete knowledge that a person already approved.

Nango connections are organization-tagged, server-confirmed, and stored in `integrations`. Provider credentials remain in Nango. Explicit Notion and Confluence selections are stored in `integration_sources`; source content becomes a reviewable `process` through the existing extraction service.

## Notion

- **Nango key:** `NANGO_NOTION_INTEGRATION_ID`
- **Capabilities:** selected pages, selected databases, scheduled/manual source update checks
- **Stored:** stable page/database ID, title, parent context, source URL, update timestamp, content hash, selected/imported state, resulting process ID
- **Not stored:** Notion user profiles, people-property identities, OAuth credentials
- **Selection:** Opryn-native multi-select under Teach Opryn and the connection detail sheet
- **Databases:** up to 100 explicitly selected rows per import; larger databases ask the user to narrow the source
- **Disconnect:** stops provider access; approved Opryn knowledge remains

Configure the Notion integration in Nango with read-only content capabilities. Share only intended pages/databases with the Notion integration. The importer recursively reads page blocks with bounded depth/size and ignores decorative blocks.

## Confluence

- **Nango key:** `NANGO_CONFLUENCE_INTEGRATION_ID`
- **Capabilities:** selected pages, selected spaces, scheduled/manual version checks
- **Required read scopes:** `read:page:confluence`, `read:space:confluence`, plus `offline_access` for refresh where configured
- **Stored:** page/space ID, title, site/space context, URL, version, timestamps, content hash, selected/imported state, resulting process ID
- **Never stored:** `authorId`, `ownerId`, `lastOwnerId`, `spaceOwnerId`, `accountId`, display name, email, avatar, timezone, or creator profile fields
- **Space limit:** the first bounded page set only; large spaces must be narrowed to pages
- **Disconnect/access loss:** source becomes unavailable; approved knowledge remains until a human archives or replaces it

The deny-list sanitizer runs before metadata persistence. The database schema intentionally has no Atlassian identity columns. Page body content is treated as untrusted business input and still requires human review.

## Microsoft Teams

- **Nango key:** `NANGO_MICROSOFT_TEAMS_INTEGRATION_ID`
- **Capabilities:** ask Opryn, concise sourced answers, short thread context, unknown-question routing, feedback
- **OAuth:** Nango authorizes and identifies the tenant; Opryn maps exactly one Teams tenant to one Opryn organization
- **Message transport:** the existing Microsoft Teams app and Chat SDK adapter receive bot messages at `/api/webhooks/teams`
- **Answering:** `answerCommunicationQuestion` uses the same approved, permission-filtered retrieval path as other Opryn surfaces
- **Unknowns:** create `employee_questions` and knowledge-gap clusters, then route to an expert/owner through the existing Needs You loop
- **Stored identity:** only stable tenant/user IDs needed for workspace mapping and member authorization; display names/emails are not required for message processing

Nango OAuth does not install the Teams bot. The Opryn Teams app must also be published or uploaded to the tenant and configured with the existing Azure Bot credentials. Microsoft requires a Teams app/bot installation before users can message it.

## Server configuration

Required server-only variables:

```text
NANGO_SECRET_KEY
NANGO_WEBHOOK_SECRET
NANGO_ENVIRONMENT
NANGO_NOTION_INTEGRATION_ID
NANGO_CONFLUENCE_INTEGRATION_ID
NANGO_MICROSOFT_TEAMS_INTEGRATION_ID
CRON_SECRET
```

Teams bot transport additionally retains its existing server-only Azure variables:

```text
MICROSOFT_CLIENT_ID (or TEAMS_APP_ID)
MICROSOFT_CLIENT_SECRET (or TEAMS_APP_PASSWORD)
MICROSOFT_TENANT_ID
```

No secret may use a `NEXT_PUBLIC_` prefix.

## Webhooks and updates

- Nango auth webhooks are HMAC verified and idempotently reconcile create, reauthorization, refresh failure, and deletion.
- Teams connection confirmation resolves the tenant through Microsoft Graph and links it to `communication_integrations`.
- `/api/cron/integration-source-updates` checks a bounded set of selected Notion/Confluence sources. Changed content creates a new review item.
- Manual **Check for updates** uses the same import service.
- Provider tokens and response bodies are never logged.

## Testing

Run:

```bash
npm run test:provider-integrations
npm run test:communication
npm run typecheck
npm run lint
npm run build
```

Live provider testing requires development Nango integrations, a development Supabase migration, and real read-only accounts. Verify tenant isolation with two Opryn organizations before production rollout.
