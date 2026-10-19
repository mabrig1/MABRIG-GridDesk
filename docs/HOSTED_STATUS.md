# Hosted backend status — 19 October 2026

- Organization: Become Enterprises.
- Project: MABRIG-GridDesk (`fudusieijsywbjjtzdrs`).
- Region: eu-west-1. Project creation returned ACTIVE_HEALTHY.
- Quoted project cost at creation: USD 0 per month. No nonzero cost was approved.
- Project dashboard: https://supabase.com/dashboard/project/fudusieijsywbjjtzdrs
- Public API URL: https://fudusieijsywbjjtzdrs.supabase.co
- Migration `minigrid_initial_schema` applied successfully.
- Six tables verified with RLS enabled; eight public-table policies verified.
- Authenticated direct balance UPDATE and payment INSERT privileges are false; anonymous RPC execute privilege is false.
- Hosted transactional security checks passed using two synthetic auth.users records and SQL JWT claim fixtures. The tests cover isolation, tampering, backend demo gating, retries, invalid amounts, revenue separation and mid-transaction rollback. All fixture changes rolled back. Final counts: zero operators, tenants and payments; demo_enabled=false.
- Real HTTPS anonymous GET requests to operators, tenants, payments and energy_logs returned HTTP 401 using the project's publishable key.
- The frontend was configured with the real public URL/key. No secret/service-role key was retrieved or used. Cloudflare values are in `docs/CLOUDFLARE_PUBLIC_ENV.txt`.

## Advisory review

Supabase reported three intentional SECURITY DEFINER RPC warnings and two informational private-table deny-all RLS findings. These are not presented as a zero-warning audit. The three RPCs require elevated database privileges for secure onboarding, private demo-permission lookup and atomic credit writes. EXECUTE is denied to PUBLIC/anon, and authenticated calls validate identity, ownership and backend permissions. All functions have fixed empty search paths. The two private tables intentionally have no client access policies or grants.

- Privileged RPC guidance: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- Deny-all RLS guidance: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

## Still to verify

This is a hosted PostgreSQL/RLS test, not a completed Supabase Auth signup/login or simultaneous HTTPS concurrency test. Those require real disposable test sessions. The backend is empty and simulations remain off. Use a separate demo environment with an administrator allowlist before simulations. No frontend URL is deployed yet. The selected repository is https://github.com/mabrig1/MABRIG-GridDesk. Cloudflare Pages account access and target remain outstanding. Configure Auth Site URL and exact `/auth/callback/` redirects after the deployment URL is known. Verify email delivery and connected UI flows then.
