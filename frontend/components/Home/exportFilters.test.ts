import { describe, expect, it } from "vitest";
import { createExportSession, defaultExportFilters, setPhotoFilter } from "./exportFilters";

describe("Home inventory export filters", () => {
  it("starts empty, excludes archives, and resets without sharing mutable state", () => {
    const filters = defaultExportFilters();
    filters.query = "#000-123";
    filters.includeArchived = true;
    filters.locations.push({ id: "old-collection", name: "Old location" });
    filters.tags.push({ id: "tag", name: "Tag" });
    filters.negateTags = true;
    filters.fields.push(["Color", "Blue"]);
    const reset = defaultExportFilters();
    expect(reset).toEqual({
      query: "",
      locations: [],
      tags: [],
      negateTags: false,
      includeArchived: false,
      onlyWithPhoto: false,
      onlyWithoutPhoto: false,
      fields: [],
    });
    expect(filters.locations).toHaveLength(1);
  });

  it("never combines with-photo and without-photo filters", () => {
    const filters = defaultExportFilters();
    setPhotoFilter(filters, "onlyWithPhoto", true);
    expect(filters.onlyWithPhoto).toBe(true);
    setPhotoFilter(filters, "onlyWithoutPhoto", true);
    expect(filters.onlyWithPhoto).toBe(false);
    expect(filters.onlyWithoutPhoto).toBe(true);
    setPhotoFilter(filters, "onlyWithPhoto", true);
    expect(filters.onlyWithoutPhoto).toBe(false);
    setPhotoFilter(filters, "onlyWithPhoto", false);
    expect(filters.onlyWithPhoto).toBe(false);
    expect(filters.onlyWithoutPhoto).toBe(false);
  });

  it("rejects pending results after closing or switching collection, even after reopening", () => {
    const session = createExportSession();
    const firstOpen = session.invalidate();
    expect(session.isCurrent(firstOpen)).toBe(true);
    session.invalidate();
    expect(session.isCurrent(firstOpen)).toBe(false);
    const secondOpen = session.invalidate();
    expect(session.isCurrent(secondOpen)).toBe(true);
    expect(session.isCurrent(firstOpen)).toBe(false);
  });
});
