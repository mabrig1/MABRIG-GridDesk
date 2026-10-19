import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Never log values: a misconfigured key may be sensitive.
if (!url && !key) {
  console.log(
    "No Supabase configuration: building setup screen plus read-only sample.",
  );
  process.exit(0);
}
if (!url || !key)
  throw new Error(
    "Set both public Supabase variables or remove both for an unconfigured preview.",
  );
if (key.startsWith("sb_secret_"))
  throw new Error("Secret keys must never be included in a public build.");
if (!key.startsWith("sb_publishable_")) {
  let role;
  try {
    role = JSON.parse(
      Buffer.from(key.split(".")[1], "base64url").toString(),
    ).role;
  } catch {}
  if (role !== "anon")
    throw new Error(
      "Use a publishable key or a legacy JWT with role=anon. Secret/service-role values are forbidden.",
    );
}
const parsed = new URL(url);
if (
  parsed.protocol !== "https:" &&
  !["localhost", "127.0.0.1"].includes(parsed.hostname)
)
  throw new Error("Use an HTTPS Supabase project URL.");
console.log(
  "Public configuration shape validated. This does not verify backend connectivity.",
);
