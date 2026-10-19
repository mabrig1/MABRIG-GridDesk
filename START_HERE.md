# Start here — GridDesk by MABRIG

This folder is the finished Mini-Grid Operator Dashboard source project.

## Preview immediately
The downloadable archive includes `out/`; GitHub source checkouts do not. For a GitHub checkout, first run `npm ci`, copy `docs/CLOUDFLARE_PUBLIC_ENV.txt` to `.env.local`, and run `npm run build`.

With Node.js 22+ installed and `out/` available, from this folder run:

```bash
node scripts/serve.mjs
```

Open `http://localhost:4173/demo/`. The bundled `out/` directory is a static build configured for the new Supabase backend, with fictional sample records at /demo/. It needs no dependency installation to preview. The hosted backend is empty. Auth callback URLs and email delivery still need setup for the final deployed domain.

## Connect the real application
1. Read `docs/DEPLOYMENT.md`.
2. The migration is already applied to MABRIG-GridDesk. Do not rerun it on that project; use it only when provisioning a separate new environment.
3. Set the public URL and publishable key in an ignored `.env.local` file.
4. Run `npm ci` then `npm run build`.
5. Deploy `out/` to Cloudflare Pages and set Supabase Auth URLs to the actual domain.

Use a separate demo project to enable simulations. Real provider payments and physical meters are not connected.

`docs/HANDOVER.md` contains the complete copy-pasteable SQL block and key file map. `docs/TESTING.md` records completed tests and tests blocked by missing hosted access. README.md contains the grant statement, pilot targets and roadmap.
