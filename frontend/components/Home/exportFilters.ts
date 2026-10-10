export type ExportOption = { id: string; name: string; treeString?: string };

export type InventoryExportFilters = {
  query: string;
  locations: ExportOption[];
  tags: ExportOption[];
  negateTags: boolean;
  includeArchived: boolean;
  onlyWithPhoto: boolean;
  onlyWithoutPhoto: boolean;
  fields: [string, string][];
};

export function defaultExportFilters(): InventoryExportFilters {
  return {
    query: "",
    locations: [],
    tags: [],
    negateTags: false,
    includeArchived: false,
    onlyWithPhoto: false,
    onlyWithoutPhoto: false,
    fields: [],
  };
}

export function setPhotoFilter(
  filters: InventoryExportFilters,
  key: "onlyWithPhoto" | "onlyWithoutPhoto",
  value: boolean
) {
  filters[key] = value;
  if (value) {
    filters[key === "onlyWithPhoto" ? "onlyWithoutPhoto" : "onlyWithPhoto"] = false;
  }
}

// Async option loads (and future exports) must still belong to the open session.
export function createExportSession() {
  let generation = 0;
  return {
    invalidate: () => ++generation,
    isCurrent: (token: number) => token === generation,
  };
}
