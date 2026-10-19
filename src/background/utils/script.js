import {
  encodeFilename, getFullUrl, getScriptHome, getScriptSupportUrl, getTab, i18n,
} from '@/common';
import {
  __CODE, GLOB_ALL, HOMEPAGE_URL, INFERRED, kOrigTag, kRequireUtility, kUtilityScript,
  SUPPORT_URL,
} from '@/common/consts';
import { matchAnyMetablock, matchScriptMetablock } from '@/common/metablock';
import { parseUtilityRequire } from '@/common/utility-require';
import { formatDate } from '@/common/date';
import { mapEntry } from '@/common/object';
import defaults, { kScriptTemplate, kUtilityScriptTemplate } from '@/common/options-defaults';
import { defaultMetaType, metaOptionalTypes, metaTypes } from '@/common/userscript-meta';
import {
  applyUtilityScriptRules,
  isUtilityScript,
  sanitizeUtilityCustom,
  sanitizeUtilityMeta,
  sanitizeUtilityMetablock,
} from '@/common/utility-meta';
export {
  applyUtilityScriptRules,
  isUtilityScript,
  sanitizeUtilityCustom,
  sanitizeUtilityMeta,
  sanitizeUtilityMetablock,
};
import broadcast from './broadcast';
import { addOwnCommands, commands } from './init';
import { getOption, hookOptionsInit } from './options';
import storage, { S_MOD_PRE, S_SCRIPT_PRE } from './storage';
import { injectableRe } from './tabs';
import { testScript, testerBatch } from './tester';

addOwnCommands({
  async NewScript({ code, tabId, utility }) {
    if (code) return newScriptFromCode(code);
    if (utility) return newUtilityScript();
    const tab = tabId >= 0 && await getTab(tabId) || {};
    const tabUrl = tab.url;
    const url = injectableRe.test(tabUrl) && `${tabUrl.split(/[#?]/)[0]}*`;
    const { host = 'example.org', domain } = url ? commands.GetTabDomain(url) : {};
    return newScript({
      url: url || `*://${host}/*`,
      name: domain || '',
      icon: tab.favIconUrl || '',
    });
  },
});

const ERR_UTILITY_TEMPLATE = 'The utility script template must use // ==UtilityScript== ... ==/UtilityScript==';

export function validateUtilityTemplate(tpl) {
  const errors = [];
  const meta = !tpl /*empty = default*/ || parseMeta(tpl, { errors });
  if (!meta) errors.unshift(i18n('msgInvalidScript'));
  else if (!meta[kUtilityScript]) errors.push(ERR_UTILITY_TEMPLATE);
  if (errors.length) throw errors;
}

hookOptionsInit((changes, firstRun) => {
  if (!firstRun && kScriptTemplate in changes) {
    const errors = [];
    const tpl = changes[kScriptTemplate];
    const meta = !tpl /*empty = default*/ || parseMeta(tpl, { errors });
    if (!meta) errors.unshift(i18n('msgInvalidScript'));
    if (errors.length) throw errors;
  }
  if (!firstRun && kUtilityScriptTemplate in changes) {
    validateUtilityTemplate(changes[kUtilityScriptTemplate]);
  }
});

/** @type {{ [id: string]: VMScript }} */
export const scriptMap = {};
/** @type {{ [id: string]: number }} */
export const scriptSiteVisited = {};
/** @type {VMScript[]} */
export const aliveScripts = [];
/** @type {VMScript[]} */
export const removedScripts = [];
/** @return {boolean|?RegExpExecArray} */
export const matchUserScript = matchAnyMetablock;

/**                   0         1       2          3     4 */
const META_ITEM_RE = /(?:^|\n)(.*?)\/\/([\x20\t]*)(@\S+)(.*)/g;
export const ERR_META_SPACE_BEFORE = 'Unexpected text before "//" in ';
export const ERR_META_SPACE_INSIDE = 'Expected a single space after "//" in ';

/**
 * @param {string} code
 * @param {object} [opts]
 * @param {Array} [opts.errors] - to collect errors
 * @param {boolean} [opts.retDefault] - returns the default empty meta if no meta is found
 * @param {boolean} [opts.retMetaStr] - adds the matched part as [__CODE] prop in result
 * @return {VMScript['meta'] | false}
 */
export function parseMeta(code, { errors, retDefault, retMetaStr } = {}) {
  // initialize meta
  const meta = metaTypes::mapEntry(value => value.default());
  const block = matchScriptMetablock(code);
  if (!block) return retDefault ? meta : false;
  const { match, utility } = block;
  // TODO: use `null` instead of `false` + null check in all callers?
  if (errors) checkMetaItemErrors(match, 1, errors);
  let parts;
  while ((parts = META_ITEM_RE.exec(match[4]))) {
    const [keyName, locale] = parts[3].slice(1).split(':');
    const camelKey = keyName.replace(/[-_](\w)/g, (m, g) => g.toUpperCase());
    const key = locale ? `${camelKey}:${locale.toLowerCase()}` : camelKey;
    const val = parts[4].trim();
    const metaType = metaTypes[key] || metaOptionalTypes[key] || defaultMetaType;
    let oldValue = meta[key];
    if (typeof oldValue === 'undefined') oldValue = metaType.default();
    if (errors) checkMetaItemErrors(parts, 0, errors);
    meta[key] = metaType.transform(oldValue, val);
  }
  if (errors) checkMetaItemErrors(match, 5, errors);
  meta.resources = meta.resource;
  delete meta.resource;
  if (utility) meta[kUtilityScript] = true;
  if (retMetaStr) meta[__CODE] = match[0];
  return meta;
}

function checkMetaItemErrors(parts, index, errors) {
  let clipped;
  if (parts[index + 1].match(/\S/)) {
    errors.push(ERR_META_SPACE_BEFORE + (clipped = clipString(parts[index], 50)));
  }
  if (parts[index + 2] !== ' ') {
    errors.push(ERR_META_SPACE_INSIDE + (clipped || clipString(parts[index], 50)));
  }
}

function clipString(line, maxLen) {
  line = line.trim();
  return JSON.stringify(line.length > maxLen ? line.slice(0, maxLen) + '...' : line);
}

/**
 * @param {string | {code:string, custom:VMScript['custom']}} src
 * @return {{ meta: VMScript['meta'], errors: string[] | null }}
 */
export function parseMetaWithErrors(src) {
  const isObj = isObject(src);
  const custom = isObj && src.custom || getDefaultCustom();
  const errors = [];
  const meta = parseMeta(isObj ? src.code : src, { errors });
  if (meta) {
    if (meta[kUtilityScript]) {
      sanitizeUtilityMeta(meta);
    } else {
      if (meta.grant.includes('none') && new Set(meta.grant).size > 1) {
        errors.push(i18n('hintGrantNone'));
      }
      for (const ref of meta[kRequireUtility] || []) {
        if (!parseUtilityRequire(ref)) {
          errors.push(`Invalid @require-utility: ${ref}`);
        }
      }
      testerBatch(errors);
      testScript('', { meta, custom });
      testerBatch();
    }
  } else {
    errors.push(i18n('labelNoName')); // used by confirm app
  }
  return {
    meta,
    errors: errors.length ? errors : null,
  };
}

export function getDefaultCustom() {
  return {
    origInclude: true,
    origExclude: true,
    origMatch: true,
    origExcludeMatch: true,
    [kOrigTag]: true,
  };
}

function applyScriptTemplate(tpl, state) {
  return tpl.replace(/{{(\w+)(?::(.+?))?}}/g, (str, name, format) => state[name] ?? (
    name !== 'date' ? str
      : format ? formatDate(format)
        : new Date().toLocaleString()
  ));
}

/** @return {VMScript & { code?: string }} */
export function newScript(data) {
  const state = {
    url: GLOB_ALL,
    name: '',
    ...data,
  };
  const code = applyScriptTemplate(getOption(kScriptTemplate) || defaults[kScriptTemplate], state);
  const script = newScriptFromCode(code);
  if (data) script.code = code;
  return script;
}

/** @return {VMScript & { code?: string }} */
export function newUtilityScript(data) {
  const state = {
    name: '',
    ...data,
  };
  const code = applyScriptTemplate(
    getOption(kUtilityScriptTemplate) || defaults[kUtilityScriptTemplate],
    state,
  );
  const script = newScriptFromCode(code);
  script.config.shouldUpdate = 0;
  script.code = code;
  return script;
}

/** @return {VMScript} */
function newScriptFromCode(code) {
  return {
    custom: getDefaultCustom(),
    config: {
      enabled: 1,
      shouldUpdate: 1,
    },
    meta: parseMeta(code, { retDefault: true }),
    props: {},
  };
}

export function getNameURI(script) {
  const ns = script.meta.namespace || '';
  const name = script.meta.name || '';
  let nameURI = encodeFilename(`${ns}\n${name}\n`);
  if (!ns && !name) nameURI += script.props.id || '';
  return nameURI;
}

/**
 * @param {VMScript} script
 * @returns {string | undefined}
 */
function inferScriptHome(script) {
  let u = script.custom.lastInstallURL;
  if (u) {
    u = u.split('/', 6);
    switch (u[2]) {
    case 'update.greasyfork.org':
    case 'update.sleazyfork.org':
      u[2] = u[2].slice(7);
      // fallthrough
    case 'greasyfork.org':
    case 'sleazyfork.org':
      if (u[3] !== 'scripts') u.splice(3, 1);
      break;
    case 'raw.githubusercontent.com':
      u[2] = 'github.com';
      break;
    case 'github.com':
      break;
    case 'openuserjs.org':
      u[3] = 'scripts';
      u[4] = u[4].replace(/(\.min)?\.user\.js$/, '');
      break;
    default:
      u = false;
    }
    if (u) {
      u.length = 5; // scheme + 1 + host + group + name
      u = u.join('/');
    }
  }
  if (!u) {
    u = script.meta.namespace;
    u = /^https?:\/\/(?!tampermonkey\.net\/)/.test(u)
      && getFullUrl(u).replace(/^https?(:\/\/userscripts)(\.org\/users\/\w)/, 'https$1-mirror$2');
  }
  return u;
}

/**
 * @param {VMScript} script
 * @param {string} [home]
 * @returns {string | undefined}
 */
function inferScriptSupportUrl(script, home = getScriptHome(script)) {
  let u = home && home.match(regex('i')`
    ^https://(
      (
        (?<GF>greas|sleaz)yfork\.(org|cc)(/(?!scripts)[^\/]+)? |
        openuserjs\.org
      )(?=/scripts/) |
      github\.com
    )/[^\/]+/[^\/]+`);
  if (u) {
    return `${u[0]}/${u.groups.GF ? 'feedback' : 'issues'}`;
  }
}

/** @param {VMScript} script */
export function inferScriptProps(script) {
  const data = script[INFERRED] ??= {};
  const home = data[HOMEPAGE_URL] ??= getScriptHome(script) || inferScriptHome(script);
  data[SUPPORT_URL] ??= !getScriptSupportUrl(script) && inferScriptSupportUrl(script, home);
  data.visit = scriptSiteVisited[script.props.id];
}

/**
 * @param {VMInjection.Script[] | number[]} arr
 * @param {boolean} [isIds]
 */
export function updateVisitedTime(arr, isIds) {
  const now = Date.now();
  const toBroadcast = {};
  const toWrite = {};
  for (let v of arr) {
    if (!isIds) v = v.id;
    scriptSiteVisited[v] = toBroadcast[v] = toWrite[S_MOD_PRE + v] = now;
  }
  broadcast('Visited', toBroadcast);
  storage.api.set(toWrite);
}

/** `key` must be already verified to start with S_SCRIPT_PRE */
export function updateScriptMap(key, val) {
  if ((key = +key.slice(S_SCRIPT_PRE.length))) {
    if (val) {
      const oldScript = scriptMap[key];
      if (oldScript) {
        const i1 = aliveScripts.indexOf(oldScript);
        const i2 = removedScripts.indexOf(oldScript);
        if (i1 >= 0) aliveScripts[i1] = val;
        if (i2 >= 0) removedScripts[i2] = val;
        val[INFERRED] ??= oldScript[INFERRED];
      }
      scriptMap[key] = val;
    } else {
      delete scriptMap[key];
    }
    return true;
  }
}
