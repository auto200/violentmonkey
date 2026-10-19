<template>
  <div class="edit-body utility-used-by">
    <h4>Scripts using this library</h4>
    <p v-if="!utilityRef" class="subtle">
      Set <code>@namespace</code> and <code>@name</code> in the metadata block to match
      <code>@require-utility</code> references in user scripts.
    </p>
    <template v-else>
      <p class="subtle">
        Matched by <code>@require-utility {{ utilityRef }}</code>
      </p>
      <p v-if="!consumers.length" class="subtle">
        No installed user scripts require this library.
      </p>
      <ul v-else class="consumer-list">
        <li v-for="item in consumers" :key="item.props.id">
          <a :href="item.url" v-text="item.label"/>
          <span v-if="!item.enabled" class="subtle"> (disabled)</span>
        </li>
      </ul>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { getScriptName } from '@/common';
import { formatUtilityRequireRef } from '@/common/utility-require';
import { findUtilityConsumers } from '@/common/utility-consumers';
import { store } from '../../utils';

const props = defineProps({
  script: Object,
});

const utilityRef = computed(() => formatUtilityRequireRef(props.script?.meta));

const consumers = computed(() => {
  const scr = props.script;
  if (!scr) return [];
  const scripts = findUtilityConsumers(store.scripts, scr.meta, { excludeId: scr.props.id });
  return scripts.map(s => ({
    props: s.props,
    label: getScriptName(s),
    enabled: !!s.config.enabled,
    url: `#${SCRIPTS}/${s.props.id}`,
  }));
});
</script>

<style scoped>
.utility-used-by {
  max-width: 40em;
}
.consumer-list {
  margin: .5em 0 0;
  padding-left: 1.5em;
}
.consumer-list li {
  margin: .35em 0;
}
</style>
