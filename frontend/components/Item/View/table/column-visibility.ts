export type TableHeader = { value: string; enabled: boolean };

/** Explicit columns belong to the caller, not the person's saved inventory view. */
export function resolveTableHeaders(
  columnIds: string[],
  savedHeaders: TableHeader[] | undefined,
  visibleColumnIds?: string[]
): TableHeader[] {
  if (visibleColumnIds !== undefined) {
    const orderedIds = [...visibleColumnIds, ...columnIds.filter(id => !visibleColumnIds.includes(id))];
    return orderedIds.map(value => ({
      value,
      enabled: visibleColumnIds.includes(value),
    }));
  }

  return (
    savedHeaders ??
    columnIds.map(value => ({
      value,
      enabled: ["name", "quantity", "insured", "purchasePrice"].includes(value),
    }))
  );
}
