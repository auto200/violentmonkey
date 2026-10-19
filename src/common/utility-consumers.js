import { isUtilityScript } from '@/common/utility-meta';
import {
  formatUtilityRequireRef, parseUtilityRequire, utilityMetaMatchesRequireRef,
} from '@/common/utility-require';

/**
 * User scripts that declare `@require-utility` for the given utility.
 * @param {VMScript[]} scripts
 * @param {VMScript['meta']} utilityMeta
 * @param {{ excludeId?: number }} [opts] utility script id to omit
 * @return {VMScript[]}
 */
export function findUtilityConsumers(scripts, utilityMeta, { excludeId } = {}) {
  if (!utilityMeta || !isUtilityScript(utilityMeta)) return [];
  return (scripts || []).filter(({ meta, config, props }) => (
    props.id !== excludeId
    && !config.removed
    && !isUtilityScript(meta)
    && meta.requireUtility?.some(ref => utilityMetaMatchesRequireRef(utilityMeta, ref))
  ));
}

/**
 * @param {string} requireRef `@require-utility` value
 * @return {VMScript['meta'] | null}
 */
export function utilityMetaFromRequireRef(requireRef) {
  const ids = parseUtilityRequire(requireRef);
  if (!ids) return null;
  return {
    utilityScript: true,
    namespace: ids.namespace,
    name: ids.name,
  };
}

/**
 * @param {VMScript[]} scripts
 * @return {string[]} `namespace/name` refs for autocomplete
 */
export function listUtilityRequireRefs(scripts) {
  return (scripts || [])
    .filter(({ meta, config }) => isUtilityScript(meta) && !config.removed)
    .map(({ meta }) => formatUtilityRequireRef(meta))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * @param {VMScript['meta']} utilityMeta
 * @param {VMScript[]} consumerScripts
 * @param {(script: VMScript) => string} getScriptName
 */
export function buildUtilityToUserScriptWarningMessage(utilityMeta, consumerScripts, getScriptName) {
  const ref = formatUtilityRequireRef(utilityMeta) || 'namespace/name';
  const lines = [
    'Convert this utility script to a user script?',
    '',
    'Consequences:',
    '• It will no longer be available for @require-utility.',
    '• Scripts that reference it will fail to load that library until you fix them.',
    '• With @match (and related headers) it may start running on web pages.',
  ];
  if (consumerScripts.length) {
    lines.push('', `Scripts that use @require-utility ${ref}:`);
    for (const script of consumerScripts) {
      lines.push(`• ${getScriptName(script)}`);
    }
  } else {
    lines.push('', 'No other scripts currently require this library.');
  }
  return lines.join('\n');
}
