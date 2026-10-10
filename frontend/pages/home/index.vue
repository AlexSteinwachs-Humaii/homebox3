<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { statCardData } from "./statistics";
  import { itemsTable } from "./table";
  import { useTagStore } from "~/stores/tags";
  import { useLocationStore } from "~~/stores/locations";
  import BaseContainer from "@/components/Base/Container.vue";
  import StatCard from "~/components/global/StatCard/StatCard.vue";
  import ItemCard from "~/components/Item/Card.vue";
  import LocationCard from "~/components/Location/Card.vue";
  import TagChip from "~/components/Tag/Chip.vue";
  import RequestState from "~/components/Home/RequestState.vue";
  import Table from "~/components/Item/View/Table.vue";

  const { t } = useI18n();

  definePageMeta({
    middleware: ["auth"],
  });
  useHead({
    title: "HomeBox | " + t("menu.home"),
  });

  const api = useUserApi();
  const breakpoints = useBreakpoints();

  const locationStore = useLocationStore();
  const locations = computed(() => locationStore.parentLocations);

  const tagsStore = useTagStore();
  const tags = computed(() => tagsStore.tags);

  const { items: recentItems, status: recentStatus, refresh: refreshRecent } = itemsTable(api);
  const prefs = useViewPreferences();
  const boundCollection = prefs.value.collectionId ?? null;
  const collectionMatches = computed(() => (prefs.value.collectionId ?? null) === boundCollection);
  // Currency and API headers are page-lifetime values. Preserve the selector's
  // reload contract even when collection context is established/changed elsewhere.
  watch(
    collectionMatches,
    matches => {
      if (!matches && import.meta.client) window.location.reload();
    },
    { flush: "post" }
  );
  onMounted(() => {
    if (locationStore.parentsStatus === "idle") void locationStore.refreshParents();
    if (tagsStore.status === "idle") void tagsStore.ensureAllTagsFetched();
  });
  const { statistics, cards: stats, status: statsStatus, refresh: refreshStats } = statCardData(api);
  const { selectedCollection, load: loadCollections } = useCollections();
  // On mobile the closed sidebar does not mount its selector, so Home must
  // obtain its own collection context through the shared guarded loader.
  onMounted(() => {
    if (!selectedCollection.value) void loadCollections();
  });
  const auth = useAuthContext();
  const welcomeCounts = computed(() => {
    if (!statistics.value) return "";
    const { totalItems, totalLocations } = statistics.value;
    const items = t("home.item_count", { count: totalItems }, totalItems);
    const locations = t("home.location_count", { count: totalLocations }, totalLocations);
    return t("home.welcome_counts", { items, locations });
  });
</script>

<template>
  <div>
    <BaseContainer v-if="collectionMatches" class="flex flex-col gap-4">
      <section
        class="grid min-w-0 gap-6 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,18rem)]"
        aria-labelledby="home-overview-title"
      >
        <div class="min-w-0">
          <p class="home-eyebrow break-words">
            {{
              $t("home.collection_overview", {
                collection: selectedCollection?.name ?? "",
              })
            }}
          </p>
          <h1 id="home-overview-title" class="home-headline my-2">
            {{ $t("home.headline") }}
          </h1>
          <p class="home-muted text-sm">{{ $t("home.supporting_copy") }}</p>
        </div>
        <div data-home-welcome class="min-w-0 border-l-2 pl-4">
          <p class="break-words text-xl">
            {{ $t("home.welcome_home", { name: auth.user?.name ?? "" }) }}
          </p>
          <p v-if="statistics" class="home-muted mt-2 text-sm">
            {{ welcomeCounts }}
          </p>
          <p class="home-muted mt-1 text-sm">
            {{ $t("home.collection_in_view") }}
          </p>
        </div>
      </section>
      <section class="home-section" aria-labelledby="home-stats-title" :aria-busy="statsStatus === 'pending'">
        <div class="mb-3 flex min-w-0 flex-wrap items-baseline justify-between gap-2">
          <h2 id="home-stats-title" class="home-section-title">
            {{ $t("home.quick_statistics") }}
          </h2>
          <p v-if="selectedCollection" class="home-muted min-w-0 max-w-full break-words text-xs">
            {{
              $t("home.statistics_collection", {
                collection: selectedCollection.name,
              })
            }}
          </p>
        </div>
        <div v-if="statsStatus === 'error'" role="alert" class="home-surface p-4">
          <p class="home-muted mb-3">{{ $t("home.statistics_error") }}</p>
          <button type="button" class="home-action home-action-outline" @click="refreshStats()">
            {{ $t("home.retry_statistics") }}
          </button>
        </div>
        <p v-else-if="!statistics" role="status" class="home-muted py-4">
          {{ $t("home.statistics_loading") }}
        </p>
        <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            v-for="stat in stats"
            :key="stat.id"
            editorial
            :featured="stat.id === 'value'"
            :title="stat.label"
            :value="stat.value"
            :type="stat.type"
            :subtitle="stat.subtitle"
          />
        </div>
      </section>

      <section class="home-section min-w-0" aria-labelledby="home-recent-title" :aria-busy="recentStatus === 'pending'">
        <div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="home-recent-title" class="home-section-title">
            {{ $t("home.recently_added") }}
          </h2>
          <NuxtLink to="/items" class="home-text-action">
            {{ $t("home.search_inventory") }} <span aria-hidden="true">→</span>
          </NuxtLink>
        </div>

        <RequestState :status="recentStatus" :section="$t('home.recently_added')" @retry="refreshRecent()">
          <p v-if="recentItems.length === 0" class="ml-2 text-sm">
            {{ $t("items.no_results") }}
          </p>
          <Table v-else-if="breakpoints.lg" :items="recentItems" home />
          <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ItemCard v-for="item in recentItems" :key="item.id" :item="item" />
          </div>
        </RequestState>
      </section>

      <section
        class="home-section min-w-0"
        aria-labelledby="home-locations-title"
        :aria-busy="locationStore.parentsStatus === 'pending'"
      >
        <div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="home-locations-title" class="home-section-title">
            {{ $t("home.storage_locations") }}
          </h2>
          <NuxtLink to="/locations" class="home-text-action">
            {{ $t("home.all_locations") }} <span aria-hidden="true">→</span>
          </NuxtLink>
        </div>
        <RequestState
          :status="locationStore.parentsStatus"
          :section="$t('home.storage_locations')"
          @retry="locationStore.refreshParents()"
        >
          <p v-if="locations.length === 0" class="ml-2 text-sm">
            {{ $t("locations.no_results") }}
          </p>
          <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            <LocationCard v-for="location in locations" :key="location.id" :location="location" home />
          </div>
        </RequestState>
      </section>

      <section
        class="home-section min-w-0"
        aria-labelledby="home-tags-title"
        :aria-busy="tagsStore.status === 'pending'"
      >
        <div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="home-tags-title" class="home-section-title">
            {{ $t("home.tags") }}
          </h2>
          <NuxtLink to="/tags" class="home-text-action">
            {{ $t("home.all_tags") }} <span aria-hidden="true">→</span>
          </NuxtLink>
        </div>
        <RequestState :status="tagsStore.status" :section="$t('home.tags')" @retry="tagsStore.refresh()">
          <p v-if="tags.length === 0" class="ml-2 text-sm">
            {{ $t("tags.no_results") }}
          </p>
          <div v-else class="flex min-w-0 flex-wrap gap-2">
            <TagChip v-for="tag in tags" :key="tag.id" :tag="tag" home hide-icon />
          </div>
        </RequestState>
      </section>
    </BaseContainer>
  </div>
</template>

<style scoped>
  /* The shared primitive has generous two-sided section padding. Home already
     supplies a grid gap, so avoid doubling it between compact dashboard sections. */
  .home-section {
    padding-block: 0;
    border-top: 0;
  }
  .home-section[aria-labelledby="home-stats-title"] {
    border-top: 1px solid var(--home-border);
    padding-top: 1.25rem;
  }
  .home-text-action {
    color: var(--home-purple);
    font-size: 0.8125rem;
    font-weight: 700;
  }
  .home-text-action:hover {
    text-decoration: underline;
  }
  .home-text-action:focus-visible {
    outline: 2px solid var(--home-purple);
    outline-offset: 4px;
  }
  [data-home-welcome] {
    border-color: var(--home-purple);
    color: var(--home-purple);
  }
</style>
