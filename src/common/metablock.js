import {
  kUtilityScript, METABLOCK_RE, UTILITY_METABLOCK_RE,
} from '@/common/consts';

/** @return {boolean} */
export function isHtmlLikeScript(text) {
  return /^\s*</.test(text);
}

/**
 * @param {string} code
 * @return {{ match: RegExpExecArray, utility: boolean } | null}
 */
export function matchScriptMetablock(code) {
  if (isHtmlLikeScript(code)) return null;
  const utilityMatch = UTILITY_METABLOCK_RE.exec(code);
  if (utilityMatch) return { match: utilityMatch, utility: true };
  const userMatch = METABLOCK_RE.exec(code);
  if (userMatch) return { match: userMatch, utility: false };
  return null;
}

/** @return {boolean|?RegExpExecArray} */
export function matchAnyMetablock(text) {
  return matchScriptMetablock(text)?.match ?? false;
}

/** @param {string} code */
export function stripScriptMetablock(code) {
  return code.replace(METABLOCK_RE, '').replace(UTILITY_METABLOCK_RE, '');
}

/**
 * @param {VMScript['meta']} meta
 * @param {string} code
 */
export function inferUtilityScriptFromCode(meta, code) {
  if (meta?.[kUtilityScript]) return true;
  return !!matchScriptMetablock(code)?.utility;
}
