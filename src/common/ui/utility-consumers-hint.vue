<template>
  <span v-if="requireRef" class="utility-consumers-hint">
    <template v-if="items.length">
      Also used by
      <template v-for="(item, i) in items" :key="item.id">
        <a v-if="item.url" :href="item.url">{{ item.label }}</a>
        <span v-else>{{ item.label }}</span>
        <span v-if="item.isCurrent"> (this script)</span>
        <span v-if="!item.enabled" class="subtle"> (disabled)</span><template v-if="i < items.length - 1">, </template>
      </template>.
    </template>
    <template v-else>
      No user scripts require <code>@require-utility {{ requireRef }}</code>.
    </template>
  </span>
</template>

<script setup>
import { computed } from 'vue';
import { getScriptName } from '@/common';
import { findUtilityConsumers, utilityMetaFromRequireRef } from '@/common/utility-consumers';

const props = defineProps({
  /** Installed scripts from the dashboard store. */
  scripts: Array,
  /** Current `@require-utility` reference (namespace/name). */
  requireRef: String,
  /** Id of the utility script being edited. */
  excludeUtilityId: Number,
  /** Id of the user script whose Externals tab is open. */
  currentScriptId: Number,
});

const items = computed(() => {
  const meta = utilityMetaFromRequireRef(props.requireRef);
  if (!meta) return [];
  return findUtilityConsumers(props.scripts, meta, { excludeId: props.excludeUtilityId })
    .map(s => ({
      id: s.props.id,
      label: getScriptName(s),
      enabled: !!s.config.enabled,
      isCurrent: s.props.id === props.currentScriptId,
      url: props.currentScriptId != null ? `#${SCRIPTS}/${s.props.id}` : null,
    }));
});
</script>
