# Verification record — 19 October 2026

## Results

| Check | Outcome | Scope |
| --- | --- | --- |
| Dependency installation | Passed; npm install and clean npm ci | Local Node 24.19.0; Node ≥22 required |
| TypeScript | Passed | `npm run typecheck` |
| ESLint | Passed, no warnings | `npm run lint` |
| Unit tests | 3 passed | Amount validation, search safety, NGN/sample totals |
| Database tests | 28 passed | Real PostgreSQL/WASM engine (PGlite); local Auth schema/JWT fixtures |
| Production build | Passed | Next.js 16.4.2 static export, all application routes emitted |
| Browser tests | 6 passed | Desktop 1280×720 and emulated Android viewport 360×800 |
| Final unconfigured export recheck | 4 passed | Static/sample routes and offline state on desktop/mobile |
| Mobile visual inspection | Passed | Screenshot review: stacked totals, tenant cards, visible balances/actions, no body horizontal overflow |
| Production dependency audit | 0 reported vulnerabilities | `npm audit --omit=dev`; registry snapshot, not a security certification |
| Hosted database security | Passed | Transactional SQL tests with two synthetic Auth/claim fixtures; all rolled back |
| Hosted anonymous HTTPS access | Passed | HTTP 401 on all four operational tables |
| Hosted Auth and concurrent HTTPS tests | Not run | No real disposable test sessions yet |
| Native concurrent DB requests | NOT verified | PGlite is a single-connection engine; hosted harness supplied |
| Public deployment/live URL | NOT performed | No repository target or Cloudflare account/deployment target supplied |
| Real money / physical meters | NOT implemented | Simulations and manual logs only |

The hosted migration has now been applied. No frontend deployment, provider transaction or meter change is claimed. See HOSTED_STATUS.md.

## What local database tests exercised
Two different operators, anonymous role, secure onboarding identity/email, cross-owner reads and updates, forged ownership inserts, balance and payment tampering, immutable tenant ownership trigger, meter uniqueness, simulation-off default, missing allowlist, client attempts to change private settings, unauthenticated/cross-tenant RPC calls, invalid amounts (including NaN/Infinity), atomic payment result, identical-key retry, key/tenant/amount conflict, payment/log isolation, energy validation, real-vs-simulated revenue, failed-payment exclusion, rollback after a balance overflow, inactive-tenant rules, forbidden deletion/payment edits, demo revocation, and aggregates spanning 13 tenant records while excluding households from active businesses.

PGlite executes the actual migration, not a handwritten SQL mock. Supabase Auth itself, PostgREST, hosted JWT verification, connection pooling and cross-connection concurrency are not present in this local test.

## What browser tests exercised
Landing and sample navigation, debounced search, business-type filter, payment and energy tabs, static deep routes, offline/online messaging, no body overflow, and absence of sample-page JavaScript errors.

The authenticated test signs in through the real browser SDK against **mocked HTTPS endpoints**, creates/edits a tenant, submits a simulation where the mock commits then drops the response, reloads the page, verifies the saved idempotency key is reused, confirms one payment only, logs energy, views payment history and signs out. It runs in both viewports. Mocked UI results are not evidence that a hosted backend works.

The default Playwright browser download failed in this environment. A locally extracted Chromium 153 binary was used through `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`, with sandbox-compatible launch flags. This was browser emulation, not a physical Redmi/Android device test. Screenshots were inspected internally and are not shipped as account data.

## Reproduce local checks

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run test:db
npm run build
```

For browser tests, build with the explicit **fake test-only values** below. They are not credentials and must never be deployed:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://test-minigrid.supabase.co \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test_only_not_a_real_key \
npm run build
npx playwright install chromium
npm run test:e2e
```

The authenticated test is skipped on an unconfigured build. If a local Chromium is already available, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its path. Standard environments need no override. After tests, rebuild with your actual project variables. The `out/` directory included in the archive is a **build configured for the new Supabase backend**; its /demo/ route still uses fictional local records.

## Hosted two-operator/concurrency suite (prepared, not run)
Use a disposable demo Supabase project, never live operational data. Apply the migration. Create and confirm two email/password users, onboard them, then enable simulation and allowlist both UUIDs using trusted admin SQL. The test uses ordinary public-key clients and each user's session; it never uses a service-role key.

Set these values in a private shell or ignored local environment. Do not commit them, paste passwords into chat, or put them in NEXT_PUBLIC_*:

```dotenv
ALLOW_DISPOSABLE_INTEGRATION=yes
TEST_SUPABASE_URL=https://YOUR_DEMO_PROJECT.supabase.co
TEST_SUPABASE_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
TEST_A_EMAIL=YOUR_FIRST_TEST_EMAIL
TEST_A_PASSWORD=YOUR_FIRST_TEST_PASSWORD
TEST_B_EMAIL=YOUR_SECOND_TEST_EMAIL
TEST_B_PASSWORD=YOUR_SECOND_TEST_PASSWORD
```

Run `npm run test:supabase`. It refuses to run without explicit disposable-project opt-in. The suite checks isolation/tampering and sends eight simultaneous identical-key requests plus ten simultaneous distinct payments to one tenant. Expected balance after those two groups: ₦132.50. It also checks invalid operations and real-revenue exclusion. It retains test records and deactivates successful test tenants; reset/delete the disposable project administratively after review. Mid-transaction failure injection is exercised by local balance-overflow tests; do not damage a production account to reproduce it.

## Release gates still open
- Apply the exact migration to the chosen hosted Supabase project and verify actual API privileges/RLS.
- Run the hosted two-user and concurrent-request tests.
- Verify real email confirmation, login, callback URLs, onboarding and recovery/support procedure.
- Deploy the final rebuild to the chosen Cloudflare Pages account, verify direct deep links and response headers, and repeat a connected demo payment.
- Treat all proposed grant impact metrics as pilot targets until measured.

## Backend provisioning update

The dedicated MABRIG-GridDesk project was created after the user selected Become Enterprises. The migration and hosted transaction-based security suite succeeded, and anonymous HTTPS access was rejected. See HOSTED_STATUS.md for the exact scope. The remaining target is GitHub/Cloudflare frontend deployment plus real Auth and concurrency verification.
