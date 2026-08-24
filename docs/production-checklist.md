# EugenIX production checklist

Use a disposable/staging project and a Netlify deploy preview before production. Record the operator, date, project/site IDs, migration output, and rollback point without copying secrets into this document.

## Validation snapshot — 2026-08-24

- `eugenix.dev` currently resolves to `192.64.119.151`; HTTP is served by Namecheap URL Forward and redirects to `www.eugenix.dev`.
- `www.eugenix.dev` is a CNAME to `parkingpage.namecheap.com`, not the EugenIX Netlify application.
- The apex HTTPS request timed out, so deployed Netlify routes and headers could not be validated.
- MX records use Namecheap email forwarding. The observed SPF record is `v=spf1 include:spf.efwd.registrar-servers.com ~all`; Resend DKIM/sender verification was not present or verified.
- This snapshot is diagnostic evidence, not a DNS-change instruction. Re-check immediately before deployment because DNS is time-dependent.

## Phase 09.1 status register

This register is the authoritative status for every checklist item below as of 2026-08-24. `PASS` requires direct evidence at the scope stated; local-only evidence does not pass an item that requires deployed staging. Summary: **PASS 8 / FAIL 1 / BLOCKED 46 / NOT APPLICABLE 2**.

| ID | Checklist item | Status | Evidence |
| --- | --- | --- | --- |
| DNS-1 | Point domain to Netlify and verify HTTPS | BLOCKED | No linked Netlify staging site/account. |
| DNS-2 | Confirm apex/www/certificate/canonical behavior | FAIL | Apex uses Namecheap forwarding, www is parked, and apex HTTPS timed out. |
| DNS-3 | Preserve inbound MX/SPF during sender setup | PASS | A, CNAME, MX, and TXT inventory captured read-only; no DNS was mutated. |
| DNS-4 | Verify Resend SPF/DKIM/DMARC alignment | BLOCKED | No Resend domain/sender; no `_dmarc` TXT record found. |
| DB-1 | Create/select staging Supabase project | BLOCKED | No credentials, project link, CLI, or Docker. |
| DB-2 | Capture staging backup/rollback point | BLOCKED | No staging project. |
| DB-3 | Apply migrations 0001–0007 | BLOCKED | No database connection. |
| DB-4 | Stop/record first migration failure | NOT APPLICABLE | No migration execution was started. |
| DB-5 | Confirm canonical six-category rows | BLOCKED | No live rows can be queried. |
| DB-6 | Resolve ambiguous referenced categories | NOT APPLICABLE | No staging legacy rows are available. |
| DB-7 | Confirm objects, RLS, policies, and bucket | BLOCKED | No staging project. |
| DB-8 | Execute Phase 07/08 pgTAP | BLOCKED | No Supabase PostgreSQL test target. |
| AUTH-1 | Enable Google in Supabase | BLOCKED | No Supabase/Google project authorization. |
| AUTH-2 | Configure exact provider callback | BLOCKED | Staging project and OAuth client unavailable. |
| AUTH-3 | Configure Site URL and callback allowlist | BLOCKED | No preview URL or Supabase access. |
| AUTH-4 | Validate real safe return behavior | BLOCKED | Local validator passed; real OAuth was not exercised. |
| AUTH-5 | Bootstrap exact Admin UUID | BLOCKED | No genuine Google session/user UUID. |
| AUTH-6 | Verify signed-out/non-admin/admin/expiry states | BLOCKED | Signed-out local state passed; Users A/B and Admin do not exist. |
| RES-1 | Create staging resource/file | BLOCKED | No staging Admin/database. |
| RES-2 | Exercise draft/publish/unpublish/archive/restore | BLOCKED | Implemented locally, not executed remotely. |
| RES-3 | Verify draft/archive public exclusion | BLOCKED | Local assertions only; staging RLS unavailable. |
| RES-4 | Verify archive history retention | BLOCKED | Requires real bookmarks/downloads. |
| RES-5 | Test Storage file allowlists/limit | BLOCKED | Browser checks pass locally; real Storage unavailable. |
| RES-6 | Verify normal-user Storage denial | BLOCKED | No bucket or genuine user. |
| RES-7 | Verify Save/Unsave persistence | BLOCKED | User A unavailable. |
| RES-8 | Verify two-user Saved isolation | BLOCKED | Users A/B unavailable. |
| RES-9 | Execute download negative cases | BLOCKED | Local guards exist; no deployed Function/data. |
| RES-10 | Complete genuine download and analytics | BLOCKED | No deployed Function or published staging resource. |
| ADM-1 | Verify real privacy-limited user fields | BLOCKED | No real profile. |
| ADM-2 | Verify genuine analytics values | BLOCKED | No real events. |
| ADM-3 | Verify normal-user Admin RPC denial | BLOCKED | No normal authenticated staging session. |
| ADM-4 | Verify archive Admin visibility/count | BLOCKED | Migration and Admin session unavailable. |
| NET-1 | Set browser-safe Supabase variables | BLOCKED | No staging values or linked Netlify site. |
| NET-2 | Set server-only Supabase/Resend variables | BLOCKED | Credentials and verified sender unavailable. |
| NET-3 | Set/default contact recipient | PASS | Server defaults to `ndemeeugene237@gmail.com`. |
| NET-4 | Build allowlisted artifact | PASS | `npm run test:production` passed; 51 public files. |
| NET-5 | Deploy preview | BLOCKED | No authenticated Netlify site/CLI. |
| NET-6 | Verify real contact delivery | BLOCKED | No sender, API key, deploy, or inbox evidence. |
| NET-7 | Validate deployed contact negatives | BLOCKED | Local mocked cases pass; deployed cases unavailable. |
| NET-8 | Verify real From/Reply-To/plain-text message | BLOCKED | Implemented/mocked only. |
| SEC-1 | Scan actual staged build with environment scopes | BLOCKED | Local scan passed; no Netlify build/environment exists. |
| SEC-2 | Verify deployed security headers | BLOCKED | No staging response. |
| SEC-3 | Verify deployed Admin/Saved indexing controls | BLOCKED | Local files pass; no staging response. |
| SEC-4 | Exclude private/fabricated URLs from sitemap | PASS | Generated sitemap contains neither private route nor detail fixtures. |
| SEC-5 | Verify Resource Hub metadata | PASS | Generated artifact contains title, description, canonical, and Open Graph fields. |
| SEC-6 | Document client-rendered detail SEO limits | PASS | Documented in architecture/production guidance. |
| SEC-7 | Run deployed 280–1440 route regression | BLOCKED | Local 45-audit suite passed; no staging URL. |
| SEC-8 | Run deployed accessibility regression | BLOCKED | Local checks passed; auth/Save/Admin staging flows unavailable. |
| SEC-9 | Test physical Android and iPhone devices | BLOCKED | No physical-device access. |
| SEC-10 | Run deployed performance/network review | BLOCKED | Local sizes recorded; no Lighthouse/staging network evidence. |
| OPS-1 | Verify actual Supabase backup/PITR | BLOCKED | No project/plan. |
| OPS-2 | Record pre-migration backup/export | BLOCKED | No staging database. |
| OPS-3 | Test Netlify deploy rollback | BLOCKED | No deploy history/site. |
| OPS-4 | Document bad-migration recovery | PASS | Forward-correction and verified-backup rules documented. |
| OPS-5 | Document bad-resource-publish recovery | PASS | Unpublish/archive preserves history; hard delete is excluded. |
| OPS-6 | Verify Netlify/Supabase/Resend logs | BLOCKED | Services are unavailable/unlinked. |
| OPS-7 | Obtain approval to promote preview | BLOCKED | No preview exists. |

## DNS and domain

- [ ] Point `eugenix.dev` to the intended Netlify site and verify HTTPS.
- [ ] Confirm the apex and `www` behavior, certificate, and canonical host.
- [ ] Preserve working inbound-mail MX/SPF records while adding only provider-issued sending records.
- [ ] Verify Resend SPF and DKIM; introduce DMARC deliberately after alignment checks.

## Supabase and migrations

- [ ] Create/select a disposable staging Supabase project.
- [ ] Capture a staging backup/rollback point.
- [ ] Apply `0001_initial.sql` through `0007_resource_archiving.sql` in exact order.
- [ ] Stop at the first failure; record its SQLSTATE and create a forward corrective migration if required.
- [ ] Confirm exactly: Documentation, Engineering Notes, Web, Mobile, System Design, AI Prompts.
- [ ] If referenced AI, Vibe Coding, Tech, or another unknown category blocks `0004`, obtain an editorial mapping before continuing.
- [ ] Confirm tables, constraints, indexes, trigger, functions, RLS, policies, and the private `resources` bucket.
- [ ] Run Phase 07 and Phase 08 pgTAP suites and record exact pass/fail totals.

## Authentication and initial admin

- [ ] Enable Google in Supabase; store the client secret only there.
- [ ] Configure Google's exact Supabase provider callback.
- [ ] Configure Supabase Site URL as `https://eugenix.dev` and explicit local/preview/production callbacks.
- [ ] Validate approved return paths and rejection of external, protocol-relative, JavaScript, backslash, and unapproved paths.
- [ ] Sign in normally, obtain the user UUID, and assign `user_roles.role = 'admin'` through privileged SQL.
- [ ] Verify signed-out, signed-in non-admin, authorized admin, expiry, and no-content-flash states.

## Resources, Saved, Storage, and downloads

- [ ] Create a clearly named staging resource and approved test file.
- [ ] Validate draft → publish → unpublish → archive → restore-to-draft.
- [ ] Confirm drafts/archives are absent from public catalog/detail and cannot be newly saved/downloaded.
- [ ] Confirm archive retains the row, private object, bookmark history, download history, and aggregate analytics.
- [ ] Test PDF, DOCX, Markdown, and ZIP allowlists and the 50 MB limit.
- [ ] Confirm a normal user cannot upload, replace, delete, or list private resource objects.
- [ ] Save/unsave with a real user and verify persistence after reload/browser restart.
- [ ] Verify cross-user Saved isolation with two staging users.
- [ ] Validate signed-out, invalid-token, invalid-UUID, draft, archived, unsafe-path, and signed-URL-origin download failures.
- [ ] Complete one genuine signed download and verify download/resource/category/recent-activity analytics.

## Admin analytics

- [ ] Confirm real user profile fields without email/provider metadata.
- [ ] Confirm real save/download totals, resource/category metrics, trends, and activity.
- [ ] Confirm every Admin RPC rejects the normal authenticated user.
- [ ] Confirm archive remains visible in Admin and is counted separately from drafts/live resources.

## Netlify and contact delivery

- [ ] Set browser-safe `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.
- [ ] Set production-scoped `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, and verified `CONTACT_FROM_EMAIL`.
- [ ] Set `CONTACT_TO_EMAIL` or accept the documented default recipient.
- [ ] Run `npm run test:production`; confirm `dist/` contains only allowlisted public files.
- [ ] Deploy a preview before production.
- [ ] Submit a valid contact message and confirm Resend acceptance and recipient delivery.
- [ ] Validate POST-only, invalid body, oversized body, field limits, email validation, honeypot, and provider-failure behavior.
- [ ] Confirm sender, Reply-To, and plain-text content.

## Security, SEO, performance, and accessibility

- [ ] Run the public-artifact secret scan with production environment scopes.
- [ ] Verify deployed CSP, `frame-ancestors`, nosniff, Referrer Policy, and Permissions Policy.
- [ ] Verify `/admin/` and `/saved/` noindex behavior and robots exclusions.
- [ ] Confirm sitemap contains no private routes and no fabricated resource-detail URLs.
- [ ] Confirm Resource Hub title, description, canonical URL, and social metadata.
- [ ] Document client-rendered resource-detail SEO limitations.
- [ ] Test homepage, Hub, detail, Saved, Admin, and contact at 280, 320, 360, 390, 414, 430, 768, 1024, and 1440px.
- [ ] Perform keyboard, focus, label, menu, form-error, auth, Save, Admin, and reduced-motion checks.
- [ ] Test one physical narrow Android device and one physical iPhone-class device.
- [ ] Review page transfer sizes, blocking resources, layout shift, and browser console/network failures.

## Backup, monitoring, and rollback

- [ ] Verify the Supabase plan's actual backup/PITR capability; do not assume it is enabled.
- [ ] Record the pre-migration backup or export and restoration procedure.
- [ ] Failed deploy: restore the last known-good immutable Netlify deploy.
- [ ] Bad migration: stop writes if necessary, preserve evidence, and use a reviewed forward corrective migration; restore only from a verified backup when appropriate.
- [ ] Bad resource publish: unpublish or archive it; do not delete historical records.
- [ ] Check Netlify Function/deploy logs, Supabase Auth/Postgres/Storage logs, and Resend delivery logs during staging validation.
- [ ] Obtain final approval before promoting the deploy preview to `eugenix.dev`.
