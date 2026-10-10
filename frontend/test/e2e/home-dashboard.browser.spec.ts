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

async function mockHome(
  page: Page,
  options: { name?: string; user?: string; items?: unknown[]; inventoryPreferences?: boolean } = {}
) {
  const name = options.name ?? "Workshop";
  const user = options.user ?? "Morgan";
  await page.context().addCookies([{ name: "hb.auth.session", value: "true", url: test.info().project.use.baseURL! }]);
  await page.addInitScript(
    ({ id, inventoryPreferences }) => {
      localStorage.setItem(
        "homebox/preferences/location",
        JSON.stringify({
          collectionId: id,
          language: "en",
          overrideFormatLocale: "de-DE",
          ...(inventoryPreferences
            ? {
                itemDisplayView: "table",
                itemsPerTablePage: 1,
                tableHeaders: [
                  { value: "archived", enabled: true },
                  { value: "name", enabled: true },
                  { value: "quantity", enabled: false },
                ],
              }
            : {}),
        })
      );
    },
    { id: collectionId, inventoryPreferences: options.inventoryPreferences }
  );
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path === "/api/v1/entities" && new URL(route.request().url()).searchParams.get("isLocation") === "true")
      body = { items: [] };
    else if (path === "/api/v1/users/self")
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
    else if (path === "/api/v1/entities")
      body = { items: options.items ?? [], total: options.items?.length ?? 0, page: 1, pageSize: 5 };
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

const recentItems = Array.from({ length: 5 }, (_, index) => ({
  id: `recent-${index}`,
  assetId: `000-00${index + 1}`,
  name: index === 0 ? "Cordless drill" : `Recent item ${index}`,
  quantity: index + 1,
  insured: index % 2 === 0,
  archived: index % 2 !== 0,
  purchasePrice: 129.5 + index,
  description: "",
  tags: [],
  itemCount: 0,
  createdAt: "2026-10-10T10:00:00Z",
  updatedAt: "2026-10-10T10:00:00Z",
  parent: index === 0 ? { id: "garage", name: "Garage" } : null,
}));
const recentSection = (page: Page) => page.getByRole("region", { name: "Recently Added" });

test("Home fixes all seven columns, retains real data and does not mutate inventory preferences", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockHome(page, { items: recentItems, inventoryPreferences: true });
  const recentRequest = page.waitForRequest(
    request =>
      new URL(request.url()).pathname === "/api/v1/entities" &&
      new URL(request.url()).searchParams.get("orderBy") === "createdAt"
  );
  await page.goto("/home");
  const query = new URL((await recentRequest).url()).searchParams;
  expect(query.get("orderBy")).toBe("createdAt");
  expect(query.get("pageSize")).toBe("5");
  const section = recentSection(page);
  await expect(section.getByRole("columnheader")).toHaveText([
    "Asset ID",
    "Name",
    "Quantity",
    "Insured",
    "Purchase Price",
    "Location",
    "Archived",
  ]);
  await expect(section.locator("tbody tr")).toHaveCount(5);
  const row = section.locator("tbody tr").first();
  await expect(row.getByRole("cell")).toHaveText([
    "000-001",
    "Cordless drill",
    "1",
    "Yes",
    /129,50\s*€/,
    "Garage",
    "No",
  ]);
  await expect(section.locator("tbody tr").nth(1).getByRole("cell").nth(3)).toHaveText("No");
  await expect(section.locator("tbody tr").nth(1).getByRole("cell").nth(6)).toHaveText("Yes");
  const readPreferences = () => page.evaluate(() => JSON.parse(localStorage.getItem("homebox/preferences/location")!));
  const before = await readPreferences();
  expect(before.itemsPerTablePage).toBe(1);
  expect(before.tableHeaders).toEqual([
    { value: "archived", enabled: true },
    { value: "name", enabled: true },
    { value: "quantity", enabled: false },
  ]);
  await expect(section.locator("tbody tr").nth(1).getByRole("cell").nth(5)).toHaveText("");
  await page.screenshot({ path: "test-results/home-recent-populated.png" });
  const item = row.getByRole("link", { name: "Cordless drill", exact: true });
  await expect(item).toHaveAttribute("href", "/item/recent-0");
  await item.focus();
  await item.press("Enter");
  await expect(page).toHaveURL(/\/item\/recent-0$/);
  await page.goto("/home");
  const location = recentSection(page).getByRole("link", { name: "Garage", exact: true });
  await location.focus();
  await location.press("Enter");
  await expect(page).toHaveURL(/\/location\/garage$/);
  await page.goto("/home");
  await recentSection(page).getByRole("link", { name: "Search inventory" }).click();
  await expect(page).toHaveURL(/\/items$/);
  // The full inventory table still honors its saved column order and visibility.
  await expect(page.getByRole("columnheader").filter({ hasText: /Archived|Name|Quantity/ })).toHaveText([
    "Archived",
    "Name",
  ]);
  const after = await readPreferences();
  expect(after.tableHeaders).toEqual(before.tableHeaders);
  expect(after.itemsPerTablePage).toBe(1);
});

test("recent inventory remains contained with long labels and mobile item cards", async ({ page }) => {
  const name = "Long inventory name ".repeat(30);
  await mockHome(page, { items: [{ ...recentItems[0], name, parent: { id: "garage", name: "G".repeat(100) } }] });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/home");
  await expect(recentSection(page).getByRole("table")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/home-recent-desktop.png" });
  await recentSection(page).getByRole("link", { name, exact: true }).click();
  await expect(page).toHaveURL(/\/item\/recent-0$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/home");
  await expect(recentSection(page).getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(recentSection(page).getByRole("table")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await recentSection(page).scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/home-recent-mobile.png" });
});
