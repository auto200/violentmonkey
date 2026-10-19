export const UTILITY_REQUIRE_PREFIX = 'utility:';

/**
 * @param {string} ref namespace/name
 * @return {string}
 */
export function utilityRequireKey(ref) {
  return UTILITY_REQUIRE_PREFIX + ref;
}

/** @param {string} key */
export function isUtilityRequireKey(key) {
  return typeof key === 'string' && key.startsWith(UTILITY_REQUIRE_PREFIX);
}

/** @param {string} key @return {string | null} */
export function utilityRequireRefFromKey(key) {
  return isUtilityRequireKey(key) ? key.slice(UTILITY_REQUIRE_PREFIX.length) : null;
}

/**
 * @param {string} ref
 * @return {{ namespace: string, name: string } | null}
 */
export function parseUtilityRequire(ref) {
  if (typeof ref !== 'string') return null;
  const slash = ref.indexOf('/');
  if (slash < 0) return null;
  const namespace = ref.slice(0, slash);
  const name = ref.slice(slash + 1);
  return namespace && name ? { namespace, name } : null;
}

/** @param {string} s */
export function utilityRequirePart(s) {
  return decodeURIComponent(String(s ?? '')).trim();
}

/**
 * @param {VMScript['meta']} utilityMeta
 * @param {string} ref `@require-utility` value
 */
export function utilityMetaMatchesRequireRef(utilityMeta, ref) {
  const ids = parseUtilityRequire(ref);
  if (!ids || !utilityMeta) return false;
  return utilityRequirePart(ids.namespace) === utilityRequirePart(utilityMeta.namespace)
    && utilityRequirePart(ids.name) === utilityRequirePart(utilityMeta.name);
}

/**
 * @param {VMScript['meta']} utilityMeta
 * @return {string | null} namespace/name reference
 */
export function formatUtilityRequireRef(utilityMeta) {
  const namespace = utilityRequirePart(utilityMeta?.namespace);
  const name = utilityRequirePart(utilityMeta?.name);
  return namespace && name ? `${namespace}/${name}` : null;
}
