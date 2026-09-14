# Opryn remote MCP development

## Production endpoint

```text
https://www.opryn.app/api/mcp
```

The endpoint uses the official TypeScript MCP SDK, stateless Streamable HTTP, and OAuth 2.1 authorization-code flow with S256 PKCE.

## Discovery

```text
GET /.well-known/oauth-protected-resource
GET /.well-known/oauth-protected-resource/api/mcp
GET /.well-known/oauth-authorization-server
```

The authorization server supports dynamic client registration, short-lived access tokens, rotating refresh tokens, revocation, exact redirect URI checks, and RFC 8707 resource binding.

## Tools

- `ask_opryn`
- `search_company_knowledge`
- `check_company_policy`
- `get_company_process`
- `request_owner_guidance`
- `learn_from_context` — explicitly sends supplied current-conversation context into the normal Observed / Needs Review pipeline

All tools derive the user and organization from the OAuth grant. Tool arguments never accept an organization ID. Search is Approved-only, organization-scoped, and filtered by the user's Opryn role.

## Local inspection

1. Add `MCP_TOKEN_HASH_SECRET` to `.env.local` with at least 32 random bytes.
2. Run the app with `npm run dev`.
3. Start Inspector:

```bash
npx @modelcontextprotocol/inspector@latest
```

4. Select **Streamable HTTP** and enter `http://localhost:3000/api/mcp`.
5. Verify unauthenticated calls return `401` with `WWW-Authenticate` protected-resource discovery.
6. Complete OAuth, list tools, and test each tool with known, unknown, restricted, and malformed questions.

Run the non-destructive protocol smoke test against a running local server:

```bash
OPRYN_MCP_TEST_BASE_URL=http://127.0.0.1:3000 npm run test:mcp
```

The same test can target production by setting the base URL to `https://www.opryn.app`.

To verify the authenticated tool catalog against a local server, load the development server secrets and run:

```bash
node --env-file=.env.local scripts/verify-mcp-authenticated.mjs
```

The test creates a short-lived verification grant in an existing Premium test workspace and removes it in a `finally` cleanup. It never prints the access token.

## Security checks

- A Core workspace cannot authorize or call MCP tools.
- Tokens are opaque and only keyed hashes are stored.
- Access tokens expire after one hour.
- Refresh tokens expire after 30 days and rotate on use.
- Revoked grants fail immediately.
- Retrieved documents are treated as untrusted data and cannot override Opryn instructions or permissions.
- Activity logs contain tool/status metadata, not raw tokens or complete conversations.
