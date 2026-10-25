# Cloudflare Pages build recovery — GridDesk (25 October 2026)

This is a **static Next.js export**, not a full-stack Next.js Worker. The UI calls Supabase Auth / Data API from the browser. Its repository uses `output: "export"` and `trailingSlash: true`.

## What is verified and what is not
- At commit `675a02c`, the GitHub Actions quality workflow completed successfully (including the normal `npm run build`).
- The live Cloudflare build log and Cloudflare project settings are **not available through the GitHub connector**. The actual failure cannot be attributed to one cause without that log.
- The previous `wrangler.toml` included a hard-coded Pages project name, `mabrig-minigrid`. This can diverge from the name used when creating an actual Pages project, and a Pages Wrangler configuration with `pages_build_output_dir` becomes a source of truth for the project. This fix removes that unverified configuration. It does **not** change Cloudflare account settings.
- `npm run build:pages` runs the existing production build and then checks the static `out/` artifacts.

## Exact Cloudflare Pages settings to apply in your existing project
Go to Cloudflare dashboard → **Workers & Pages** → your existing **Pages** project → **Settings → Builds** (the label may be **Build & deployments**):

| Field | Value |
|---|---|
| Project kind | **Pages**, not Workers |
| Git repository | `mabrig1/MABRIG-GridDesk` |
| Production branch | `main` |
| Framework | **Next.js (Static HTML Export)**; if absent use **None** with values below |
| Root directory | Repository root (`/` or blank) |
| Build command | `npm run build:pages` |
| Build output directory | `out` |
| Node.js | 22 (already specified in `.node-version`; optionally set `NODE_VERSION=22`) |
| Build image | v3 preferred |

Do **not** use `npx @cloudflare/next-on-pages`, `npx opennextjs-cloudflare build`, `.vercel/output/static`, or `.next` for this static application. The **Next.js** preset (without *Static HTML Export*) can choose the wrong build pipeline. Cloudflare's static-export guide specifies `out`.

## Public build variables
In **Settings → Variables and Secrets**, configure **both** variables for the target environment (Production and, if applicable, Preview):

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://fudusieijsywbjjtzdrs.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<copy the publishable key from Supabase dashboard>
```

Use a **publishable** key, never a Supabase secret or `service_role` key. If only one value is present, the existing safety validator intentionally rejects the build. If neither is present, a **read-only unconfigured sample** can build, but real login will not work. Cloudflare Pages static env variables are embedded at build time; rebuild after changing them.

## Find the actual error
Open **Workers & Pages → your project → Deployments → failed deployment → View build log**. Copy the **first error** and the last ~30 log lines, omitting any secrets. Common signatures:
- `@cloudflare/next-on-pages` / `open-next` errors: wrong full-stack preset; use **Static HTML Export**.
- `Output directory out not found`: inspect the preceding `npm run build:pages` error and confirm repository root/output.
- `Set both public Supabase variables`: add both public values (no secrets) to that Cloudflare environment.
- `Unsupported engine` / Node < 22: enable Node 22 and v3 build image.
- `404` after a successful build: verify deployed origin and the generated `/demo/` page before changing DNS.

Run `npm ci && npm run build:pages` locally or check GitHub Actions in this PR. A passing GitHub build proves source/artifact correctness only; **it does not prove Cloudflare published the site**.

## Production safety
This repair does not touch Supabase migrations, billing, custom domains, authentication redirect settings, production traffic, or existing data. If you use Wrangler directly, generate its config from your **real** Pages project using `npx wrangler pages download config <ACTUAL_PAGES_PROJECT_NAME>` and review it before committing, rather than restoring a guessed project name.

Once publication succeeds, configure Supabase Authentication → URL Configuration using the deployed Cloudflare URL and the exact `/auth/callback/` path. Test `/`, `/demo/`, `/login/`, and `/dashboard/` (authenticated) on a disposable account before declaring the site live.
