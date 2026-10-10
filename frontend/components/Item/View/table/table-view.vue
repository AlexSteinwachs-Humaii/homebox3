<script setup lang="ts" generic="TValue">
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
  import DataTableExpandedRow from "./data-table-expanded-row.vue";
  import { FlexRender, type Column, type ColumnDef, type Table as TableType } from "@tanstack/vue-table";
  import type { EntitySummary } from "~/lib/api/types/data-contracts";

  defineProps<{
    table: TableType<EntitySummary>;
    columns: ColumnDef<EntitySummary, TValue>[];
    home?: boolean;
  }>();

  const homeWidths: Record<string, string> = {
    assetId: "11%",
    name: "24%",
    quantity: "10%",
    insured: "10%",
    purchasePrice: "15%",
    location: "20%",
    archived: "10%",
  };

  const ariaSort = (column: Column<EntitySummary, unknown>) => {
    const s = column.getIsSorted();
    if (s === "asc") return "ascending";
    if (s === "desc") return "descending";
    return "none";
  };
</script>

<template>
  <Table class="w-full" :class="home ? 'home-recent-grid' : undefined">
    <TableHeader>
      <TableRow v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
        <TableHead
          v-for="header in headerGroup.headers"
          :key="header.id"
          :class="[
            home
              ? 'home-recent-header'
              : 'text-no-transform cursor-pointer bg-secondary text-sm text-secondary-foreground hover:bg-secondary/90',
            header.column.id === 'select' || header.column.id === 'actions' ? 'w-10 px-3 text-center' : '',
          ]"
          :style="home ? { width: homeWidths[header.column.id] } : undefined"
          :aria-sort="ariaSort(header.column)"
        >
          <FlexRender
            v-if="!header.isPlaceholder"
            :render="header.column.columnDef.header"
            :props="header.getContext()"
          />
        </TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <template v-if="table.getRowModel().rows?.length">
        <template v-for="row in table.getRowModel().rows" :key="row.id">
          <TableRow :data-state="row.getIsSelected() ? 'selected' : undefined">
            <TableCell
              v-for="cell in row.getVisibleCells()"
              :key="cell.id"
              :href="
                cell.column.id !== 'select' && cell.column.id !== 'actions' && cell.column.id !== 'location'
                  ? `/item/${row.original.id}`
                  : undefined
              "
              :class="cell.column.id === 'select' || cell.column.id === 'actions' ? 'w-10 px-3' : ''"
              :compact="cell.column.id === 'select' || cell.column.id === 'actions'"
            >
              <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
            </TableCell>
          </TableRow>
          <TableRow v-if="row.getIsExpanded()">
            <TableCell :colspan="row.getAllCells().length">
              <DataTableExpandedRow :item="row.original" />
            </TableCell>
          </TableRow>
        </template>
      </template>
      <template v-else>
        <TableRow>
          <TableCell :colspan="columns.length" class="h-24 text-center">
            <p>{{ $t("items.no_results") }}</p>
          </TableCell>
        </TableRow>
      </template>
    </TableBody>
  </Table>
</template>

<style scoped>
  .home-recent-header {
    background: var(--home-page);
    color: var(--home-muted);
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    overflow-wrap: anywhere;
    border-bottom: 1px solid var(--home-border);
  }
  .home-recent-grid {
    table-layout: fixed;
  }
</style>
