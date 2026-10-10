<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { statCardData } from "./statistics";
  import { itemsTable } from "./table";
  import { useTagStore } from "~/stores/tags";
  import { useLocationStore } from "~~/stores/locations";
  import BaseContainer from "@/components/Base/Container.vue";
  import BaseCard from "@/components/Base/Card.vue";
  import Subtitle from "~/components/global/Subtitle.vue";
  import StatCard from "~/components/global/StatCard/StatCard.vue";
  import ItemCard from "~/components/Item/Card.vue";
  import LocationCard from "~/components/Location/Card.vue";
  import TagChip from "~/components/Tag/Chip.vue";
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

  const itemTable = itemsTable(api);
  const { stats, statistics: statisticsData } = statCardData(api);
  const statistics = computed(() => statisticsData.value);
  const { selectedCollection } = useCollections();
  const authCtx = useAuthContext();
  const username = computed(() => authCtx.user?.name || "User");
</script>

<template>
  <div>
    <BaseContainer class="flex flex-col gap-4">
      <section aria-labelledby="collection-overview-title" class="grid gap-6 border-b pb-6 md:grid-cols-[1fr_16rem]">
        <div>
          <p class="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
            {{
              $t("home.collection_overview", {
                collection: selectedCollection?.name ?? "",
              })
            }}
          </p>
          <h1 id="collection-overview-title" class="font-display text-4xl leading-tight md:text-5xl">
            {{ $t("home.overview_headline") }}
          </h1>
          <p class="mt-3 text-sm text-muted-foreground">
            {{ $t("home.overview_supporting") }}
          </p>
        </div>
        <aside class="border-l-2 border-primary pl-4">
          <h2 class="text-xl font-medium text-primary">
            {{ $t("home.welcome_home", { name: username }) }}
          </h2>
          <p v-if="statistics" class="mt-2 text-sm text-muted-foreground">
            {{
              $t("home.collection_summary", {
                items: statistics.totalItems,
                locations: statistics.totalLocations,
              })
            }}
          </p>
          <p class="mt-1 text-sm text-muted-foreground">
            {{ $t("home.one_collection") }}
          </p>
        </aside>
      </section>

      <section>
        <Subtitle> {{ $t("home.quick_statistics") }} </Subtitle>
        <div class="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-6">
          <StatCard
            v-for="(stat, i) in stats"
            :key="i"
            :title="stat.label"
            :value="stat.value"
            :type="stat.type"
            :subtitle="stat.subtitle"
            :variant="stat.variant"
          />
        </div>
      </section>

      <section>
        <div class="flex flex-wrap items-baseline justify-between gap-x-4">
          <Subtitle> {{ $t("home.recently_added") }} </Subtitle>
          <NuxtLink to="/items" class="text-sm font-semibold text-primary hover:underline">
            {{ $t("home.search_inventory") }}
          </NuxtLink>
        </div>

        <p v-if="itemTable.items.length === 0" class="ml-2 text-sm">
          {{ $t("items.no_results") }}
        </p>
        <BaseCard v-else-if="breakpoints.lg">
          <Table
            :items="itemTable.items"
            :visible-column-ids="['assetId', 'name', 'quantity', 'insured', 'purchasePrice', 'location', 'archived']"
          />
        </BaseCard>
        <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ItemCard v-for="item in itemTable.items" :key="item.id" :item="item" />
        </div>
      </section>

      <section>
        <div class="flex flex-wrap items-baseline justify-between gap-x-4">
          <Subtitle> {{ $t("home.storage_locations") }} </Subtitle>
          <NuxtLink to="/locations" class="text-sm font-semibold text-primary hover:underline">
            {{ $t("home.all_locations") }}
          </NuxtLink>
        </div>
        <p v-if="locations.length === 0" class="ml-2 text-sm">
          {{ $t("locations.no_results") }}
        </p>
        <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          <LocationCard v-for="location in locations" :key="location.id" :location="location" />
        </div>
      </section>

      <section>
        <div class="flex flex-wrap items-baseline justify-between gap-x-4">
          <Subtitle> {{ $t("home.tags") }} </Subtitle>
          <NuxtLink to="/tags" class="text-sm font-semibold text-primary hover:underline">
            {{ $t("home.all_tags") }}
          </NuxtLink>
        </div>
        <p v-if="tags.length === 0" class="ml-2 text-sm">
          {{ $t("tags.no_results") }}
        </p>
        <div v-else class="flex flex-wrap gap-4">
          <TagChip v-for="tag in tags" :key="tag.id" size="lg" :tag="tag" />
        </div>
      </section>
    </BaseContainer>
  </div>
</template>
