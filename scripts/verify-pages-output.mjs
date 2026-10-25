// Confirm the Cloudflare Pages deployment directory and the static app routes.
// This runs AFTER "next build" with output: "export" and trailingSlash: true.
import { access, stat } from "node:fs/promises";
import { join } from "node:path";

const expected = [
  "index.html",
  "404.html",
  "demo/index.html",
  "login/index.html",
  "signup/index.html",
  "dashboard/index.html",
  "onboarding/index.html",
  "auth/callback/index.html",
  "_headers",
];

let missing = false;
for (const file of expected) {
  const path = join("out", file);
  try {
    await access(path);
    if (!(await stat(path)).isFile()) throw new Error("not a file");
  } catch {
    console.error(`Missing expected Cloudflare Pages artifact: ${path}`);
    missing = true;
  }
}
if (missing) {
  console.error(
    "Static export incomplete: Cloudflare Pages MUST serve out/, not .next/ or .vercel/output/static.",
  );
  process.exitCode = 1;
} else {
  console.log("Cloudflare Pages static-export check OK. Publish the out/ directory.");
}
