# GridDesk — Mini-Grid Operator Dashboard

A grant-demonstration MVP by MABRIG for Nigerian mini-grid operators. Operators often juggle paper records, disconnected spreadsheets and manual credit reconciliation. GridDesk brings tenant records, naira credit, collections and manual energy logs into a small responsive workspace.

Repository: https://github.com/mabrig1/MABRIG-GridDesk

Cloudflare Pages publication is pending. The Supabase backend is provisioned; see [hosted status](docs/HOSTED_STATUS.md).

## Reporting and visual insights
- Two accessibility-labelled, responsive bar-chart cards show collection composition
  (real/non-simulated and simulated **separately**) and tenant/energy proportions
  using the existing authoritative `dashboard_summary` RPC.
- Export tenant, payment or energy CSVs from the current tab, including the
  filtered tenant search. Authenticated exports are fetched from Supabase under
  existing per-operator row-level security. The export is limited to **1,000**
  records, with an explicit warning and `partial` filename if truncated.
- CSV output neutralizes leading spreadsheet-formula characters in user-entered
  text, carries column units and UTC date labels, and marks fictional sample
  downloads in their filenames. Exported records are ordinary convenience
  reports, **not immutable audit statements** or independently reconciled funds.
- No backend migration, external chart service, new package, or payment-provider
  integration is required.

## What works in the implementation
- Landing page and explicitly fictional, read-only sample dashboard at `/demo/`.
- Supabase email/password signup, login, PKCE callback, company onboarding and logout.
- Protected dashboard with tenant creation/editing, debounced search, business filters and paginated records.
- shadcn/ui Table composition, responsive layout, NGN formatting and manual energy logging.
- Successful real revenue separated from simulated collections. Active businesses are active non-household tenants. Summary RPC covers all visible records, independent of pagination.
- Atomic demo-only payment RPC, ownership validation, fixed search path, row locks, advisory idempotency locks, stable retry references and backend-confirmed receipts.
- Visible offline state, 20-second HTTP timeout, retry feedback and tab-scoped draft preservation. No offline billing claims.

## Quick start
Requires Node 22 or newer.

```bash
npm ci
cp .env.example .env.local
# Put your public project URL + publishable (or anon) key in .env.local.
# For a NEW backend, apply the migration once. Already applied to MABRIG-GridDesk.
npm run dev
```

Without Supabase values, `/demo/` is still a read-only sample. There is no local fallback that pretends to authenticate or process a payment.

```bash
npm run typecheck
npm run lint
npm test
npm run test:db
npm run build
npm run preview
```

See [deployment instructions](docs/DEPLOYMENT.md), [testing and evidence](docs/TESTING.md), [security model](docs/SECURITY.md), and [copy-paste SQL handover](docs/HANDOVER.md).

## Architecture
Next.js 16.4.2 App Router + React + TypeScript + Tailwind + shadcn/ui source components → static Cloudflare Pages HTML/JS → Supabase Auth and Data API over HTTPS → PostgreSQL RLS and transactional RPCs.

No Server Actions or Pages server runtime. No service-role key in the dashboard. `lib/supabase.ts` uses `createBrowserClient` from `@supabase/ssr`. `app/dashboard/page.tsx` composes the dashboard. `lib/payments.ts` calls `simulate_payment`, never a separate payment insert and balance update.

## Demo walkthrough
1. Open `/demo/` to inspect fictional data and switch between Overview, Payments and Energy usage.
2. For a working connected demo, use a **separate demo Supabase project**, apply migration, sign up/confirm email and onboard.
3. As administrator, enable demo mode and allowlist that operator using `supabase/demo-enable.sql`.
4. Add a household and a welder. Active Businesses counts the welder only.
5. Simulate ₦2,500 credit for the welder. The receipt shows the backend balance; payment history says SIMULATED and real revenue stays zero.
6. Disconnect during a request and retry with the retained reference. Never create a new reference to resolve an uncertain payment.
7. Log 12.5 kWh. This adds usage, without deducting credit or affecting a physical meter.

## Security and privacy
RLS isolates operators. Column grants deny direct credit changes and payment forgery. Secure onboarding takes identity from Auth. Tenant ownership is immutable. There are no client DELETE grants: deactivate tenants to retain audit records. Simulations are off by default, and require an admin-only backend flag and allowlist in a separate demo project.

Draft tenant and energy input is stored in sessionStorage, scoped to operator and tab, cleared on success/sign-out. Unresolved payment reference/tenant UUID/amount remain until confirmed or the tab closes, even across sign-out, so the same operator can reconcile. No password is stored by application draft code. Do not close the tab or clear storage while a payment is uncertain; retain its reference and inspect payment history. Supabase Auth manages its browser session cookies. Shared devices should always be signed out. No analytics or third-party images/fonts are included.

## Current limitations
This is an implementation and demonstration MVP, not a certified production billing system. Supabase project MABRIG-GridDesk has been created and its migration applied. Hosted SQL/RLS checks and anonymous HTTPS rejection checks passed. Actual Auth signup/login, email delivery, a live frontend domain and native concurrent HTTPS RPC behaviour still require deployment verification. See docs/HOSTED_STATUS.md. Local SQL tests emulate Auth claims; browser integration tests mock HTTPS. Detailed outcomes are recorded in TESTING.md.

No real payment provider, webhook verification, reconciliation/import pipeline, tariffs, automatic credit debits, remote meter activation, smart-meter integration, refunds, multi-staff roles, password recovery UI or full offline operation. Meter IDs are user-entered, not validated against physical equipment. Real revenue remains zero until a future trusted integration records verified non-simulated payments. Usage logs are manual, append-only and must represent non-overlapping intervals. Read-only sample numbers are illustrations, never achieved impact.

## Roadmap
1. Operator field trials, accessibility audit, monitoring, backup/restore exercises and support workflow.
2. Verified Paystack/Flutterwave ingestion with signed webhooks, unique provider references, idempotent ledger, reconciliation and refunds; do not expose service credentials to clients.
3. Versioned tariffs, consumption debit ledger and reconciliation before calling credit a billing system.
4. Verified meter-provider APIs, authenticated telemetry, equipment tests and audited control approvals.
5. Staff roles, controlled corrections, CSV export, advanced usage summaries and explicit privacy retention policies.

## Grant impact statement
“Mini-grid operators in Nigeria often rely on manual billing and fragmented records, making it difficult to track customer credit, collections, and productive energy use. Our serverless dashboard brings tenant management, payment records, and energy monitoring into one accessible workspace. Lightweight pages delivered through Cloudflare and secure Supabase HTTPS requests reduce dependence on direct database connections, while clear retry handling supports use on intermittent networks.”

## Proposed pilot targets — not achieved results
| Metric | Proposed target | Measurement |
| --- | --- | --- |
| Pilot adoption | 3 operators / 150 tenant records over 90 days | Consented operator onboarding and record counts |
| Record completeness | ≥95% of pilot tenants with a unique meter ID and business type | Weekly completeness audit |
| Administrative effort | 30% reduction in time preparing collection summaries | Before/after timed task study |
| Retry reliability | Zero duplicate credits in controlled retry tests | Idempotency audit and outage test logs |
| Productive-use visibility | Weekly energy entries for ≥80% of pilot business tenants | Log completeness against consented pilot roster |

Targets require baseline measurement, consent, field testing and independent review before any impact claim.
