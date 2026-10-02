# Provided Opryn icon system

Implemented locally. Not deployed. No billing, permission, integration, or database behavior changes.

## Asset audit and mapping

Inspected all ten images in `/Users/nikitapakhomov/Desktop/OPryn icons` individually. Originals copied into `public/opryn-icons` without renaming or processing. All are 1254 × 1254 RGBA PNGs. SHA-256 comparisons confirm byte-for-byte preservation.

| Original filename                          | Use                                           |
| ------------------------------------------ | --------------------------------------------- |
| `1c9a7356-801c-444a-9ce3-50bf07432d1d.png` | Home                                          |
| `3b307f97-1d3e-4428-8852-8b0969473f50.png` | Ask Opryn                                     |
| `dea063a3-e18d-45d3-bf89-776317a6abfd.png` | Teach Opryn                                   |
| `0ee83465-83bf-4fc2-9cc2-7aa059f274b1.png` | Knowledge                                     |
| `d80bafe8-e2da-4e66-8bad-cb6481649edd.png` | Needs You / review (clipboard review artwork) |
| `f196e284-e39e-4e7a-a2b5-f719fe848eb9.png` | Team                                          |
| `cd2be86f-155d-4a14-abff-ca92a1275aed.png` | Connections                                   |
| `e9021800-0bb7-4798-a17a-d0943ddbc791.png` | Settings                                      |
| `f8848d0b-ceb2-4b24-a589-e0dadbc4156c.png` | Approved / confirmed-success feedback         |
| `843d8ce8-037b-4563-a6c9-55a01de91389.png` | Help / support                                |

## Shared components

- `components/opryn-icons/opryn-icon.tsx`: typed original-asset registry, `OprynIcon`, `OprynIconHighlight`, optional `OprynIconShell`.
- API supports name, size, active, attention, success, disabled, explicit state, className and style. Decorative, non-draggable images have empty alt text; the semantic action supplies its accessible name.
- Explicit dimensions, original image resolution, `object-fit: contain`, internal padding, no clipping, no color filters, and no replacement artwork. Source transparency and internal whitespace remain intact.
- One shared motion vocabulary: scale 1.05 / y −2 hover, .96 press, spring stiffness 410 / damping 28, restrained settings rotation 5° and support tilt 2°.
- Closest semantic action supplies pointer/focus state, so hovering/focusing the label also activates the icon. No extra focus targets.
- Soft cobalt radial field and one-shot .42s halo, no continuous glow or idle looping.
- Needs You attention uses a small initial emphasis and at most three 10-second reminders; interaction stops reminders. Active navigation, hidden documents, and reduced-motion preferences suppress reminders.
- Original raster compositions are not split into independently moving nodes/checks/bars: doing that would alter the artwork.

## Product integration

- Existing Home, Ask, Teach, Knowledge, Team, Needs You, Connections, Settings, Approved and Support exports now reference original assets. Unmatched functional SVG exports remain unchanged.
- AppShell sidebar and mobile navigation use 30px / 28px image containers; button-size exports preserve explicit caller sizes.
- Active sidebar background uses `layoutId="opryn-nav-active"`, scoped separately per navigation instance. Mobile bottom navigation has its own scoped shared surface and `aria-current`.
- Nav labels shift 2px with hover and focus, with soft sky tint. Focus rings stay visible.
- Removed old inline SVG artwork for mapped exports. Sidebar Teach no longer uses Lucide BookOpenText; Help no longer uses Lucide CircleHelp. BookOpenText remains for My Learning because no learning asset was supplied.
- `SuccessCheck` now uses the supplied Approved artwork, preserving callers and authoritative server-confirmed action states. Success enters via restrained image emphasis; there is no recreated SVG check. Final action surfaces remain the existing quiet gray. The original cobalt stamp is not recolored.
- Notification bell stays functional because no notification image was supplied; only its real count badge gets a short reduced-motion-aware entrance on count changes.
- Ask AI-working states continue to use OprynThinkingOrb; static artwork is never a loader. Official Opryn and provider logos are unchanged.

## Accessibility and mobile

Keyboard focus activates the same icon feedback as hover. Icon-only controls retain their existing accessible labels. Status remains visible text, with existing server-success announcements unchanged. Decorative image/highlight/halo are hidden from screen readers.

OS and account reduced-motion preferences remove movement, rotations, halo and reminders while retaining active tint and static status. Touch does not need hover to understand actions. No giant icon shells or decorative color squares added.

## Verification and evidence

- `scripts/verify-opryn-icons.mjs`: original-file hashes and actual React components at 390, 768, 1440px, standard/reduced motion; loaded original dimensions, contain sizing, aspect ratio, no dragging, keyboard state, account preference, no horizontal overflow/runtime errors.
- `scripts/verify-icon-navigation.mjs`: actual AppShell with isolated Next router and disabled Guide adapter, original images and compiled application CSS. Does not call production services or claim OAuth/integration E2E verification.
- `scripts/verify-owner-home.mjs`: 120 actual Home browser assertions including confirmed approval, failure/retry, duplicate-submit prevention, settled success and row removal. Now serves original image assets in its fixture.
- Local screenshots: `artifacts/opryn-icons/icons-{390,768,1440}.png`, reduced-motion variants, navigation screenshots, and `artifacts/owner-home/` approval screenshots/recording.
- Passed: typecheck, ESLint, production build (120 static pages), 46 asset/rendering checks, 66 actual AppShell navigation checks and 120 Home browser assertions. No new dependencies.

## Missing assets and remaining limits

No distinct supplied assets for search, notifications, profile, upload, analytics, workflow/process, security, sync, workspace, policy, conflict, impact, archive, learning, or a Guide-specific avatar. Existing functional icons remain where those meanings are needed. Review intentionally reuses the supplied clipboard artwork, not an invented file.

No production mutations, provider connections, or live approval test performed. Integration-specific internal animation (separating linked pieces, bars, or avatar nodes) is intentionally omitted because these are single flattened images. Tiny controls preserve the entire original canvas rather than cropping whitespace for a larger silhouette.
