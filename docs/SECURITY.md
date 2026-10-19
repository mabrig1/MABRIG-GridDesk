# Security model and release boundaries

## Trust boundaries
The static page is public code. UI route protection improves navigation only; authorization lives in PostgreSQL grants, RLS and validated RPCs. An authenticated JWT is required for data. Browser code never receives a database password or service-role key.

| Operation | Enforcement |
| --- | --- |
| Operator profile | Own-row SELECT and company_name UPDATE; creation via authenticated onboarding RPC |
| Tenant create/edit | Owner RLS + restricted column grants; owner UUID cannot be changed |
| Credit balance | No authenticated INSERT/UPDATE privilege on current_balance |
| Payments | Authenticated SELECT only through owning tenant; no direct client writes |
| Energy logs | Owned-tenant SELECT/INSERT; nonnegative bounded amounts; no client changes/deletes |
| Simulation | Private backend environment flag + private operator allowlist + ownership and amount validation |
| Summary | SECURITY INVOKER so RLS scopes every aggregate |

No DELETE policy/grant is present for operational records. Deactivate tenants. Foreign keys use RESTRICT to preserve records. Demo admin changes are restricted to trusted SQL/migration tooling, not Auth user metadata.

## Atomicity and retry semantics
`simulate_payment` is one PostgreSQL transaction. It locks the backend config and allowlist entries, acquires an advisory transaction lock for the idempotency key, and locks the owned tenant row. A unique payment idempotency key backs up serialization. Matching retries return the existing payment and **current authoritative tenant balance**, which may include later valid payments. Reusing a key for another tenant/amount fails. Inactive tenants reject new payments but matching retries can reconcile already committed ones.

Payment insertion and balance update are in the same transaction. Overflow or any other exception rolls back both. A database row lock serializes distinct payments for the same tenant, preventing lost updates. Advisory hash collisions can unnecessarily serialize unrelated keys but cannot duplicate credit. Fixed empty search paths and schema-qualified objects prevent search-path object substitution. `PUBLIC` and `anon` have no execute privilege on exposed application RPCs.

Native lock/concurrency behaviour needs the hosted test suite; the local PGlite suite is a single PostgreSQL/WASM connection. Do not represent local tests as hosted Supabase verification.

## Demo isolation
The base migration creates simulation config as false, with an empty allowlist. Use a separate demo project, containing fictional tenant data, to enable it. The code cannot infer your provider account's business designation; isolation is provisioned by choosing separate projects, then enforced by independent backend config and allowlist. Never enable simulation in the production project. No simulation contacts a real provider or meter.

## Browser data and low bandwidth
Explicit selected columns, ten-row pagination, debounced name/meter search, no external fonts/images and server aggregates limit routine transfers. The framework/auth JavaScript still has a nonzero first-load cost. No service worker caches private operational data. Displayed data and draft forms can remain in memory/tab storage during an outage; authenticated saves still require HTTPS.

Tenant and energy drafts contain personal operational data in sessionStorage, isolated by operator UUID and tab. They clear on successful save/sign-out. The unresolved payment intent contains only UUID reference, tenant UUID, user UUID and amount; it intentionally survives sign-out in the same tab to avoid losing reconciliation context. Closing the tab, clearing browser data, or storage eviction can still lose it. Record the displayed reference before doing so. Cross-device draft sync is not implemented. There is no silent retry loop for payments and no fresh-key replay.

Supabase SDK stores browser Auth session tokens in cookies suitable for this static client architecture; they are accessible to JavaScript, so XSS prevention matters. React escapes user-controlled content; the app uses no raw HTML injection. Headers deny framing and unnecessary device permissions. The CSP permits inline scripts required by this static Next build; hash-based hardening remains a roadmap item.

## Before a public pilot
Verify Auth email delivery, correct redirect URLs, rate limits, backups, operator consent and retention, hosted RLS tests, native concurrency, monitoring and support. Real payment/provider and meter integrations need dedicated verification and a ledger/reconciliation design. This MVP is not an independent security certification.
