# Opryn customer-managed connections

Opryn uses guided, owner-managed credentials for broad third-party software. An owner opens the provider's official account portal, creates a restricted credential specifically for Opryn, and saves it through the in-product guide.

## Security model

- Only organization owners and admins can add, replace, or remove credentials.
- Credentials are accepted only by server routes and never stored in browser storage.
- Values are encrypted with AES-256-GCM and bound to their organization and provider.
- `public.integration_credentials` is inaccessible to browser database roles.
- The UI receives only non-secret connection status and masked account metadata.
- Disconnecting deletes the encrypted credential while preserving approved Opryn knowledge.

Set a unique 32-byte encryption key in every deployed environment:

```env
INTEGRATION_CREDENTIALS_ENCRYPTION_KEY=<64 hexadecimal characters>
```

Never reuse a provider token as this encryption key. Rotating it requires re-encrypting existing stored credentials first.

## Adding a provider guide

1. Add metadata to `lib/integrations/catalog.ts` with `authMode: "credential_guide"`.
2. Add the official setup portal, minimum permissions, steps, and fields to `lib/integrations/guides.ts`.
3. Implement the provider capability server-side before claiming that Opryn imports or synchronizes its data.
4. Retrieve credentials only with `getIntegrationCredentialsServerSide` after verifying organization access.
5. Never log the returned credential object.

Native Slack OAuth, Twilio, and Opryn MCP/API connections keep their existing purpose-built flows.
