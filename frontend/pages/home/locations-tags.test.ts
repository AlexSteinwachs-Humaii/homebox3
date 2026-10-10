import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import en from "../../locales/en.json";

const page = readFileSync(new URL("./index.vue", import.meta.url), "utf8");
const template = page.slice(page.indexOf("<template>"), page.lastIndexOf("</template>"));
const sections = template.split("<section").slice(1);
const locations = sections[3]!;
const tags = sections[4]!;

describe("Home locations and tags", () => {
  it("keeps all five sections in collection browsing order", () => {
    expect(sections).toHaveLength(5);
    [
      "collection-overview-title",
      "home.quick_statistics",
      "home.recently_added",
      "home.storage_locations",
      "home.tags",
    ].forEach((label, index) => expect(sections[index]).toContain(label));
  });

  it("keeps the full-list actions outside the populated and empty branches", () => {
    for (const [section, route, key, label, collection] of [
      [locations, "/locations", "home.all_locations", en.home.all_locations, "locations"],
      [tags, "/tags", "home.all_tags", en.home.all_tags, "tags"],
    ] as const) {
      expect(section).toContain(`<NuxtLink to="${route}" class="text-sm font-semibold text-primary hover:underline">`);
      expect(section).toContain(`$t("${key}")`);
      expect(section.indexOf(key)).toBeLessThan(section.indexOf(`v-if="${collection}.length === 0"`));
      expect(section).toContain(`$t("${collection}.no_results")`);
      expect(label).toBe(collection === "locations" ? "All locations" : "All tags");
    }
  });

  it("renders only store-backed locations and tags through the existing components", () => {
    expect(page).toContain("computed(() => locationStore.parentLocations)");
    expect(page).toContain("computed(() => tagsStore.tags)");
    expect(locations).toContain(
      '<LocationCard v-for="location in locations" :key="location.id" :location="location" />'
    );
    expect(tags).toContain('<TagChip v-for="tag in tags" :key="tag.id" size="lg" :tag="tag" />');
    expect(tags).not.toContain("shadow-md");
    expect(locations).not.toMatch(/Garage|Office|Attic/);
    expect(tags).not.toMatch(/Tools|Electronics|Outdoor/);
    expect(locations).not.toMatch(/#[\da-f]{3,8}|style=/i);
    expect(tags).not.toMatch(/#[\da-f]{3,8}|style=/i);
  });
});
