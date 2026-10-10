import { expect as baseExpect, test, type Page } from "@playwright/test";

const expect = baseExpect.configure({ timeout: 30000 });

// Exercise the real Home route, components, i18n compiler and currency formatter.
// Only the existing API boundary is controlled; no prototype HTML is rendered.
test.setTimeout(90000);
test.use({ actionTimeout: 30000 });

const collectionId = "collection-overview-test";
const totals = {
  totalItemPrice: 1820.5,
  totalItems: 7,
  totalLocations: 3,
  totalTags: 2,
  totalUsers: 1,
  totalWithWarranty: 0,
};

async function mockHome(page: Page, options: { name?: string; user?: string } = {}) {
  const name = options.name ?? "Workshop";
  const user = options.user ?? "Morgan";
  await page.context().addCookies([{ name: "hb.auth.session", value: "true", url: test.info().project.use.baseURL! }]);
  await page.addInitScript(id => {
    localStorage.setItem(
      "homebox/preferences/location",
      JSON.stringify({ collectionId: id, language: "en", overrideFormatLocale: "de-DE" })
    );
  }, collectionId);
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path === "/api/v1/users/self")
      body = {
        item: {
          id: "overview-user",
          name: user,
          defaultGroupId: collectionId,
          groupId: collectionId,
          email: "overview@example.test",
          isAdmin: true,
        },
      };
    else if (path === "/api/v1/users/self/settings") body = { item: {} };
    else if (path === "/api/v1/groups/all") body = [{ id: collectionId, name }];
    else if (path === "/api/v1/groups") body = { id: collectionId, name, currency: "EUR" };
    else if (path === "/api/v1/groups/statistics") body = totals;
    else if (path === "/api/v1/items") body = { items: [], total: 0, page: 1, pageSize: 5 };
    else if (path === "/api/v1/status")
      body = {
        health: true,
        build: { version: "v1.0.0", commit: "test" },
        options: { allowRegistration: false },
        otel: { enabled: false },
      };
    await route.fulfill({ json: body });
  });
}

const statsSection = (page: Page) => page.getByRole("region", { name: "Quick Statistics" });

test("live overview, section order, editorial primitives and non-USD locale formatting", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockHome(page);
  await page.goto("/home");
  await expect(page.locator(".home-eyebrow")).toHaveText("Workshop · Collection overview");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("A place for everything.");
  await expect(page.locator("[data-home-welcome]")).toContainText("Welcome home, Morgan.");
  await expect(page.locator("[data-home-welcome]")).toContainText("7 items across 3 locations.");
  const section = statsSection(page);
  await expect(section.locator(".home-statistic")).toHaveCount(4);
  await expect(section.locator(".home-statistic-value")).toHaveText([/1\.820,50\s*€/, "7", "3", "2"]);
  await expect(section.locator(".home-statistic-featured")).toHaveCSS("background-color", "rgb(79, 37, 130)");
  await expect(section.locator(".home-statistic").nth(1)).toHaveCSS("border-top-width", "3px");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("font-family", /Georgia/);
  const headingTexts = await page.locator("h1, h2").allTextContents();
  expect(headingTexts.indexOf("A place for everything.")).toBeLessThan(headingTexts.indexOf("Quick Statistics"));
  await page.screenshot({ path: "test-results/home-overview-desktop.png" });
});

test("pending and failed statistics never show successful zero totals; retry displays genuine zeros", async ({
  page,
}) => {
  await mockHome(page);
  let release!: () => void;
  const deferred = new Promise<void>(resolve => {
    release = resolve;
  });
  let requests = 0;
  await page.route("**/api/v1/groups/statistics", async route => {
    expect(route.request().headers()["x-tenant"]).toBe(collectionId);
    requests++;
    if (requests === 1) {
      await deferred;
      await route.fulfill({ status: 500, json: { error: "unavailable" } });
    } else {
      await route.fulfill({ json: { ...totals, totalItemPrice: 0, totalItems: 0, totalLocations: 0, totalTags: 0 } });
    }
  });
  await page.goto("/home");
  const section = statsSection(page);
  await expect(section.getByRole("status")).toHaveText("Loading collection statistics…");
  await expect(section.locator(".home-statistic")).toHaveCount(0);
  await expect(page.locator("[data-home-welcome]")).not.toContainText("0 items");
  release();
  await expect(section.getByRole("alert")).toContainText("Collection statistics could not be loaded");
  await expect(section.locator(".home-statistic")).toHaveCount(0);
  await section.getByRole("button", { name: "Retry statistics" }).click();
  await expect(section.locator(".home-statistic-value")).toHaveText([/0,00\s*€/, "0", "0", "0"]);
  await expect(page.locator("[data-home-welcome]")).toContainText("0 items across 0 locations.");
});

test("singular counts and long live names wrap at mobile width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const longName = "A".repeat(100);
  await mockHome(page, { name: longName, user: longName });
  await page.route("**/api/v1/groups/statistics", route =>
    route.fulfill({ json: { ...totals, totalItems: 1, totalLocations: 1 } })
  );
  await page.goto("/home");
  await expect(page.locator("[data-home-welcome]")).toContainText("1 item across 1 location.");
  await expect(page.locator(".home-eyebrow")).toContainText(longName);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/home-overview-mobile.png" });
});

test("malformed successful statistics are treated as unavailable", async ({ page }) => {
  await mockHome(page);
  await page.route("**/api/v1/groups/statistics", route => route.fulfill({ json: {} }));
  await page.goto("/home");
  await expect(statsSection(page).getByRole("alert")).toBeVisible();
  await expect(statsSection(page).locator(".home-statistic")).toHaveCount(0);
});
