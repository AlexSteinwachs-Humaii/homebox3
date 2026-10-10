<script setup lang="ts">
  import { computed } from "vue";
  import type { EntitySummary } from "~/lib/api/types/data-contracts";
  import DataTable from "./table/data-table.vue";
  import { makeColumns } from "./table/columns";
  import { useI18n } from "vue-i18n";

  const props = defineProps<{
    items: EntitySummary[];
    home?: boolean;
  }>();

  const { t } = useI18n();

  const columns = computed(() => makeColumns({ t, home: props.home }).filter(c => c.enableHiding !== false));
</script>

<template>
  <DataTable view="table" :data="items" :columns="columns" disable-controls :home="home" />
</template>
