import { inferUtilityScriptFromCode, stripScriptMetablock } from '@/common/metablock';
import { parseUtilityRequire } from '@/common/utility-require';
import { isUtilityScript } from '@/common/utility-meta';
import { aliveScripts } from './script';
import storage, { S_CODE } from './storage';

export { parseUtilityRequire, utilityRequireKey, isUtilityRequireKey, utilityRequireRefFromKey }
  from '@/common/utility-require';

/** @param {string} s */
function refPart(s) {
  return decodeURIComponent(s).trim();
}

/**
 * @param {{ namespace: string, name: string }} ids
 * @return {VMScript | undefined}
 */
export function findUtilityScript({ namespace, name }) {
  const ns = refPart(namespace);
  const nm = refPart(name);
  return aliveScripts.find(({ meta, config }) => (
    isUtilityScript(meta)
    && refPart(meta.namespace || '') === ns
    && refPart(meta.name || '') === nm
    && !!config.enabled
    && !config.removed
  ));
}

/** @param {{ namespace: string, name: string }} ids @return {VMScript | undefined} */
export function findUtilityScriptForEdit({ namespace, name }) {
  const ns = refPart(namespace);
  const nm = refPart(name);
  return aliveScripts.find(({ meta, config }) => (
    isUtilityScript(meta)
    && refPart(meta.namespace || '') === ns
    && refPart(meta.name || '') === nm
    && !config.removed
  ));
}

/** @param {string} ref @return {VMScript | undefined} */
export function findUtilityScriptForEditByRef(ref) {
  const ids = parseUtilityRequire(ref);
  if (!ids) return;
  return findUtilityScriptForEdit(ids);
}

/** @param {string} ref @return {VMScript | undefined} */
function findUtilityScriptByRefLoose(ref) {
  const ids = parseUtilityRequire(ref);
  if (!ids) return;
  const ns = refPart(ids.namespace);
  const nm = refPart(ids.name);
  const matches = aliveScripts.filter(({ meta, config }) => (
    !config.removed
    && refPart(meta.namespace || '') === ns
    && refPart(meta.name || '') === nm
  ));
  return matches.length === 1 ? matches[0] : undefined;
}

/**
 * @param {string} ref
 * @return {Promise<string | null>}
 */
export async function resolveUtilityRequire(ref) {
  const ids = parseUtilityRequire(ref);
  if (!ids) return null;
  const script = findUtilityScript(ids);
  if (!script) return null;
  const code = await storage[S_CODE].getOne(script.props.id);
  if (code == null) return null;
  return stripScriptMetablock(code).trimStart();
}

/**
 * Full utility source for editing (includes metadata block).
 * @param {string} ref
 * @return {Promise<{ id: number, code: string } | null>}
 */
export async function getUtilityRequireScript(ref) {
  if (typeof ref !== 'string') return null;
  let script = findUtilityScriptForEditByRef(ref);
  if (!script) script = findUtilityScriptByRefLoose(ref);
  if (!script?.props?.id) return null;
  const code = await storage[S_CODE].getOne(script.props.id);
  if (code == null) return null;
  if (!inferUtilityScriptFromCode(script.meta, code)) return null;
  return { id: script.props.id, code };
}
