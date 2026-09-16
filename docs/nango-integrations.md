# Opryn connections / Nango rollout

Status: Google Workspace and Notion have capability adapters. Production readiness still requires the dashboard configuration and live checks below; do not label a provider ready based only on a successful build.

## Architecture

The existing `lib/integrations/catalog.ts` remains the provider registry. Its optional `nango` metadata declares an adapter and the environment variable holding the integration ID. The existing `integrations` table remains the connection model. Nango stores credentials; Opryn stores IDs, capabilities, tenant ownership, state and timestamps. No provider tokens are persisted in Opryn for Nango connections.

1. Connections shows an Opryn consent sheet for the active business.
2. `POST /api/integrations/nango/session` authenticates an owner/admin, checks active organization, rate limits, and reserves an attempt.
3. The frontend SDK receives only a short-lived, provider-restricted connect-session token and opens provider authorization directly in a popup. The customer never sees a setup URL or Nango provider picker.
4. A signed auth webhook validates organization/attempt tags and retrieves current connection state server-side. A transactional RPC confirms the connection and records state transitions.
5. The browser polls its own attempt; a browser success callback alone never marks a connection connected.
6. Capability routes recheck ownership, persisted capabilities, registry adapter, environment and Nango tags. There is no arbitrary browser proxy endpoint.

`integration_connect_attempts` is server-only. A DB trigger prevents authenticated clients from forging Nango connection records. Confirmation is transactional, status transitions are idempotent, and disconnected records are tombstones so delayed webhooks cannot resurrect access.

## Provider rollout

| Provider                         | Current path                                  | Capability / limitation                                                                                                                        |
| -------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Workspace                 | Nango OAuth + Google Picker when configured   | Select multiple Docs, Sheets, and Slides; source URL retained; findings need review. No whole-Drive import or automatic sync/update detection. |
| Slack                            | Existing native OAuth / communication service | Existing Ask Opryn surface, not history ingestion. Not migrated to Nango.                                                                      |
| Microsoft Teams                  | Existing communication setup                  | Existing implementation retained; validate tenant installation separately. Not migrated to Nango.                                              |
| Notion                           | Nango OAuth + page selector when configured    | Select shared pages; import current page Markdown with its source URL; findings need review. No editing or automatic sync.                     |
| Confluence / SharePoint          | Request integration                           | No import adapter; no OAuth-only “working” claim.                                                                                              |
| HubSpot                          | Request integration                           | No customer-context adapter yet.                                                                                                               |
| ChatGPT / Claude / custom AI     | Existing MCP/API                              | Existing permission-controlled approved knowledge access retained.                                                                             |
| Twilio                           | Existing setup                                | Unchanged; not Nango-backed.                                                                                                                   |

Existing saved credentials remain manageable/removable, never relabeled as verified integrations. If Drive has a legacy saved credential record, remove it through its existing management flow before enabling Nango for that organization.

## Required configuration

Set these **server-only** variables (no `NEXT_PUBLIC_` prefix):

- `NANGO_SECRET_KEY`: environment API key. Allow connect-session creation, connection reads/deletion, proxy requests, and `environment:connections:read_credentials`. The credential-read scope is required only because Google Picker's browser SDK requires a short-lived access token; Opryn never returns or stores the refresh token.
- `NANGO_WEBHOOK_SECRET`: the dedicated signing key under Environment Settings → Webhooks. This is not the API key.
- `NANGO_ENVIRONMENT`: exact environment identifier emitted in auth webhooks, e.g. `DEV` or `PROD`.
- `NANGO_GOOGLE_DRIVE_INTEGRATION_ID`: exact Nango integration unique key.
- `NANGO_NOTION_INTEGRATION_ID`: exact Nango Notion integration unique key.
- `GOOGLE_PICKER_API_KEY`: Google Picker browser API key, restricted in Google Cloud to the approved Opryn HTTPS origins and the Picker API.
- `GOOGLE_PICKER_APP_ID`: numeric Google Cloud project number used by Picker.

Existing Supabase service-role configuration is also required; Drive extraction uses the existing configured analysis provider. Never paste secrets into tickets, logs or this document.

Production `PROD` connections are refused outside Vercel's production environment. Use separate DEV keys/integrations and a development Supabase database locally and in previews. Do not pull production credentials for testing.

## Dashboard steps

1. Create separate Nango development and production environments.
2. Create Google Drive and Notion OAuth integrations. The adapters use fixed Nango proxy operations; browser input cannot choose an arbitrary upstream URL.
3. Development: Nango-managed OAuth credentials may be used **only where that provider/environment actually offers them**. No credential mode is assumed or claimed by Opryn.
4. Production: configure Opryn-owned Google OAuth client credentials in Nango, correct redirect URI from Nango, approved consent-screen branding, and complete Google's required verification. Customers never supply developer credentials.
5. Enable the Google Drive API and Google Picker API. Configure the narrow Google scopes required by the selected Nango template and Picker, including identity/email for the connected-account label and `drive.file` where the production flow supports user-selected file grants. Review the actual consent screen before launch; never claim narrower access than the configured scopes.
6. Restrict the Picker API key by HTTPS referrer to Opryn's production and approved preview origins. Picker receives an access token only in authenticated browser memory; it is never placed in localStorage, analytics, logs, URLs, or Opryn's database.
7. In the Notion developer portal, enable read content and user information without email. Leave update/insert content and comments disabled. Nango's Notion scope field remains blank because Notion access is controlled by connection capabilities and the pages the user shares.
8. Set webhook URL to `https://www.opryn.app/api/webhooks/nango` only for the production deployment. Use an isolated reachable staging/dev endpoint for DEV.
9. Enable auth creation, reauthorization, token-refresh failure/recovery, and deletion webhooks. Copy that environment's signing key into server configuration.
10. Record which environment/provider uses managed versus Opryn-owned OAuth credentials in your private operations inventory.

Apply migrations in order. `20260911010000_nango_connections.sql` establishes the Nango model; `20260911020000_google_workspace_selection.sql` preserves selected Google files during reconnects. The second migration is pending production deployment and must not be applied until deployment is approved.

## Local development and tests

Install dependencies, configure DEV variables in an ignored local env file, apply migrations to the DEV database, then start the app. Nango's webhook endpoint must be reachable using your normal secured development tunnel. Never disable signature validation for a tunnel.

Use two organizations and an ordinary member plus owner/admin accounts. Check unauthorized sessions, cross-org IDs, revoked membership, duplicate webhooks, reordered refresh/recovery events, two tabs authorizing the same provider, cancellation, provider denial and disconnect during analysis. Verify imports remain `needs_review` and original source links open correctly.

Disconnect disables local use before remote deletion. If deletion fails, `disconnect_pending` remains visible and retries finish deletion. Approved knowledge is not automatically deleted. Removing a Nango connection does not guarantee revocation of every provider-side grant; the customer can also revoke Opryn in the provider account.

## Adding a provider

1. Configure the OAuth integration in Nango DEV.
2. Add metadata to the existing registry, including aliases, honest permissions, classification and capabilities.
3. Implement a server-only capability adapter using fixed allowed operations. Never accept arbitrary URLs, scopes or tenant IDs for proxying.
4. Extend the adapter type and server dispatcher; only then enable its Nango registry metadata/configuration.
5. Reuse session/webhook/manage UI. Add selection/import UI only if the capability requires it.
6. Test the full workflow with credentials and review states before changing availability from request-only.

## Debugging / operational boundaries

Only generic error codes and IDs belong in logs; never log Nango response bodies, session tokens or provider credentials. Use the Nango dashboard's own restricted logs for provider diagnostics. Webhooks ignore unrelated event types and validate the environment. Duplicate status deliveries do not duplicate connections or transition events.

When a webhook is missed, browser success intentionally remains unconfirmed. Inspect/retry delivery in Nango rather than manually marking database rows connected. Pending attempts expire after 30 minutes; starting again expires stale reservations. Late creation webhooks for cancelled/expired attempts remove the verified orphan connection. An entirely missed creation webhook may leave an orphan in Nango; include orphan reconciliation in operational monitoring before a broad rollout.

Refresh status is based on the current server-side Nango connection, not solely the arriving event. Picker selections are stored separately from connection status and survive reconnects. Automatic sync, source-deletion monitoring, background retry jobs and multi-provider adapters are not supplied by authorization alone.

## Current official references

Verified against current Nango docs September 11, 2026:

- [Auth guide](https://nango.dev/docs/guides/auth/auth-guide)
- [Connect sessions](https://nango.dev/docs/reference/backend/http-api/connect/sessions/create) — use tags; end_user/organization objects are deprecated.
- [Reconnect sessions](https://nango.dev/docs/reference/backend/http-api/connect/sessions/reconnect)
- [Signed webhooks](https://nango.dev/docs/guides/platform/webhooks-from-nango)
- [Frontend SDK](https://nango.dev/docs/reference/frontend/frontend-sdk)
- [Proxy requests](https://nango.dev/docs/guides/platform/proxy-requests)
- [Connect UI customization](https://nango.dev/docs/guides/auth/customize-connect-ui)

## Production checklist

- [ ] Migration reviewed and tested on PostgreSQL with RLS roles.
- [ ] DEV OAuth, webhook, Drive selection/import and reconnect tested with real credentials.
- [ ] Production OAuth ownership, scopes, provider verification and Nango plan confirmed.
- [ ] Environment keys isolated and webhook signing verified.
- [ ] Production migration/deployment explicitly approved.
- [ ] Live tenant-isolation, cancel/deny/reconnect/disconnect and source-review checks completed.
- [ ] Provider grant removal, orphan monitoring and operational alerts assigned.

## Verification handoff (September 11, 2026)

- `node scripts/verify-nango.mjs`: isolated embedded PostgreSQL migration/RPC execution and explicit API/provider doubles. Covers ownership, forged-row protection, duplicate confirmation, rate limits, revoked role, cancel/expiry, disconnect tombstones, HMAC, remote tag mismatch and pending reauth vs refresh.
- `OPRYN_PGLITE_MODULE` can point to an installed `@electric-sql/pglite/dist/index.js`; verification dependency is deliberately outside production dependencies.
- `scripts/verify-product-ui.mjs`: 168 component-browser assertions, including Nango consent sheets at 320/375/390/430/1280px, cancelled authorization and browser-success waiting for server confirmation. SDK and authenticated APIs are explicit doubles.
- `tests/nango-public.spec.ts`: real local Next production server rejects signed-out session/list/manage/import requests and fails closed on unsigned webhooks. Full public suite: 28 tests.
- Source import validation regression suite passes with mocked analysis/storage.
- Screenshots: `artifacts/product-ux/integrations-390.png`, `integrations-1280.png`, `nango-connect-390.png`, `nango-connect-1280.png`, `nango-confirmed-390.png`.
- Real Nango OAuth, Google consent/scopes, provider failure/reconnect, Drive API downloads and live extraction remain unverified without DEV credentials. Real iPhone keyboard behavior is manual testing still required.
- Production dependency audit flags existing Next.js 16.3.2, sharp and qs advisories. No blind audit fix or framework upgrade was performed. Review/remediate before release.
