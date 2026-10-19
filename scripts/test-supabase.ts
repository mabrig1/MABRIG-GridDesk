// Hosted integration test: only run against a DISPOSABLE DEMO Supabase project.
// Create/confirm two accounts first, onboard both, enable demo and allowlist both.
// No service-role key. All requests exercise HTTPS + Auth + RLS as ordinary users.
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const required = [
  "TEST_SUPABASE_URL",
  "TEST_SUPABASE_KEY",
  "TEST_A_EMAIL",
  "TEST_A_PASSWORD",
  "TEST_B_EMAIL",
  "TEST_B_PASSWORD",
];
if (
  process.env.ALLOW_DISPOSABLE_INTEGRATION !== "yes" ||
  required.some((k) => !process.env[k])
) {
  console.error(
    "BLOCKED: set ALLOW_DISPOSABLE_INTEGRATION=yes and the six TEST_* variables documented in docs/TESTING.md. No hosted tests ran.",
  );
  process.exit(2);
}
const url = process.env.TEST_SUPABASE_URL!,
  key = process.env.TEST_SUPABASE_KEY!;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const a = createClient(url, key, options),
  b = createClient(url, key, options),
  anon = createClient(url, key, options);
const au = await a.auth.signInWithPassword({
  email: process.env.TEST_A_EMAIL!,
  password: process.env.TEST_A_PASSWORD!,
});
const bu = await b.auth.signInWithPassword({
  email: process.env.TEST_B_EMAIL!,
  password: process.env.TEST_B_PASSWORD!,
});
assert.ifError(au.error);
assert.ifError(bu.error);
assert.notEqual(au.data.user!.id, bu.data.user!.id);
for (const [client, name] of [
  [a, "Integration Operator A"],
  [b, "Integration Operator B"],
] as const) {
  const p = await client.rpc("onboard_operator", { p_company_name: name });
  assert.ifError(p.error);
  const mode = await client.rpc("demo_access");
  assert.ifError(mode.error);
  assert.equal(
    mode.data,
    true,
    "Admin must enable and allowlist both users in a disposable demo project",
  );
}
const ta = randomUUID(),
  tb = randomUUID(),
  prefix = `TEST-${Date.now()}`;
for (const [client, id, user] of [
  [a, ta, au.data.user!],
  [b, tb, bu.data.user!],
] as const) {
  const r = await client
    .from("tenants")
    .insert({
      id,
      operator_id: user.id,
      name: "Integration Test Tenant",
      meter_id: `${prefix}-${id.slice(0, 8)}`,
      business_type: "welder",
    });
  assert.ifError(r.error);
}
let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  await fn();
  passed++;
  console.log(`PASS ${name}`);
}
const pay = (
  client: typeof a,
  tenant: string,
  amount: number,
  idempotency = randomUUID(),
) =>
  client.rpc("simulate_payment", {
    p_tenant_id: tenant,
    p_amount: amount,
    p_idempotency_key: idempotency,
  });
await test("A cannot read/mutate B tenant", async () => {
  const r = await a.from("tenants").select("id").eq("id", tb);
  assert.ifError(r.error);
  assert.equal(r.data?.length, 0);
  const u = await a
    .from("tenants")
    .update({ name: "Wrong" })
    .eq("id", tb)
    .select("id");
  assert.ifError(u.error);
  assert.equal(u.data?.length, 0);
});
await test("Anonymous reads rejected", async () => {
  for (const t of ["tenants", "payments", "energy_logs", "operators"])
    assert.ok((await anon.from(t).select("id").limit(1)).error);
});
await test("Direct balance, ownership, payment, and cross-tenant energy tampering denied", async () => {
  assert.ok(
    (await a.from("tenants").update({ current_balance: 100 }).eq("id", ta))
      .error,
  );
  assert.ok(
    (
      await a
        .from("tenants")
        .update({ operator_id: bu.data.user!.id })
        .eq("id", ta)
    ).error,
  );
  assert.ok(
    (
      await a
        .from("payments")
        .insert({
          tenant_id: ta,
          amount: 1,
          status: "successful",
          is_simulated: false,
          idempotency_key: randomUUID(),
        })
    ).error,
  );
  assert.ok(
    (await a.from("energy_logs").insert({ tenant_id: tb, kwh_consumed: 1 }))
      .error,
  );
});
await test("Unauthorised RPC calls fail", async () => {
  assert.ok((await pay(a, tb, 10)).error);
  assert.ok((await pay(anon, ta, 10)).error);
});
const duplicate = randomUUID();
await test("Concurrent duplicate requests credit only once", async () => {
  const r = await Promise.all(
    Array.from({ length: 8 }, () => pay(a, ta, 100, duplicate)),
  );
  r.forEach((x) => assert.ifError(x.error));
  const rows = await a
    .from("payments")
    .select("id")
    .eq("idempotency_key", duplicate);
  assert.equal(rows.data?.length, 1);
});
await test("Key reuse with another amount or tenant is rejected", async () => {
  assert.ok((await pay(a, ta, 101, duplicate)).error);
  assert.ok((await pay(b, tb, 100, duplicate)).error);
});
await test("Concurrent distinct payments produce exact authoritative balance", async () => {
  const r = await Promise.all(
    Array.from({ length: 10 }, () => pay(a, ta, 3.25)),
  );
  r.forEach((x) => assert.ifError(x.error));
  const row = await a
    .from("tenants")
    .select("current_balance")
    .eq("id", ta)
    .single();
  assert.ifError(row.error);
  assert.equal(Number(row.data!.current_balance), 132.5);
});
await test("B payment and energy records remain invisible to A", async () => {
  assert.ifError((await pay(b, tb, 15)).error);
  assert.ifError(
    (await b.from("energy_logs").insert({ tenant_id: tb, kwh_consumed: 4 }))
      .error,
  );
  assert.equal(
    (await a.from("payments").select("id").eq("tenant_id", tb)).data?.length,
    0,
  );
  assert.equal(
    (await a.from("energy_logs").select("id").eq("tenant_id", tb)).data?.length,
    0,
  );
});
await test("Invalid payment creates no payment row", async () => {
  const k = randomUUID();
  assert.ok((await pay(a, ta, -1, k)).error);
  assert.equal(
    (await a.from("payments").select("id").eq("idempotency_key", k)).data
      ?.length,
    0,
  );
});
await test("Simulations leave real revenue unchanged", async () => {
  const before = await a.rpc("dashboard_summary");
  assert.ifError(before.error);
  assert.ifError((await pay(a, ta, 1)).error);
  const after = await a.rpc("dashboard_summary");
  assert.ifError(after.error);
  assert.equal(before.data.real_revenue, after.data.real_revenue);
  assert.equal(
    Number(after.data.simulated_collections) -
      Number(before.data.simulated_collections),
    1,
  );
});
for (const [client, id] of [
  [a, ta],
  [b, tb],
] as const)
  assert.ifError(
    (await client.from("tenants").update({ is_active: false }).eq("id", id))
      .error,
  );
await a.auth.signOut();
await b.auth.signOut();
console.log(
  `${passed} hosted Supabase tests passed. Fixtures retained as inactive audit records in the disposable project. Mid-transaction fault injection is covered by the local SQL suite.`,
);
