import { kOrigTag, kUtilityScript, UTILITY_META_KEYS } from '@/common/consts';
import { matchScriptMetablock } from '@/common/metablock';
import { forEachEntry } from '@/common/object';
import { metaOptionalTypes, metaTypes } from '@/common/userscript-meta';

/**                   0         1       2          3     4 */
const META_ITEM_RE = /(?:^|\n)(.*?)\/\/([\x20\t]*)(@\S+)(.*)/g;

const UTILITY_CUSTOM_REMOVE = [
  'match',
  'include',
  'exclude',
  'excludeMatch',
  'runAt',
  'injectInto',
  'noframes',
  'pathMap',
  'icon',
  'from',
  'lastInstallURL',
  'tags',
  'comment',
  'name',
  'homepageURL',
  'updateURL',
  'downloadURL',
  kOrigTag,
];

function metaKeyFromTag(tag) {
  const [keyName] = tag.slice(1).split(':');
  return keyName.replace(/[-_](\w)/g, (m, g) => g.toUpperCase());
}

function isAllowedUtilityMetaKey(camelKey) {
  return UTILITY_META_KEYS.has(camelKey);
}

/** @param {VMScript['meta']} meta */
export function isUtilityScript(meta) {
  return !!meta?.[kUtilityScript];
}

/**
 * @param {VMScript['meta']} meta
 * @return {VMScript['meta']}
 */
export function sanitizeUtilityMeta(meta) {
  if (!meta?.[kUtilityScript]) return meta;
  const kept = {};
  for (const key of UTILITY_META_KEYS) {
    const val = meta[key];
    if (val != null && val !== '') kept[key] = val;
  }
  kept[kUtilityScript] = true;
  forEachEntry.call(metaTypes, ([key, type]) => {
    meta[key] = type.default();
  });
  forEachEntry.call(metaOptionalTypes, ([key, type]) => {
    meta[key] = type.default();
  });
  Object.assign(meta, kept);
  meta.resources = {};
  delete meta.resource;
  return meta;
}

/**
 * @param {VMScript['custom']} custom
 * @return {VMScript['custom']}
 */
export function sanitizeUtilityCustom(custom) {
  if (!custom) return custom;
  for (const key of UTILITY_CUSTOM_REMOVE) {
    delete custom[key];
  }
  Object.assign(custom, {
    origInclude: true,
    origExclude: true,
    origMatch: true,
    origExcludeMatch: true,
    [kOrigTag]: true,
  });
  return custom;
}

/**
 * @param {VMScript['meta']} meta
 * @param {VMScript['custom']} [custom]
 * @param {string} [code]
 * @return {string|undefined}
 */
export function applyUtilityScriptRules(meta, custom, code) {
  if (!meta?.[kUtilityScript]) return code;
  sanitizeUtilityMeta(meta);
  if (custom) sanitizeUtilityCustom(custom);
  return code == null ? code : sanitizeUtilityMetablock(code);
}

export function sanitizeUtilityMetablock(code) {
  const block = matchScriptMetablock(code);
  if (!block?.utility) return code;
  const { match } = block;
  const filtered = [];
  const innerLines = match[4].split('\n');
  for (let i = 0; i < innerLines.length; i++) {
    const line = innerLines[i];
    const itemMatch = /\/\/([\x20\t]*)(@\S+)(.*)/.exec(line);
    if (!itemMatch) {
      filtered.push(line);
      continue;
    }
    if (isAllowedUtilityMetaKey(metaKeyFromTag(itemMatch[2]))) {
      filtered.push(line);
    }
  }
  let inner = filtered.join('\n');
  if (!inner.endsWith('\n')) inner += '\n';
  const before = code.slice(0, match.index);
  const after = code.slice(match.index + match[0].length);
  return before + match[1] + inner + match[5] + after;
}
