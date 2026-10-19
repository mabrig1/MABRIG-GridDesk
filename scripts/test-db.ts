import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
// Real PostgreSQL engine compiled to WASM. Supabase auth schema is a local fixture.
// PGlite is single-connection: this does NOT prove native concurrent locking.
const db = new PGlite();
let passed = 0;
const A = "00000000-0000-0000-0000-000000000001",
  B = "00000000-0000-0000-0000-000000000002";
await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
create table auth.users(id uuid primary key,email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
insert into auth.users values ('${A}','a@example.test'),('${B}','b@example.test');`);
await db.exec(
  await readFile("supabase/migrations/202610190001_minigrid.sql", "utf8"),
);
async function asUser(
  uid: string,
  sql: string,
  params: unknown[] = [],
  role = "authenticated",
) {
  await db.exec("begin");
  try {
    await db.exec(`set local role ${role}`);
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [uid]);
    const r = await db.query(sql, params);
    await db.exec("commit");
    return r;
  } catch (e) {
    await db.exec("rollback");
    throw e;
  }
}
async function test(name: string, fn: () => Promise<void>) {
  await fn();
  passed++;
  console.log(`PASS ${name}`);
}
async function denied(
  uid: string,
  sql: string,
  params: unknown[] = [],
  role = "authenticated",
) {
  await assert.rejects(() => asUser(uid, sql, params, role));
}
const tenant = async (uid: string, name: string, meter: string) => {
  const id = randomUUID();
  await asUser(
    uid,
    "insert into public.tenants(id,operator_id,name,meter_id,business_type) values($1,$2,$3,$4,'welder')",
    [id, uid, name, meter],
  );
  return id;
};
const pay = (
  uid: string,
  id: string,
  amount: number | string,
  key = randomUUID(),
) =>
  asUser(uid, "select * from public.simulate_payment($1,$2,$3)", [
    id,
    amount,
    key,
  ]);
await test("Unauthenticated onboarding is denied", () =>
  denied("", "select public.onboard_operator('Forged')"));
await test("Anonymous operational reads and RPC are rejected", async () => {
  for (const table of ["operators", "tenants", "payments", "energy_logs"])
    await denied("", `select * from public.${table}`, [], "anon");
  await denied("", "select public.onboard_operator('Forged')", [], "anon");
});
await test("Secure onboarding uses authenticated identity and auth email", async () => {
  await asUser(A, "select public.onboard_operator('Operator A')");
  await asUser(B, "select public.onboard_operator('Operator B')");
  const r = await asUser(A, "select id,email from public.operators");
  assert.equal(r.rows.length, 1);
  assert.equal((r.rows[0] as { email: string }).email, "a@example.test");
});
const TA = await tenant(A, "A Welder", "M-1"),
  TB = await tenant(B, "B Welder", "M-1"),
  TA2 = await tenant(A, "A Cold Store", "M-2");
await test("A cannot read B tenants or profile", async () => {
  assert.equal(
    (await asUser(A, "select * from public.tenants where id=$1", [TB])).rows
      .length,
    0,
  );
  assert.equal(
    (await asUser(A, "select * from public.operators where id=$1", [B])).rows
      .length,
    0,
  );
});
await test("A cannot mutate B tenant", async () => {
  const r = await asUser(
    A,
    "update public.tenants set name='Hacked' where id=$1 returning id",
    [TB],
  );
  assert.equal(r.rows.length, 0);
});
await test("A cannot create tenants owned by B", () =>
  denied(
    A,
    "insert into public.tenants(operator_id,name,meter_id) values($1,'Wrong','M-X')",
    [B],
  ));
await test("Direct ownership transfer and balance tampering are denied", async () => {
  await denied(A, "update public.tenants set operator_id=$1 where id=$2", [
    B,
    TA,
  ]);
  await denied(A, "update public.tenants set current_balance=100 where id=$1", [
    TA,
  ]);
  await denied(
    A,
    "insert into public.tenants(operator_id,name,meter_id,current_balance) values($1,'Forged','M-F',100)",
    [A],
  );
});
await test("Even privileged ownership transfers trigger immutable-owner guard", async () => {
  await assert.rejects(() =>
    db.query("update public.tenants set operator_id=$1 where id=$2", [B, TA]),
  );
});
await test("Per-operator meter uniqueness is enforced", () =>
  denied(
    A,
    "insert into public.tenants(operator_id,name,meter_id) values($1,'Duplicate','M-1')",
    [A],
  ));
await test("Ordinary clients cannot forge payments", () =>
  denied(
    A,
    "insert into public.payments(tenant_id,amount,status,is_simulated,idempotency_key) values($1,100,'successful',false,$2)",
    [TA, randomUUID()],
  ));
await test("Simulation denied while backend environment is off", () =>
  assert.rejects(() => pay(A, TA, 100)));
await db.exec("update private.environment set demo_enabled=true");
await test("Simulation denied without admin allowlist entry", () =>
  assert.rejects(() => pay(A, TA, 100)));
await test("Client cannot change environment or allowlist", async () => {
  await denied(A, "update private.environment set demo_enabled=true");
  await denied(A, "insert into private.demo_operators values($1)", [A]);
});
await db.query("insert into private.demo_operators values($1),($2)", [A, B]);
await test("Authenticated user without JWT and anonymous callers cannot pay", async () => {
  await assert.rejects(() => pay("", TA, 100));
  await denied(
    "",
    "select * from public.simulate_payment($1,100,$2)",
    [TA, randomUUID()],
    "anon",
  );
});
await test("RPC ownership validation rejects cross-operator payments", () =>
  assert.rejects(() => pay(A, TB, 100)));
await test("Invalid amounts fail", async () => {
  for (const amount of [0, -1, 1000001, "1.001", "NaN", "Infinity"])
    await assert.rejects(() => pay(A, TA, amount));
});
const key = randomUUID();
await test("Atomic simulation returns successful marked payment and authoritative balance", async () => {
  const r = await pay(A, TA, 250, key);
  const p = r.rows[0] as {
    balance: string;
    is_simulated: boolean;
    replayed: boolean;
  };
  assert.equal(Number(p.balance), 250);
  assert.equal(p.is_simulated, true);
  assert.equal(p.replayed, false);
});
await test("Retry creates only one payment and credits only once", async () => {
  const r = await pay(A, TA, 250, key);
  assert.equal((r.rows[0] as { replayed: boolean }).replayed, true);
  const c = await db.query(
    "select count(*)::int n from public.payments where idempotency_key=$1",
    [key],
  );
  assert.equal((c.rows[0] as { n: number }).n, 1);
});
await test("Key reuse with different amount or tenant is rejected", async () => {
  await assert.rejects(() => pay(A, TA, 251, key));
  await assert.rejects(() => pay(A, TA2, 250, key));
  await assert.rejects(() => pay(B, TB, 250, key));
});
await pay(B, TB, 999);
await test("A cannot read B payments or energy records", async () => {
  await asUser(
    B,
    "insert into public.energy_logs(tenant_id,kwh_consumed) values($1,20)",
    [TB],
  );
  assert.equal(
    (await asUser(A, "select * from public.payments where tenant_id=$1", [TB]))
      .rows.length,
    0,
  );
  assert.equal(
    (
      await asUser(A, "select * from public.energy_logs where tenant_id=$1", [
        TB,
      ])
    ).rows.length,
    0,
  );
});
await test("Energy ownership and non-negative checks are enforced", async () => {
  await denied(
    A,
    "insert into public.energy_logs(tenant_id,kwh_consumed) values($1,1)",
    [TB],
  );
  await denied(
    A,
    "insert into public.energy_logs(tenant_id,kwh_consumed) values($1,-1)",
    [TA],
  );
  await asUser(
    A,
    "insert into public.energy_logs(tenant_id,kwh_consumed) values($1,12.345)",
    [TA],
  );
});
await test("Summary excludes simulated payments from real revenue", async () => {
  const r = await asUser(A, "select public.dashboard_summary() s");
  const s = (r.rows[0] as { s: Record<string, number> }).s;
  assert.equal(s.real_revenue, 0);
  assert.equal(s.simulated_collections, 250);
  assert.equal(s.total_tenants, 2);
  assert.equal(s.total_kwh, 12.345);
});
await db.query(
  "insert into public.payments(tenant_id,amount,status,is_simulated,idempotency_key) values($1,50,'successful',false,$2),($1,90,'failed',false,$3)",
  [TA, randomUUID(), randomUUID()],
);
await test("Only successful non-simulated payments count as real revenue", async () => {
  const r = await asUser(A, "select public.dashboard_summary() s");
  assert.equal(
    (r.rows[0] as { s: { real_revenue: number } }).s.real_revenue,
    50,
  );
});
await test("Failed balance update rolls back inserted payment", async () => {
  await db.query(
    "update public.tenants set current_balance=999999999999.99 where id=$1",
    [TA2],
  );
  const failKey = randomUUID();
  await assert.rejects(() => pay(A, TA2, 1, failKey));
  assert.equal(
    (
      await db.query(
        "select id from public.payments where idempotency_key=$1",
        [failKey],
      )
    ).rows.length,
    0,
  );
});
await test("Inactive tenant rejects new payment but permits reconciliation", async () => {
  await asUser(A, "update public.tenants set is_active=false where id=$1", [
    TA,
  ]);
  await assert.rejects(() => pay(A, TA, 1));
  const r = await pay(A, TA, 250, key);
  assert.equal((r.rows[0] as { replayed: boolean }).replayed, true);
});
await test("Deletion and payment modification are denied", async () => {
  await denied(A, "delete from public.tenants where id=$1", [TA]);
  await denied(
    A,
    "update public.payments set is_simulated=false where tenant_id=$1",
    [TA],
  );
});
await test("Revoking demo environment blocks subsequent RPC calls", async () => {
  await db.exec("update private.environment set demo_enabled=false");
  await assert.rejects(() => pay(A, TA, 250, key));
});
await test("Aggregates cover more than a page and exclude households from active businesses", async () => {
  for(let i=0;i<11;i++) await asUser(A, "insert into public.tenants(operator_id,name,meter_id,business_type) values($1,$2,$3,'household')", [A,`Household ${i}`,`HOUSE-${i}`]);
  const result = await asUser(A, 'select public.dashboard_summary() s');
  const summary=(result.rows[0] as {s:{total_tenants:number;active_businesses:number}}).s;
  assert.equal(summary.total_tenants,13);
  assert.equal(summary.active_businesses,1);
});
console.log(
  `\n${passed} local PostgreSQL/WASM tests passed. Supabase Auth is a fixture. Native concurrency and hosted Supabase integration were NOT tested.`,
);
await db.close();
