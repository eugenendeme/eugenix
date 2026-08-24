# Development

## Local setup

1. Open the repository root in your editor.
2. Copy `.env.example` to `.env` when environment values are ready.
3. Apply `supabase/migrations/0001_initial.sql` through `supabase/migrations/0005_saved_resources_boundary.sql` before testing authenticated Resource Hub and Saved flows.
4. Run `npm run dev` and open `http://127.0.0.1:4173` for local layout work. ES modules and root-relative assets require an HTTP preview rather than opening the HTML through `file://`.

## Resource Hub public configuration

The Resource Hub uses a generated, browser-safe configuration file and a self-hosted copy of the already-declared Supabase browser client.

Required build environment values:

- `SUPABASE_URL` — the public project URL.
- `SUPABASE_PUBLISHABLE_KEY` — the browser-safe publishable key. `SUPABASE_ANON_KEY` remains a temporary compatibility fallback.

Run `npm run build` after setting those values. The build copies the Supabase UMD browser bundle into `scripts/vendor/` and generates `scripts/public-config.js`. It never reads or writes `SUPABASE_SERVICE_ROLE_KEY`, Google client secrets, or mail-provider secrets into browser files.

For local layout work without Supabase values, the committed empty configuration intentionally shows the truthful catalog-unavailable and empty-library states. Do not put real values directly into committed source files.

The browser reads `categories` as the source of truth. Migration `0004_resource_category_taxonomy.sql` establishes exactly Documentation, Engineering Notes, Web, Mobile, System Design, and AI Prompts. It safely merges Web Development and Mobile Development, preserving resource and project relationships. The migration intentionally stops if a referenced AI, Vibe Coding, Tech, or unknown legacy category remains; choose its canonical destination editorially, update those relationships, and rerun the migration. Do not weaken that guard by guessing a mapping.

## Google OAuth setup

1. In Google Cloud Console, create or select the production project and configure its OAuth consent screen.
2. Create a Web application OAuth client.
3. Add the Supabase project callback shown in Supabase Authentication → Providers → Google to Google’s authorized redirect URIs. It normally follows `https://<project-ref>.supabase.co/auth/v1/callback`.
4. Store the Google client ID and client secret only in Supabase Authentication → Providers → Google, then enable the provider.
5. In Supabase Authentication → URL Configuration, set the production Site URL to `https://eugenix.dev`.
6. Add the exact application callbacks `https://eugenix.dev/resources/` and `http://127.0.0.1:4173/resources/` to Supabase’s allowed redirect URLs. Saved actions use that fixed callback and then restore a validated same-origin `/saved/` or `/resources/...` return path.
7. Add the exact Netlify deploy-preview `/resources/` URL only when a particular preview needs OAuth testing. Avoid a broad cross-site wildcard.

The browser always asks Supabase to return to the fixed same-origin `/resources/` callback. Before sign-in it stores only a validated `/resources/...` return path in `sessionStorage`; external URLs, protocol-relative paths, backslashes, and non-resource destinations are rejected. Supabase manages PKCE session persistence and token refresh.

Phase 07 also permits the exact `/saved/` application path in that validator. It does not permit arbitrary same-origin pages. A signed-out Save action includes only a resource UUID in the validated return URL; after authentication, the published-resource save RPC is idempotently completed and the temporary query parameter is removed.

Phase 08 additionally permits `/admin/` (including its query/hash state) while rejecting deeper paths such as `/admin/users`, external origins, protocol-relative paths, and backslashes. The fixed OAuth callback remains `/resources/`; only the validated same-origin destination is restored after authentication.

## Saved Resources security tests

Run `supabase test db supabase/tests/phase07_saved_resources_rls.sql` against an isolated local Supabase database after migrations. The pgTAP test verifies cross-user read/create/update/delete isolation, published-only saving, database-derived ownership, and idempotent save/unsave behavior. It uses transaction-scoped fixture users/resources and rolls back all fixtures.

## Admin setup and tests

Apply migrations through `0006_admin_cms_analytics.sql`, then grant the first administrator through a privileged dashboard/SQL session using that account's exact `auth.users.id`:

```sql
insert into public.user_roles (user_id, role)
values ('00000000-0000-0000-0000-000000000000', 'admin')
on conflict (user_id) do update set role = excluded.role;
```

Never infer admin status from an email address and never expose this operation in the browser. Run `supabase test db supabase/tests/phase08_admin_security.sql` against an isolated local database to verify non-admin rejection, admin CRUD/RPC access, storage policy enforcement, and Saved privacy. Run `npm run test:admin` for the repository's static boundary checks.

## Production environment

Use a disposable/staging Supabase project and Netlify deploy preview first. Apply migrations `0001` through `0007` in filename order. Do not continue past a failure and do not weaken RLS to force a migration through.

Netlify build variables:

- `SUPABASE_URL` — browser-safe project URL, also used by the download Function.
- `SUPABASE_PUBLISHABLE_KEY` — browser-safe publishable key.

Server-only variables:

- `SUPABASE_SERVICE_ROLE_KEY` — download Function only.
- `RESEND_API_KEY` — contact Function only.
- `CONTACT_FROM_EMAIL` — verified Resend sender, for example `EugenIX <contact@eugenix.dev>` only after verification.
- `CONTACT_TO_EMAIL` — optional; defaults to `ndemeeugene237@gmail.com`.

Use staging Supabase/Resend values for deploy previews. Production-only secrets must be scoped to the production context. Never put server values in `.env` files that are committed, build arguments that become client JavaScript, or Supabase public configuration.

### Google OAuth

Enable Google only in Supabase Authentication. Store the Google client secret there. Configure the Supabase provider callback in Google Cloud, set the Supabase production Site URL to `https://eugenix.dev`, and allow exact application callbacks for `/resources/`. The application restores only validated `/resources/...`, exact `/saved/`, or `/admin/` paths. Keep localhost and each necessary deploy-preview callback explicit.

### First administrator

1. Sign in normally with Google.
2. Obtain the exact user UUID from Supabase Authentication.
3. In a privileged SQL dashboard session, run the documented `user_roles` insert using that UUID.
4. Sign out/in or reload the session.
5. Verify signed-out, non-admin, and admin states with separate staging accounts.

### Contact sender

Create and verify the sending domain in Resend before setting `CONTACT_FROM_EMAIL`. Publish the exact SPF and DKIM records Resend supplies. The current registrar-forwarding SPF record must not be replaced or combined by guessing; reconcile it using the provider's documented subdomain/record approach. Add DMARC only with a deliberate policy after both receiving and sending paths are verified.

Run `npm run test:production` to build the allowlisted artifact, exercise archive/contact boundaries with mocks, validate sitemap exclusions, and scan for browser secrets. Real OAuth, Storage, email delivery, signed downloads, and analytics still require staging/deployed credentials.

## Secure download runtime

The browser posts `{ "resourceId": "<uuid>" }` to `/api/resource-download` with the current Supabase access token in the Authorization header. Local static preview does not emulate Netlify Functions. End-to-end testing therefore requires either `netlify dev` with all three Supabase server values or a deployed Netlify environment:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — server-only; never expose it to the browser.

The existing function keeps the resource bucket private, verifies the user, reads the canonical file path server-side, creates a five-minute signed URL, and records the download event. Stronger platform-level rate limiting remains a future defense-in-depth enhancement.

## Working rules

- Keep frontend phases within their approved scope; Phase 02 includes only the global design system, navigation, hero, and a minimal post-hero route index.
- Do not implement the resource or admin UI beyond the existing shells until their frontend phases are approved.
- Prefer small, reviewable files.

## Recommended order

1. Finalize content model and route contract.
2. Add data-fetching helpers.
3. Build the public portfolio shell.
4. Build resource browsing and detail views.
5. Add saved items and admin surfaces.

## Bootstrap notes

- Grant the initial admin manually by inserting the user’s `auth.users.id` into `public.user_roles`.
- Keep the `resources` bucket private and use signed URLs for controlled downloads.
- Treat server-only secrets as backend-only values, never as browser configuration.

## Validation checklist

- Static pages load locally.
- Netlify redirects resolve correctly.
- Supabase schema applies cleanly.
- RLS policies match the access model.
- No browser secrets are present.
