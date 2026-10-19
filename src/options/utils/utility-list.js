import { isUtilityScript } from '@/common/utility-meta';

/**
 * @param {VMScript[]} scripts
 * @param {boolean} utilitiesOnly
 * @return {VMScript[]}
 */
export function filterUtilityScripts(scripts, utilitiesOnly) {
  if (!utilitiesOnly) return scripts;
  return scripts.filter(({ meta }) => isUtilityScript(meta));
}
