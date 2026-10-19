import { test, expect, type Page } from "@playwright/test";
const uid = "00000000-0000-0000-0000-000000000001";
async function mockBackend(page: Page) {
  let tenants = [
    {
      id: "10000000-0000-0000-0000-000000000001",
      operator_id: uid,
      name: "Test Welder",
      business_type: "welder",
      meter_id: "TEST-1",
      current_balance: 0,
      is_active: true,
      created_at: "2026-10-19T00:00:00Z",
    },
  ];
  const payments: Record<string, unknown>[] = [];
  const logs: Record<string, unknown>[] = [];
  let lost = false;
  const paymentKeys: string[] = [];
  const user = {
    id: uid,
    aud: "authenticated",
    role: "authenticated",
    email: "operator@example.test",
    email_confirmed_at: "2026-10-19T00:00:00Z",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: "2026-10-19T00:00:00Z",
  };
  const token = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: uid, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.test-signature`;
  await page.route("https://test-minigrid.supabase.co/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      method = request.method();
    const body = request.postDataJSON();
    const json = (
      value: unknown,
      status = 200,
      headers: Record<string, string> = {},
    ) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "*",
          "access-control-expose-headers": "content-range",
          ...headers,
        },
        body: JSON.stringify(value),
      });
    if (url.pathname === "/auth/v1/token")
      return json({
        access_token: token,
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: "test-refresh",
        user,
      });
    if (url.pathname === "/auth/v1/user") return json(user);
    if (url.pathname === "/auth/v1/logout") return json({});
    if (url.pathname === "/rest/v1/operators")
      return json({ id: uid, company_name: "Test Operator" });
    if (url.pathname.endsWith("/demo_access")) return json(true);
    if (url.pathname.endsWith("/dashboard_summary"))
      return json({
        total_tenants: tenants.length,
        active_businesses: tenants.filter(
          (t) => t.is_active && t.business_type !== "household",
        ).length,
        real_revenue: 0,
        simulated_collections: payments.reduce(
          (s, p) => s + Number(p.amount),
          0,
        ),
        total_kwh: logs.reduce((s, p) => s + Number(p.kwh_consumed), 0),
        month_kwh: logs.reduce((s, p) => s + Number(p.kwh_consumed), 0),
        energy_entries: logs.length,
      });
    if (url.pathname.endsWith("/simulate_payment")) {
      paymentKeys.push(body.p_idempotency_key);
      const previous = payments.find(
        (p) => p.idempotency_key === body.p_idempotency_key,
      );
      const tenant = tenants.find((t) => t.id === body.p_tenant_id)!;
      if (!previous) {
        tenant.current_balance += Number(body.p_amount);
        payments.push({
          id: crypto.randomUUID(),
          tenant_id: tenant.id,
          amount: Number(body.p_amount),
          is_simulated: true,
          status: "successful",
          idempotency_key: body.p_idempotency_key,
          payment_date: new Date().toISOString(),
          tenants: { name: tenant.name, meter_id: tenant.meter_id },
        });
      }
      if (!lost) {
        lost = true;
        return route.abort("failed");
      }
      const payment = payments.find(
        (p) => p.idempotency_key === body.p_idempotency_key,
      )!;
      return json([
        {
          payment_id: payment.id,
          tenant_id: tenant.id,
          amount: payment.amount,
          status: "successful",
          is_simulated: true,
          balance: tenant.current_balance,
          replayed: Boolean(previous),
        },
      ]);
    }
    if (url.pathname === "/rest/v1/tenants") {
      if (method === "POST") {
        tenants.push({
          ...body,
          current_balance: 0,
          created_at: new Date().toISOString(),
        });
        return json(null, 201);
      }
      if (method === "PATCH") {
        const id = url.searchParams.get("id")?.slice(3);
        tenants = tenants.map((t) => (t.id === id ? { ...t, ...body } : t));
        return json({ id });
      }
      return json(tenants, 200, {
        "content-range": `0-${tenants.length - 1}/${tenants.length}`,
      });
    }
    if (url.pathname === "/rest/v1/energy_logs") {
      if (method === "POST") {
        const t = tenants.find((t) => t.id === body.tenant_id)!;
        logs.push({ ...body, tenants: { name: t.name, meter_id: t.meter_id } });
        return json(null, 201);
      }
      return json(logs, 200, {
        "content-range": `0-${logs.length - 1}/${logs.length}`,
      });
    }
    if (url.pathname === "/rest/v1/payments")
      return json(payments, 200, {
        "content-range": `0-${payments.length - 1}/${payments.length}`,
      });
    return json({ message: `Unmocked ${method} ${url.pathname}` }, 500);
  });
  return { paymentKeys, payments, logs };
}
test("Authenticated UI: tenant CRUD, uncertain payment retry, energy log, and logout (mocked HTTPS)", async ({
  page,
}) => {
  const backend = await mockBackend(page);
  await page.goto("/login/");
  test.skip(
    await page
      .getByRole("heading", { name: "Connect your workspace" })
      .isVisible(),
    "Build with the documented mock public env values to run authenticated UI tests.",
  );
  await page.getByLabel("Email address").fill("operator@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Powering your everyday." }),
  ).toBeVisible();
  await expect(
    page.getByText("Test Welder", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add tenant", exact: true }).click();
  await page.getByLabel("Tenant name").fill("Test Tailor");
  await page
    .getByLabel("Business type", { exact: true })
    .selectOption("tailoring");
  await page.getByLabel("Meter ID", { exact: true }).fill("TEST-2");
  await page.getByRole("button", { name: "Save tenant" }).click();
  await expect(
    page.getByText("Test Tailor", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  const row = page
    .locator(".tenant-table tr:visible, .tenant-card:visible")
    .filter({ hasText: "Test Tailor" });
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Tenant name").fill("Updated Tailor");
  await page.getByRole("button", { name: "Save tenant" }).click();
  await expect(
    page.getByText("Updated Tailor", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await page
    .locator(".tenant-table tr:visible, .tenant-card:visible")
    .filter({ hasText: "Test Welder" })
    .getByRole("button", { name: "Simulate Payment", exact: true })
    .click();
  await page.getByLabel("Amount (NGN)").fill("2500.00");
  await page
    .getByRole("button", { name: "Simulate payment", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry / confirm same payment" }),
  ).toBeEnabled();
  await expect(page.getByLabel("Amount (NGN)")).toBeDisabled();
  await page.reload();
  await expect(page.getByText("A payment needs confirmation.")).toBeVisible();
  await page.getByRole("button", { name: "Resume the same request →" }).click();
  await page
    .getByRole("button", { name: "Retry / confirm same payment" })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Existing payment confirmed" }),
  ).toBeVisible();
  expect(backend.paymentKeys).toHaveLength(2);
  expect(backend.paymentKeys[0]).toBe(backend.paymentKeys[1]);
  expect(backend.payments).toHaveLength(1);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .locator(".tenant-table tr:visible, .tenant-card:visible")
    .filter({ hasText: "Test Welder" })
    .getByRole("button", { name: "Log energy", exact: true })
    .click();
  await page.getByLabel("Energy consumed (kWh)").fill("12.5");
  await page.getByRole("button", { name: "Save energy log" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Energy log saved" }),
  ).toBeVisible();
  expect(backend.logs).toHaveLength(1);
  await page.getByRole("button", { name: "Payments", exact: true }).click();
  await expect(
    page.getByText("SIMULATED", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
});
