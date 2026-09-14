<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Opryn deployment preference

The owner has requested deployment as the default completion step for Opryn implementation requests. After implementing and verifying changes, deploy to the existing linked Vercel production project and verify the release. Apply required, validated migrations in the correct order. Preserve the previous deployment as a rollback target. Do not silently skip deployment; report any safety, authentication, migration, or build blocker. This does not authorize bypassing security checks or deploying during read-only diagnosis/review requests.
