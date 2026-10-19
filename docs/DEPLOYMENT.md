# Deployment: static Next.js on Cloudflare Pages

## Version decision (verified 19 October 2026)
Next.js 14 is outside support. Next.js 16 is Active LTS. This project pins **16.4.2**, the npm stable release retrieved during this build, newer than the 16.4.1 security patch announced on 14 October. React is pinned to 19.3.1. Recheck advisories before publishing. The lockfile is authoritative.

- https://nextjs.org/support-policy
- https://nextjs.org/blog/nextjs-security-update-october-14-2026
- https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/

`output: 'export'` and `trailingSlash: true` produce HTML for every route. There is no Node runtime, Server Action, middleware, API route, or Cloudflare adapter. `app/actions/payments.ts` is deliberately absent: a static host cannot execute it. The browser invokes the same transactional PostgreSQL RPC over Supabase HTTPS.

## 1. Supabase
Create one production project and, for simulations, a **separate disposable demo project**. The MABRIG-GridDesk project was created under Become Enterprises at a quoted USD 0/month. Its initial migration is already applied. Do not apply the initial migration again there. Create a separate project for demo simulations; no nonzero cost has been authorized.
1. Open SQL Editor in the chosen project. Run `supabase/migrations/202610190001_minigrid.sql` once. It is transactional and must be run as the project's trusted migration administrator. If any object already exists, the transaction fails rather than overwriting data; review before adapting to an existing schema.
2. In the project **Connect** dialog, copy Project URL. It is also available under Settings / Data API. In **Settings → API Keys**, copy the **publishable** key. A legacy **anon** key is supported as an alternative. Never choose secret or service_role.
3. Enable email/password Auth and email confirmation. For reliable public signup, configure your approved SMTP provider and Auth rate limits. Hosted email defaults can restrict delivery; this has not been configured here.
4. Under **Authentication → URL Configuration**, set **Site URL** to your actual deployed origin, for example `https://YOUR_PROJECT.pages.dev`. Add exact allowed Redirect URLs:
   - `https://YOUR_PROJECT.pages.dev/auth/callback/`
   - `http://localhost:3000/auth/callback/` for local development only
   - Your verified custom domain's `/auth/callback/` if used.
   Use explicit trusted origins. Avoid broad wildcards for production.
5. PKCE email confirmation should open in the same browser where signup started. If opened elsewhere, confirm email then return to sign in. No server-side callback is used.
6. Sign up, confirm email, sign in, and complete the company-name onboarding. The RPC derives the operator ID and email from Auth, not client-supplied ownership.

Sources: https://supabase.com/docs/guides/getting-started/api-keys and https://supabase.com/docs/guides/auth/redirect-urls

## 2. Environment variables
Copy `.env.example` to `.env.local` for development. Required:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```
Legacy alternative: use `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead of the publishable variable. If both exist, the publishable key wins. These values are public identifiers; access depends on authenticated JWTs, RLS, column privileges and RPC checks. Never put database passwords, secret API keys, service-role keys or payment-provider secrets in NEXT_PUBLIC_*.

These are **build-time** variables, inlined into frontend JavaScript. Changing them requires rebuilding and redeploying. There are no Pages runtime secrets for ordinary dashboard operations. A build with no values succeeds but displays a setup screen. The public sample route remains available. That is not a connected deployment.

## 3. Cloudflare Pages
Connect `mabrig1/MABRIG-GridDesk` (production branch `main`) in **Workers & Pages → Create application → Pages → Connect to Git**. Do not accidentally choose a Workers full-stack preset.

| Setting | Value |
| --- | --- |
| Framework preset | Next.js (Static HTML Export), or None with the values below |
| Root directory | Repository root containing package.json |
| Build command | `npm ci && npm run build` |
| Build output directory | `out` |
| Node version | 22 (also pinned in .node-version) |
| Production variables | The two public Supabase values for the production project |
| Demo preview variables | Values for the separate demo Supabase project |

Alternatively, after `npm ci && npm run build`, upload `out/` as a Pages Direct Upload project. `wrangler.toml` describes the output directory if using Wrangler; sign in and explicitly select the correct account/project before deploying. No account/project ID is invented here.

`public/_headers` adds basic response security headers. It allows Supabase's standard `*.supabase.co` HTTPS origin. If using a custom Supabase domain, update `connect-src` before deployment. The static Next.js bootstrap requires inline script support; a stricter hash-based CSP is future hardening. Do not add a blanket SPA redirect: emitted `dashboard/index.html`, `login/index.html` and callback HTML already support direct loads. Route shell visibility is not authorization; Supabase enforces data access.

## 4. Enable simulations only in a demo backend
In the **demo project's** SQL Editor, inspect `supabase/demo-enable.sql`, replace its placeholder with the onboarded user's UUID from Authentication → Users, and run it. Both the backend flag AND the allowlist entry are required. The frontend reads `demo_access()`; changing HTML or sending a direct RPC cannot bypass the backend checks.

```sql
-- ONLY in a separate disposable DEMO Supabase project:
begin;
update private.environment set demo_enabled = true where singleton;
insert into private.demo_operators(operator_id)
values ('REPLACE_WITH_ONBOARDED_OPERATOR_UUID'::uuid)
on conflict do nothing;
commit;
```

Do not run this in production. No public environment variable grants simulation access. Admins can revoke immediately:

```sql
update private.environment set demo_enabled = false where singleton;
```

## 5. Verify after publication
Load the actual URL and `/dashboard/`, `/login/`, `/signup/`, `/auth/callback/` directly. Sign up two test operators in the demo project, verify onboarding, add a tenant, simulate credit, inspect payment history, log energy and sign out. Run `npm run test:supabase` using disposable credentials (see TESTING.md). Verify Cloudflare response headers and check redirects with your exact domain. Clear all placeholder build values before a production deployment.

## Network model
Cloudflare serves static frontend assets at the edge. Supabase Auth, queries and RPC operations still need HTTPS connectivity. No `DATABASE_URL` is used in the browser. An IPv4 **Session Pooler** connection is optional for trusted administrative or migration tooling that needs IPv4; it still uses a PostgreSQL port and does not bypass blocked database ports. The Supabase SQL Editor avoids distributing database credentials for this setup.
