# Cloudflare Workers build recovery — GridDesk (25 October 2026)

## Confirmed deployment architecture
GitHub checks for commit `b941434` reveal that the existing Cloudflare integration is **Workers Builds: mabrig-griddesk** — a Cloudflare **Worker**, not Cloudflare Pages.

Worker build logs: https://dash.cloudflare.com/462dc7a708c1a89f779f9f61cb693dbf/workers/services/view/mabrig-griddesk/production/builds/4ae0b78f-0989-4f3b-8d06-72abc716236d

The earlier repository `wrangler.toml` was a **Pages** configuration (`pages_build_output_dir = "out"`) and targeted another name (`mabrig-minigrid`), inconsistent with the observed Worker. This is a **likely deployment configuration mismatch**, not yet a proven root cause without Cloudflare's detailed build log.

The existing GridDesk UI uses Next.js static export (`output: "export"`, `trailingSlash: true`), then calls Supabase Auth/Data API directly. Cloudflare Workers **Static Assets** supports this without a Worker JS entry point.

## Repair in this pull request
- Replace the Pages-only configuration with `wrangler.toml` for the **existing Worker name** `mabrig-griddesk`.
- Configure `[assets] directory = "./out"`, `not_found_handling = "404-page"`, and `html_handling = "auto-trailing-slash"`.
- Keep the existing Next.js output/export untouched.
- Add `npm run build:cloudflare` to build and validate generated `out/` routes in CI.
- Make no account, domain, billing, secret, or Supabase data changes.

## Exact settings for the EXISTING Worker
In Cloudflare → **Workers & Pages → mabrig-griddesk → Settings → Build**:

| Field | Value |
|---|---|
| Project type | **Workers** (existing; do not create a second project) |
| Git repository | `mabrig1/MABRIG-GridDesk` |
| Git production branch | `main` |
| Root directory | repository root / blank |
| Build command | `npm run build:cloudflare` |
| Deploy command | `npx wrangler deploy` |
| Node.js version | 22 (already declared in `.node-version`) |
| Static assets | `./out`, configured in `wrangler.toml` |

Cloudflare Workers Builds runs a **build** step and then a **deploy** step. A success in `next build` alone does not deploy the Worker. Do not use Pages commands `wrangler pages deploy` or `@cloudflare/next-on-pages` for this existing Worker.

### Public Supabase build-time variables
In Worker **Build variables** (not just runtime variables), set BOTH:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://fudusieijsywbjjtzdrs.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key from Supabase>
```

Do not use a secret/service-role key or place a key in a public source file. If only one variable is set, the build's safety validator intentionally rejects it. The two values are inlined by Next.js at build time. The domain and Supabase Auth redirect configuration should be updated *only after* a successful deployment and domain verification.

## Verification sequence (reversible)
1. Review PR checks. The `build:cloudflare` task must pass in GitHub Actions.
2. Inspect Cloudflare **Workers Builds** failure details and compare the first error with this fix. Cloudflare project URL above points directly to the corresponding build.
3. With approval, merge the reviewed PR to `main` (or otherwise apply the changes). The connected Worker can then build with the corrected `wrangler.toml`.
4. Verify your **actual** Worker URL in Cloudflare, starting at `/` and `/demo/`, and then sign-in. Confirm `/missing-page/` returns a 404.
5. If the Worker deployment fails, do **not** delete/recreate the project or change DNS. Review the exact first failed Cloudflare step and rollback to the prior Worker version if any working one exists.

## If you actually intend Cloudflare Pages instead
The repository could also be hosted on Pages with `npm run build:cloudflare` and output `out`, using **Next.js (Static HTML Export)**. That is a different Cloudflare project type and needs **Pages-specific** configuration (do not use this Workers `wrangler.toml`). Because GitHub checks identify your existing integration as Workers, avoid creating a new project unless explicitly chosen.

## Authoritative docs
- Cloudflare Workers Builds: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- Workers Static Assets / SSG: https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/
- Cloudflare Pages static Next.js (alternative only): https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/
