import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { UserClient } from "~~/lib/api/user";

export function statCardData(api: UserClient) {
  const { t } = useI18n();
  // The existing collection selector reloads the page: the API client and this
  // cache key both belong to the tenant captured at setup, not a later selection.
  const collectionId = useViewPreferences().value.collectionId ?? "default";
  const { data, status, error, refresh } = useAsyncData(
    `home-statistics:${collectionId}`,
    async () => {
      const response = await api.stats.group();
      if (response.error || !response.data) throw new Error("Unable to load collection statistics");
      // An empty/malformed response must not become a successful zero inventory.
      const totals = response.data;
      if (![totals.totalItemPrice, totals.totalItems, totals.totalLocations, totals.totalTags].every(Number.isFinite)) {
        throw new Error("Invalid collection statistics");
      }
      return totals;
    },
    { deep: false }
  );

  const statistics = computed(() => (status.value === "success" ? data.value : undefined));
  const cards = computed(() => {
    const totals = statistics.value;
    if (!totals) return [];
    return [
      {
        id: "value",
        label: t("home.total_value"),
        value: totals.totalItemPrice,
        type: "currency" as const,
        subtitle: t("home.recorded_value"),
      },
      {
        id: "items",
        label: t("home.total_items"),
        value: totals.totalItems,
        type: "number" as const,
        subtitle: t("home.items_helper"),
      },
      {
        id: "locations",
        label: t("home.total_locations"),
        value: totals.totalLocations,
        type: "number" as const,
        subtitle: t("home.locations_helper"),
      },
      {
        id: "tags",
        label: t("home.total_tags"),
        value: totals.totalTags,
        type: "number" as const,
        subtitle: t("home.tags_helper"),
      },
    ];
  });

  return { statistics, cards, status: computed(() => status.value), error, refresh };
}
