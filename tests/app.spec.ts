import { test, expect } from "@playwright/test";
test("Landing, sample dashboard, filters and navigation work without overflow", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /More clarity/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View sample dashboard" }).click();
  await expect(
    page.getByRole("heading", { name: "Powering your everyday." }),
  ).toBeVisible();
  await expect(
    page
      .getByText("Chika Cold Store", { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty(
    "scrollWidth",
    await page.evaluate(() => innerWidth),
  );
  await page.screenshot({
    path: `test-results/${info.project.name}-dashboard.png`,
    fullPage: true,
  });
  await page.getByLabel("Search tenants").fill("Ada");
  await expect(
    page
      .getByText("Ada Stitch Studio", { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page
      .getByText("Chika Cold Store", { exact: true })
      .filter({ visible: true }),
  ).toHaveCount(0);
  await page.getByLabel("Search tenants").fill("");
  await page.getByLabel("Filter business type").selectOption("welder");
  await expect(
    page
      .getByText("Ifeanyi Metal Works", { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page
      .getByText("Ada Stitch Studio", { exact: true })
      .filter({ visible: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Payments", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Payment history" }),
  ).toBeVisible();
  await expect(
    page.getByText("SIMULATED", { exact: true }).filter({ visible: true }),
  ).toHaveCount(4);
  await page.getByRole("button", { name: "Energy usage", exact: true }).click();
  await expect(
    page.getByText("82.5 kWh", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("Static deep routes load directly and offline state is visible", async ({
  page,
  context,
}) => {
  for (const route of [
    "/login/",
    "/signup/",
    "/onboarding/",
    "/dashboard/",
    "/auth/callback/",
  ]) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading").filter({ visible: true }).first(),
    ).toBeVisible();
  }
  await page.goto("/demo/");
  await context.setOffline(true);
  await expect(
    page.getByRole("status").filter({ hasText: "You’re offline" }),
  ).toBeVisible();
  await context.setOffline(false);
  await expect(
    page.getByRole("status").filter({ hasText: "You’re offline" }),
  ).toHaveCount(0);
});
