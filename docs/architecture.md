# Architecture

## Product shape

EugenIX is a public portfolio and resource platform with a private authenticated layer for saved items, likes, bookmarks,
download events, and admin operations.

## Stack

- HTML for structure
- CSS for presentation
- Vanilla JavaScript for light interactivity
- Supabase for auth, Postgres, storage, and RLS
- Netlify for static hosting, headers, and serverless functions

## Route map

- `/` public portfolio
- `/work/` work index
- `/work/[slug]/` work detail route
- `/resources/` resource index
- `/resources/[slug]/` resource detail route
- `/saved/` authenticated saved items
- `/admin/` protected admin surface
- `/resume/` optional resume route

## Data flow

1. The browser renders static shells and requests public content.
2. Supabase Auth identifies the user for protected actions.
3. Postgres RLS decides whether a row can be read or written.
4. Trusted server functions perform secret-bearing work such as contact handling and future signed download generation.
5. Private storage files are delivered through a controlled signed URL path after authorization checks.

## Secure resource downloads

The resource download path is intentionally server-mediated:

1. The browser posts only a `resourceId` and the user’s bearer token.
2. The Netlify function verifies the token with Supabase Auth.
3. The function reads the canonical file path from `resources`.
4. The function checks publication status and admin override if needed.
5. The function creates a short-lived signed URL for the private bucket.
6. The function records the download event.
7. The browser downloads the file using the returned signed URL.

The public Resource Hub never selects `file_path`, never receives the bucket name, and sends only the canonical resource UUID to the trusted function. Signed URLs remain in memory only long enough to initiate the download.

## Public Resource Hub

- `/resources/` is a static archive shell that reads public categories and explicitly filters resource queries to `published = true`.
- `/resources/:slug/` is rewritten by Netlify to one client-rendered detail shell. The shell resolves and validates the slug before requesting public metadata.
- Search, category filtering, and sorting operate only on the already-loaded public result set. RLS remains the security boundary.
- Resource strings are treated as untrusted plain text and rendered with DOM `textContent`; rich HTML is not supported.
- The homepage does not load Supabase or Resource Hub application modules.

Because resource detail metadata is resolved in the browser, crawlers that do not execute JavaScript receive the useful static route shell rather than resource-specific metadata. Server-rendered or generated resource metadata is a future SEO enhancement; no fake static records are emitted.

## Private Saved Resources

- `/saved/` is a private retrieval interface built on the existing `resource_bookmarks` table.
- Public browsing does not require authentication. Save actions and the Saved page reuse the Phase 06 Google/PKCE session.
- The browser never supplies an owner ID. `save_resource(uuid)` and `unsave_resource(uuid)` derive ownership from `auth.uid()` and are idempotent.
- Bookmark reads and deletes are owner-only under RLS. Published metadata is fetched separately with an explicit `published = true` filter, so an unavailable resource can be represented without exposing its metadata.
- Save intent survives OAuth only through a validated `/resources/...` or exact `/saved/` return path containing the resource UUID. External return destinations remain rejected.
- Saved is private utility: it exposes no public counts, reactions, profiles, rankings, or feeds.

## Admin CMS and analytics

- `/admin/` is a separate, unadvertised management surface. Its shell remains hidden until the active Supabase session passes `current_user_is_admin()`.
- The browser uses the normal publishable-key Supabase client. Resource and category writes are authorized by existing admin RLS; no service-role credential is shipped to the client.
- Resource creation starts as a draft unless publication is explicitly selected. Files are validated in the browser, stored in the private `resources` bucket under a resource UUID, and remain inaccessible through public queries.
- Admin analytics are database-derived through narrow aggregate RPCs. The browser does not receive the raw bookmark or download event tables.
- User summaries expose a display name, avatar, join date, aggregate saves/downloads, and last resource activity. Email addresses and public user profiles are intentionally excluded.
- Resource hard deletion is intentionally absent because database cascades and the separately managed storage object require an explicit retention decision. Unpublishing is the safe V1 removal operation.

## Resource archive lifecycle

Migration `0007_resource_archiving.sql` adds `resources.archived_at`. The valid lifecycle is draft → published → unpublished → archived. Archiving atomically makes the resource unpublished, removes it from public RLS visibility, blocks new saves and downloads, and retains its database row, private file, bookmarks, downloads, and aggregate history. Restoring an archive returns it to draft; publishing remains a separate explicit action. Permanent deletion is not part of the V1 Admin interface.

## Production artifact

`npm run build` creates `dist/` from an explicit allowlist of public routes, runtime scripts, styles, and assets. Netlify publishes only `dist/`; migrations, documentation, tests, package metadata, and Function source are not static-site artifacts. Netlify bundles Functions separately from `netlify/functions`.

## Contact delivery

The contact form posts plain JSON to the same-origin `/api/contact` route. The Netlify Function validates the body, honeypot, lengths, method, and email before calling Resend from the server. Only provider-confirmed acceptance returns `{ accepted: true }`. Visitor content is sent as plain text, the verified EugenIX sender remains the From identity, and the visitor address is Reply-To.

## Authorization model

- Public reads are limited to published content and public categories.
- Authenticated users can only mutate their own likes, bookmarks, profiles, and download events.
- Admin actions are enforced by the `user_roles` table and `public.is_admin()`.

## Content model

- Portfolio content stays separate from resource content.
- Resource files live in a private bucket and are referenced by a normalized `file_path`.
- Event logs are used for trustworthy download metrics instead of mutable counters.

## Profile creation

Profiles are created automatically by a database trigger on `auth.users` so frontend pages never need to duplicate that logic.

## Security posture

The platform is intentionally narrow in V1:

- no comments
- no payments
- no password auth
- no browser-side secrets
- no public write access to protected tables

## Phase boundary

The repository now has the hardened foundation needed for later UI work. The next phase should focus on page composition and data wiring,
not on loosening the security model.
