import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import en from "../../locales/en.json";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const card = source("../../components/global/StatCard/StatCard.vue");
const home = source("./index.vue");
const maintenance = source("../../components/Maintenance/ListView.vue");

describe("Quick Statistics presentation", () => {
  it("passes opt-in variants and captions only from Home, retaining the responsive grid", () => {
    expect(home).toContain(':variant="stat.variant"');
    expect(home).toContain(':subtitle="stat.subtitle"');
    expect(home).toContain("grid-cols-2 gap-2 md:grid-cols-4");
    const maintenanceCard = maintenance.match(/<StatCard\b[^>]*\/>/)?.[0];
    expect(maintenanceCard).toBeDefined();
    expect(maintenanceCard).not.toMatch(/variant|subtitle/);
    expect(card).toContain('variant: "default"');
    expect(card).toContain('default: "items-center bg-secondary text-secondary-foreground shadow"');
  });

  it("uses scoped primary tokens for filled surfaces and outlined figures without shadows", () => {
    expect(card).toContain('filled: "items-start bg-primary text-primary-foreground shadow-none"');
    expect(card).toContain('outline: "items-start border bg-card text-card-foreground shadow-none"');
    expect(card).toContain("'text-primary': variant === 'outline'");
    expect(card).not.toMatch(/#[\da-f]{6}/i);
  });

  it("preserves collection-aware Currency rendering and the four English captions", () => {
    expect(card).toContain('<Currency v-if="type === \'currency\'" :amount="value" />');
    expect(source("../../components/global/Currency.vue")).toContain("await useFormatCurrency()");
    expect([
      en.home.recorded_inventory_value,
      en.home.items_in_collection,
      en.home.places_to_keep_things,
      en.home.ways_to_organize,
    ]).toEqual(["Recorded inventory value", "Items in your collection", "Places to keep things", "Ways to organize"]);
  });
});
