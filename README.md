# EugenIX

EugenIX is a portfolio and resource platform for Eugene Eyambe Ndeme.

This repository contains the production-candidate EugenIX portfolio and resource platform:

- project structure
- architecture and security documentation
- Supabase schema and RLS foundation
- private storage rules and signed-download architecture
- static hosting and deployment config
- public Resource Hub, private Saved library, and private Admin CMS
- a tokenized dark/orange design system
- responsive public navigation and an accessible mobile menu
- the statement-led EugenIX hero experience

The production artifact is generated into `dist/` from an explicit public-file allowlist. Supabase migrations and Netlify Functions are deployed separately and are never copied into the static artifact.

## Local preview

Run `npm run dev`, then open `http://127.0.0.1:4173`.

Run `npm run test:production` before a deploy. Production integration requires the environment and external setup documented in [docs/production-checklist.md](docs/production-checklist.md).

## Current scope

- Public portfolio
- Work detail routes
- Resource browsing and resource detail routes
- Saved items area
- Admin area
- Resume page
- Trusted contact submission path

## Project rules

- Use semantic HTML, plain CSS, and vanilla JavaScript.
- Keep browser-side secrets out of the client.
- Enforce authorization with Supabase RLS.
- Treat the database schema as the source of truth for protected data.

## Files to read first

- [docs/architecture.md](docs/architecture.md)
- [docs/database.md](docs/database.md)
- [docs/security.md](docs/security.md)
- [docs/development.md](docs/development.md)
- [supabase/migrations/0001_initial.sql](supabase/migrations/0001_initial.sql)
- [supabase/migrations/0002_security_hardening.sql](supabase/migrations/0002_security_hardening.sql)
- [supabase/migrations/0003_profile_trigger_and_download_boundary.sql](supabase/migrations/0003_profile_trigger_and_download_boundary.sql)
- [netlify/functions/resource-download.js](netlify/functions/resource-download.js)
