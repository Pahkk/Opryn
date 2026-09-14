# Release scope verification

Git status is not a production baseline for this repository: previous releases
included uncommitted source. Do not discard that work or assume every dirty file
is a new production change.

Before deploying, inspect the current production alias and run:

```sh
node scripts/compare-production-source.mjs <current-production-deployment-id>
```

The read-only script compares local SHA-1 content hashes with Vercel's uploaded
`src` file hashes. It reports changed/deleted files and new source candidates.
Review candidates against `.vercelignore`; this is not a replacement for Vercel's
upload selection logic. Missing or unsupported metadata fails the comparison.
The script does not authorize deployment, modify production, read credentials,
or verify application behavior. Never disable a security control to release.

## Slate release evidence

Baseline: `dpl_DXXm43aPpuqgCkJTJQV1cQbWCner`.

- 475 uploaded source files compared; 461 identical, 14 changed, none removed.
- Ten changed runtime files are public styles, the marketing story, and pricing
  presentation. Four other changes are release documentation and QA scripts.
- Backend, authenticated application, dependencies, and migrations match the
  deployed source hashes.
- New candidates are public color tokens, documentation, QA/release scripts,
  and ignore files. No new backend or migration files were found.
- Fresh local production build, TypeScript, ESLint, and all 28 desktop/mobile
  Playwright tests passed. These tests do not verify live OAuth, payments, or
  authenticated customer workflows against production data.

Retain the previous deployment ID as the rollback target. After deployment,
verify the live alias, page rendering, public links, and relevant error logs.
