import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const controlPlaneURL = "http://127.0.0.1:43001";

test.beforeEach(async ({ page, request }) => {
  await request.post(controlPlaneURL + "/__test/reset");
  await page.addInitScript(() => {
    let copied = "";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        readText: async () => copied,
        writeText: async (value: string) => { copied = value; },
      },
    });
  });
  await page.goto("/auth/dev-login");
  await page.waitForURL(/\/dashboard$/, { waitUntil: "networkidle" });
  await page.goto("/dashboard/tunnels");
  await expect(page.getByRole("heading", { name: "Tunnels", exact: true })).toBeVisible();
});

test("shows stable tunnel identity and complete operational details", async ({ page }) => {
  const card = page.getByTestId("tunnel-card-tun_browser_test");
  await expect(card).toContainText("Docs gateway");
  await expect(card).toContainText("Ready");
  await expect(card).toContainText("docs.tunnel.example.test");
  await expect(card).toContainText("Public");

  await card.getByRole("button", { name: "Copy Docs gateway stable endpoint" }).click();
  await expect(page.getByText("Stable endpoint copied.")).toBeVisible();
  await card.getByRole("link", { name: "View tunnel" }).click();

  const detail = page.getByTestId("tunnel-detail-page");
  await expect(detail).toContainText("Stable endpoint");
  await expect(detail).toContainText("Tunnel is ready.");
  await expect(detail).toContainText("Documentation");
  await expect(detail).toContainText("docs.tunnel.example.test/docs");

  await page.getByRole("tab", { name: /Connected hosts/ }).click();
  await expect(detail).toContainText("Connected");
  await expect(detail).toContainText("1.0.0-test");

  await page.getByRole("tab", { name: "Operations & events" }).click();
  await expect(detail).toContainText("tunnel.ready");
  await expect(detail).toContainText("succeeded");
});

test("pauses and resumes with the latest strong ETag", async ({ page }) => {
  await page.getByTestId("tunnel-card-tun_browser_test").getByRole("link", { name: "View tunnel" }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByText("Tunnel pause requested.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(page.getByText("Tunnel resume requested.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
});

test("refreshes after a generation conflict instead of overwriting state", async ({ page, request }) => {
  await page.getByTestId("tunnel-card-tun_browser_test").getByRole("link", { name: "View tunnel" }).click();
  await request.post(controlPlaneURL + "/__test/conflict-tunnel");
  await page.getByRole("button", { name: "Pause", exact: true }).click();

  await expect(page.getByText("Tunnel changed before the action was applied.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
});

test("requires explicit confirmation before deleting a tunnel", async ({ page }) => {
  await page.getByTestId("tunnel-card-tun_browser_test").getByRole("link", { name: "View tunnel" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();

  const dialog = page.getByRole("alertdialog", { name: "Delete Docs gateway?" });
  await expect(dialog).toContainText("permanently retires the stable endpoint");
  await dialog.getByRole("button", { name: "Delete tunnel", exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard\/tunnels$/);
  await expect(page.getByTestId("tunnel-card-tun_browser_test")).toHaveCount(0);
});

test("explains host-only creation when no tunnels exist", async ({ page, request }) => {
  await request.post(controlPlaneURL + "/__test/empty-tunnels");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();

  const empty = page.getByTestId("tunnel-empty");
  await expect(empty).toContainText("Create your first tunnel from a host");
  await expect(empty).toContainText("pb tunnel create");
});

test("keeps secrets and origin host paths out of the dashboard", async ({ page }) => {
  await page.getByTestId("tunnel-card-tun_browser_test").getByRole("link", { name: "View tunnel" }).click();
  const text = await page.locator("body").innerText();
  expect(text).not.toContain("Bearer ");
  expect(text).not.toContain("private_key");
  expect(text).not.toContain("enrollment_token");
  expect(text).not.toContain("/Users/");
  expect(text).not.toContain("/home/");
});

test("keeps the tunnel list and detail free of serious accessibility violations", async ({ page }) => {
  const listResult = await new AxeBuilder({ page }).analyze();
  expect(listResult.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious")).toEqual([]);

  await page.getByTestId("tunnel-card-tun_browser_test").getByRole("link", { name: "View tunnel" }).click();
  await page.getByRole("tab", { name: /Connected hosts/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("1.0.0-test")).toBeVisible();
  const detailResult = await new AxeBuilder({ page }).analyze();
  expect(detailResult.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious")).toEqual([]);
});
