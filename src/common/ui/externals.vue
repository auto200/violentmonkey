<template>
  <div class="edit-externals flex flex-col">
    <div v-if="!install || all.length > 1" class="select"
         ref="$list" focusme @keydown="moveIndex" @scroll="saveScroll"
         :data-has-main="install ? '' : null">
      <dl v-for="([type, url, fullUrl, contents], i) of all" :key="i"
          class="flex"
          :class="{
            active: index === i,
            loading: install && i && contents == null,
            error: contents === false,
          }"
          @click="onSelectItem(i, contents)">
        <dt v-text="type"/>
        <dd class="ellipsis flex-1">
          <a v-if="type !== '@require-utility'" :href="fullUrl" target="_blank">&nearr;</a>
          <span v-text="decodeURIComponent(url)"/>
        </dd>
        <dd v-if="contents" v-text="formatLength(contents, type)" class="ml-2"/>
      </dl>
    </div>
    <div class="contents flex-1 flex flex-col min-h-0">
      <p v-if="canEditLocal" class="externals-edit-hint">
        Local utility — Save updates all scripts that @require it.
        <UtilityConsumersHint
          v-if="localUtilityRef && scripts"
          class="utility-consumers-hint-block"
          :scripts
          :require-ref="localUtilityRef"
          :exclude-utility-id="data.utilityId"
          :current-script-id="value?.props?.id"
        />
      </p>
      <div class="contents-editor pos-rel flex-1 min-h-0">
        <KeepAlive :key="data.key" :max="10" ref="$body">
        <img v-if="data.img" class="abs-full" :src="data.img">
        <VmCode
          v-else
          class="abs-full"
          :value="data.code"
          ref="$code"
          :readOnly="!canEditLocal"
          :cm-options="cmOptions"
          :mode="data.mode"
          :commands="{...commands, close: () => $list?.focus() }"
          :active="isActive && !data.img"
          @code-dirty="onCodeDirty"
        />
        </KeepAlive>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onActivated, onDeactivated, ref, watch } from 'vue';
import { dataUri2text, formatByteLength, getFullUrl, i18n, makeDataUri, sendCmdDirectly }
  from '@/common';
import VmCode from '@/common/ui/code';
import UtilityConsumersHint from '@/common/ui/utility-consumers-hint';
import { focusMe, hasKeyModifiers, showMessage } from '@/common/ui/index';

const props = defineProps([
  'value', 'cmOptions', 'commands', 'install', 'updatedDep', 'readOnly', 'scripts',
]);
const emit = defineEmits(['dirty']);
const $body = ref();
const $code = ref();
const $list = ref();
const isActive = ref();
const dependencies = ref({});
const index = ref(0);
const data = ref({ code: '', key: 'init' });
const dirty = ref(false);

/** @param {*} val */
function asEditorText(val) {
  return typeof val === 'string' ? val : '';
}

const all = computed(() => {
  const { code, deps = dependencies.value, url: mainUrl } = props.install || {};
  const { custom: { pathMap = {} } = {}, meta } = props.value || {};
  const { require = [], requireUtility = [], resources = {} } = meta || {};
  return [
    ...mainUrl ? [[i18n('editNavCode'), mainUrl, code]] : [],
    ...requireUtility.map(ref => [
      '@require-utility',
      ref,
      ref,
      deps[`2${ref}`],
    ]),
    ...require.map(url => [
      '@require',
      url,
      pathMap[url] || getFullUrl(url, mainUrl),
      deps[`0${url}`],
    ]),
    ...Object.entries(resources).map(([id, url]) => [
      `@resource ${id}`,
      url,
      pathMap[url] || getFullUrl(url, mainUrl),
      deps[`1${url}`],
    ]),
  ];
});

const canEditLocal = computed(() => (
  !props.readOnly
  && !props.install
  && !!data.value.utilityId
  && !data.value.img
  && !data.value.loadError
));

const localUtilityRef = computed(() => {
  if (!canEditLocal.value) return '';
  const row = all.value[index.value];
  return row?.[0] === '@require-utility' ? row[1] : '';
});

const MOVEMENT = {
  ArrowDown: 1,
  ArrowUp: -1,
  PageDown: 10,
  PageUp: -10,
  Home: -1e9,
  End: 1e9,
  Enter: 0,
};
const scrollIntoViewIfNeeded = Element.prototype.scrollIntoViewIfNeeded
|| function (center = true) {
  const parent = this.parentElement.getBoundingClientRect();
  const me = this.getBoundingClientRect();
  if (me.bottom > parent.bottom || me.top < parent.top) {
    this.scrollIntoView(center ? { block: 'center' } : undefined);
  }
};
let listScrollTop;

defineExpose({
  $code, // used by parent
  isDirty: () => dirty.value,
  saveCurrentLocalUtility,
});
onActivated(() => {
  isActive.value = true;
  ($list.value || {}).scrollTop = listScrollTop || 0;
  update();
});
onDeactivated(() => {
  isActive.value = false;
});
watch(() => props.updatedDep, url => {
  const [, currentUrl] = all.value[index.value];
  const deps = dependencies.value;
  deps[0 + url] = deps[1 + url] = null;
  if (url === currentUrl) update();
});
watch(
  () => {
    const { meta } = props.value || {};
    return [
      index.value,
      props.value?.props?.id,
      meta?.requireUtility?.join('\0'),
      meta?.require?.join('\0'),
    ];
  },
  update,
  { flush: 'post', immediate: true },
);

async function update() {
  const row = all.value[index.value];
  if (!row) return;
  const [type, url] = row;
  if (typeof url !== 'string' || !url) return;
  const { install } = props;
  const isMain = install && !index.value;
  const isDataUri = url.startsWith('data:');
  const isUtilReq = !isMain && type === '@require-utility';
  const isReq = !isMain && !isDataUri && type === '@require';
  const depsUrl = isUtilReq ? `2${url}` : `${+!isReq}${url}`;
  let code;
  let contentType;
  let img;
  let raw;
  let utilityId;
  let loadedLocalUtility;
  if (isMain) {
    code = install.code;
  } else {
    if (isDataUri) {
      raw = url;
    } else if (install) {
      raw = install.deps[depsUrl];
      if (!isReq) raw = makeDataUri(raw);
    } else if (isUtilReq && !install) {
      loadedLocalUtility = true;
      const util = await sendCmdDirectly('GetUtilityRequireScript', url);
      if (util && util.id != null && typeof util.code === 'string') {
        utilityId = util.id;
        code = util.code;
      } else {
        code = false;
      }
    } else {
      const key = props.value.custom.pathMap?.[url] || url;
      raw = await sendCmdDirectly('Storage', [isReq ? 'require' : 'cache', 'getOne', key]);
      if (!isReq) raw = makeDataUri(raw, key);
    }
    if (!loadedLocalUtility && (isReq || !raw)) {
      code = raw;
    } else if (!loadedLocalUtility && typeof raw === 'string' && raw.startsWith('data:image')) {
      img = raw;
    } else if (!loadedLocalUtility && typeof raw === 'string') {
      [contentType, code] = raw.split(',');
      if (code == null) { // workaround for bugs in old VM, see 2e135cf7
        const fileExt = url.match(/\.(\w+)([#&?]|$)/)?.[1] || '';
        contentType = /^(png|jpe?g|bmp|svgz?|gz|zip)$/i.test(fileExt)
          ? ''
          : `text/${fileExt.toLowerCase()}`;
      } else if (contentType) {
        contentType = contentType.split(/[:;]/)[1];
      }
      code = dataUri2text(isDataUri ? url : `${contentType};base64,${code}`);
    }
  }
  const loadError = code === false;
  data.value = {
    img,
    code: asEditorText(code),
    key: depsUrl,
    utilityId,
    loadError,
    mode: contentType === 'text/css' || /\.css([#&?]|$)/i.test(url) ? 'css' : null,
  };
  dependencies.value[depsUrl] = img || (loadError ? false : data.value.code);
  dirty.value = false;
  emit('dirty', false);
}

function onCodeDirty(isDirty) {
  if (!canEditLocal.value) return;
  dirty.value = isDirty;
  emit('dirty', isDirty);
}

async function saveCurrentLocalUtility() {
  if (!dirty.value || !canEditLocal.value) return false;
  const { utilityId } = data.value;
  const code = $code.value.getRealContent();
  try {
    const res = await sendCmdDirectly('ParseScript', {
      id: utilityId,
      code,
      message: '',
      bumpDate: true,
    });
    if (res.errors?.length) {
      showMessage({ text: res.errors.join('\n') });
      return false;
    }
    $code.value.cm.markClean();
    dirty.value = false;
    emit('dirty', false);
    await update();
    return true;
  } catch (err) {
    showMessage({ text: String(err.message || err) });
    return false;
  }
}

async function confirmDiscardEdits() {
  return !dirty.value || global.confirm(i18n('confirmNotSaved'));
}

async function onSelectItem(i, contents) {
  if (contents === false || i === index.value) return;
  if (!await confirmDiscardEdits()) return;
  index.value = i;
}

function formatLength(str, type) {
  let len = str?.length;
  if (type.startsWith('@resource')) {
    len = Math.round((len - str.indexOf(',') - 1) * 6 / 8); // base64 uses 6 bits out of 8
  }
  return formatByteLength(len);
}
async function moveIndex(evt) {
  if (hasKeyModifiers(evt)) return;
  const delta = MOVEMENT[evt.key];
  if (delta === 0 && !data.value.img) focusMe($body.value.$el);
  if (!delta) return;
  evt.preventDefault();
  const i = index.value + delta;
  const len = all.value.length;
  const newIndex = delta < -1 || delta > 1
      ? Math.max(0, Math.min(len - 1, i))
      : (i + len) % len;
  if (newIndex === index.value) return;
  if (!await confirmDiscardEdits()) return;
  index.value = newIndex;
  await nextTick();
  $list.value.querySelector('.active')::scrollIntoViewIfNeeded();
}
function saveScroll() {
  listScrollTop = $list.value.scrollTop;
}
</script>

<style>
$outerPadX: 1rem;
$mainEntryBorder: 6px double;
.edit-externals {
  --border: $mainEntryBorder var(--fill-8);
  border-top: var(--border);
  min-height: 0;
  .externals-edit-hint {
    flex: 0 0 auto;
    font-size: 12px;
    line-height: 1.25;
    margin: 0;
    padding: 2px $outerPadX;
    color: var(--fill-8);
    border-bottom: 1px solid var(--fill-3);
    .utility-consumers-hint-block {
      display: block;
      margin-top: .35em;
    }
  }
  > .select {
    min-height: 1.25rem;
    max-height: 15vh;
    overflow-y: auto;
    border-bottom: 2px solid var(--fill-3);
    padding-bottom: calc($outerPadX/2);
    &:focus .active span {
      text-decoration: underline;
    }
    &[data-has-main] dl:first-child {
      padding-top: .5em;
      padding-bottom: .5em;
      border-bottom: 1px solid var(--fill-3);
      position: sticky;
      top: 0;
      background: var(--bg);
    }
    dl {
      padding-right: $outerPadX;
      align-items: center;
      white-space: nowrap;
      &.active {
        font-weight: bold;
        color: blue;
      }
      &.loading dd {
        color: var(--fill-7);
      }
      &.error dd {
        color: red;
      }
      &:not(.error) {
        cursor: pointer;
        &:hover dd {
          text-decoration: underline;
          a {
            text-decoration: none;
          }
        }
      }
    }
    dt {
      color: darkblue;
      margin-left: $outerPadX;
      font-family: monospace;
    }
    a {
      padding: 0 .5em;
      cursor: alias;
      &:hover {
        background: var(--fill-3);
      }
    }
  }
  > .contents {
    min-height: 0;
    flex: 1 1 auto;
    position: relative;
    .contents-editor > img {
      padding: 1rem;
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
  }
  @media (prefers-color-scheme: dark) {
    .select {
      &.error dd {
        color: #ff4747;
      }
      dl.active {
        color: coral;
        dt {
          color: hotpink;
        }
      }
      dt {
        color: #c34ec3;
      }
    }
  }
}
</style>
