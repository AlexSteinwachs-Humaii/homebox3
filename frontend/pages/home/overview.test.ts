import { readFileSync } from "node:fs";
import { computed, ref } from "vue";
import { createI18n } from "vue-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UserClient } from "../../lib/api/user";
import en from "../../locales/en.json";
import { statCardData } from "./statistics";

vi.mock("vue-i18n", async importOriginal => {
  const actual = await importOriginal<typeof import("vue-i18n")>();
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) };
});

const page = readFileSync(new URL("./index.vue", import.meta.url), "utf8");

afterEach(() => vi.unstubAllGlobals());

describe("Home collection overview", () => {
  it("shares live statistics with the cards without a second request or loading placeholders", async () => {
    const statistics = ref();
    const group = vi.fn().mockResolvedValue({
      data: {
        totalItems: 17,
        totalLocations: 3,
        totalTags: 2,
        totalItemPrice: 42,
      },
    });
    const asyncData = vi.fn((_key, loader) => {
      void loader().then((data: unknown) => (statistics.value = data));
      return { data: statistics };
    });
    vi.stubGlobal("computed", computed);
    vi.stubGlobal("useAsyncData", asyncData);
    const result = statCardData({ stats: { group } } as unknown as UserClient);
    expect(result.statistics.value).toBeUndefined();
    await vi.waitFor(() => expect(result.statistics.value?.totalItems).toBe(17));
    expect(asyncData).toHaveBeenCalledOnce();
    expect(group).toHaveBeenCalledOnce();
    expect(result.stats.value.map(stat => stat.value)).toEqual([42, 17, 3, 2]);
    statistics.value = {
      totalItems: 0,
      totalLocations: 0,
      totalTags: 0,
      totalItemPrice: 0,
    };
    expect(result.statistics.value?.totalItems).toBe(0);
    expect(result.stats.value.map(stat => stat.value)).toEqual([0, 0, 0, 0]);
  });

  it("uses translated copy with collection and person names, including zero counts", () => {
    const { t } = createI18n({
      legacy: false,
      locale: "en",
      messages: { en },
    }).global;
    expect(t("home.collection_overview", { collection: "Workshop" })).toBe("Workshop · Collection overview");
    expect(t("home.overview_headline")).toBe("A place for everything.");
    expect(t("home.overview_supporting")).toBe("Your inventory, organized. Find what you own and where it belongs.");
    expect(t("home.welcome_home", { name: "Morgan" })).toBe("Welcome home, Morgan.");
    expect(t("home.collection_summary", { items: 0, locations: 0 })).toBe("0 items across 0 locations.");
    expect(t("home.one_collection")).toBe("One collection. All in view.");
  });

  it("leads with the overview and reserves display styling for the headline", () => {
    expect(page.indexOf('aria-labelledby="collection-overview-title"')).toBeLessThan(
      page.indexOf("home.quick_statistics")
    );
    expect(page.match(/font-display/g)).toHaveLength(1);
    expect(page).toMatch(/<h1[^>]*class="font-display /);
    expect(page).toContain("selectedCollection?.name");
    expect(page).toContain('authCtx.user?.name || "User"');
    expect(page).toContain('v-if="statistics"');
    expect(page).toMatch(/items: statistics\.totalItems,\s*locations: statistics\.totalLocations/);
    expect(page).not.toMatch(/My Home|Alex|124 items|8 locations/);
  });
});
