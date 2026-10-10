<script setup lang="ts">
  import { DialogID, useDialog } from "@/components/ui/dialog-provider/utils";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { Label } from "@/components/ui/label";
  import { Switch } from "@/components/ui/switch";
  import {
    Dialog,
    DialogTrigger,
    DialogScrollContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
  } from "@/components/ui/dialog";
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
  import SearchFilter from "~/components/Search/Filter.vue";
  import { createExportSession, defaultExportFilters, setPhotoFilter, type ExportOption } from "./exportFilters";

  const api = useUserApi();
  const { selectedId } = useCollections();
  const { activeDialog, openDialog, closeDialog } = useDialog();
  const open = computed(() => activeDialog.value === DialogID.InventoryExport);
  const filters = ref(defaultExportFilters());
  const locations = ref<ExportOption[]>([]);
  const tags = ref<ExportOption[]>([]);
  const fields = ref<string[]>([]);
  const fieldValues = ref<Record<string, string[]>>({});
  const loading = ref(false);
  const optionsError = ref(false);
  const session = createExportSession();
  let token = 0;

  function clear() {
    token = session.invalidate();
    filters.value = defaultExportFilters();
    locations.value = [];
    tags.value = [];
    fields.value = [];
    fieldValues.value = {};
    loading.value = false;
    optionsError.value = false;
  }

  async function loadOptions() {
    clear();
    if (!selectedId.value) return;
    const requestToken = token;
    loading.value = true;
    try {
      const [locationResult, tagResult, fieldResult] = await Promise.all([
        api.items.getLocations({ filterChildren: false }),
        api.tags.getAll(),
        api.items.fields.getAll(),
      ]);
      if (!session.isCurrent(requestToken)) return;
      // Do not offer partial or previously cached options on failure.
      if (locationResult.error || tagResult.error || fieldResult.error) {
        optionsError.value = true;
        return;
      }
      locations.value = locationResult.data;
      tags.value = tagResult.data;
      fields.value = fieldResult.data;
    } catch {
      if (session.isCurrent(requestToken)) optionsError.value = true;
    } finally {
      if (session.isCurrent(requestToken)) loading.value = false;
    }
  }

  async function changeField(index: number) {
    const tuple = filters.value.fields[index];
    if (!tuple) return;
    tuple[1] = "";
    const name = tuple[0];
    if (!name || fieldValues.value[name]) return;
    const requestToken = token;
    try {
      const result = await api.items.fields.getAllValues(name);
      if (!session.isCurrent(requestToken)) return;
      if (result.error) {
        optionsError.value = true;
        return;
      }
      fieldValues.value[name] = result.data;
    } catch {
      if (session.isCurrent(requestToken)) optionsError.value = true;
    }
  }

  watch(
    open,
    value => {
      if (value) void loadOptions();
      else clear();
    },
    { flush: "sync" }
  );
  watch(
    selectedId,
    () => {
      closeDialog(DialogID.InventoryExport);
      clear();
    },
    { flush: "sync" }
  );
  onBeforeUnmount(clear);
</script>

<template>
  <Dialog :dialog-id="DialogID.InventoryExport">
    <DialogTrigger as-child>
      <Button variant="outline" :disabled="!selectedId" @click="openDialog(DialogID.InventoryExport)">{{
        $t("home.export_csv")
      }}</Button>
    </DialogTrigger>
    <DialogScrollContent class="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{{ $t("home.export_csv") }}</DialogTitle>
        <DialogDescription>{{ $t("home.export_description") }}</DialogDescription>
      </DialogHeader>
      <div class="space-y-4">
        <div class="space-y-2">
          <Label for="export-search">{{ $t("global.search") }}</Label>
          <Input id="export-search" v-model="filters.query" :placeholder="$t('global.search')" />
          <p class="text-sm text-muted-foreground">{{ $t("items.tip_1") }}</p>
        </div>
        <p v-if="loading" role="status">{{ $t("global.loading") }}</p>
        <div v-if="optionsError" role="alert" class="space-y-2">
          <p>{{ $t("home.export_options_error") }}</p>
          <Button variant="outline" @click="loadOptions">{{ $t("home.export_retry_options") }}</Button>
        </div>
        <div v-if="!loading && !optionsError" class="flex flex-wrap gap-2">
          <SearchFilter
            v-model="filters.locations"
            :label="$t('global.locations')"
            :options="locations"
            content-class="z-[60]"
          />
          <SearchFilter v-model="filters.tags" :label="$t('global.tags')" :options="tags" content-class="z-[60]" />
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="flex items-center justify-between gap-2">
            <Label for="export-negate-tags">{{ $t("items.negate_tags") }}</Label>
            <Switch id="export-negate-tags" v-model="filters.negateTags" />
          </div>
          <div class="flex items-center justify-between gap-2">
            <Label for="export-archived">{{ $t("items.include_archive") }}</Label>
            <Switch id="export-archived" v-model="filters.includeArchived" />
          </div>
          <div class="flex items-center justify-between gap-2">
            <Label for="export-with-photo">{{ $t("items.only_with_photo") }}</Label>
            <Switch
              id="export-with-photo"
              :model-value="filters.onlyWithPhoto"
              @update:model-value="setPhotoFilter(filters, 'onlyWithPhoto', $event)"
            />
          </div>
          <div class="flex items-center justify-between gap-2">
            <Label for="export-without-photo">{{ $t("items.only_without_photo") }}</Label>
            <Switch
              id="export-without-photo"
              :model-value="filters.onlyWithoutPhoto"
              @update:model-value="setPhotoFilter(filters, 'onlyWithoutPhoto', $event)"
            />
          </div>
        </div>
        <fieldset v-if="!loading && !optionsError" class="space-y-3">
          <legend class="text-sm font-medium">
            {{ $t("items.custom_fields") }}
          </legend>
          <div v-for="(field, index) in filters.fields" :key="index" class="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <div class="min-w-0 space-y-1">
              <Label :for="`export-field-${index}`">{{ $t("items.field") }}</Label>
              <Select v-model="field[0]" @update:model-value="changeField(index)">
                <SelectTrigger :id="`export-field-${index}`"
                  ><SelectValue :placeholder="$t('items.select_field')"
                /></SelectTrigger>
                <SelectContent
                  ><SelectItem v-for="name in fields" :key="name" :value="name">{{ name }}</SelectItem></SelectContent
                >
              </Select>
            </div>
            <div class="min-w-0 space-y-1">
              <Label :for="`export-value-${index}`">{{ $t("items.field_value") }}</Label>
              <Select v-model="field[1]" :disabled="!field[0]">
                <SelectTrigger :id="`export-value-${index}`"
                  ><SelectValue :placeholder="$t('items.select_value')"
                /></SelectTrigger>
                <SelectContent
                  ><SelectItem v-for="value in fieldValues[field[0]]" :key="value" :value="value">{{
                    value
                  }}</SelectItem></SelectContent
                >
              </Select>
            </div>
            <Button variant="outline" class="self-end" @click="filters.fields.splice(index, 1)">{{
              $t("global.delete")
            }}</Button>
          </div>
          <Button size="sm" variant="outline" @click="filters.fields.push(['', ''])">{{ $t("items.add") }}</Button>
        </fieldset>
      </div>
      <DialogFooter class="gap-2">
        <Button variant="outline" @click="filters = defaultExportFilters()">{{ $t("home.export_reset") }}</Button>
        <Button variant="secondary" @click="closeDialog(DialogID.InventoryExport)">{{ $t("global.cancel") }}</Button>
      </DialogFooter>
    </DialogScrollContent>
  </Dialog>
</template>
