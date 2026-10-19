import defaults, { kUtilityScriptTemplate } from '@/common/options-defaults';
import {
  ERR_META_SPACE_INSIDE,
  applyUtilityScriptRules,
  newUtilityScript,
  parseMeta,
  sanitizeUtilityCustom,
  sanitizeUtilityMeta,
  sanitizeUtilityMetablock,
  validateUtilityTemplate,
} from '@/background/utils/script';

const baseMeta = {
  include: [],
  exclude: [],
  match: [],
  excludeMatch: [],
  require: [],
  requireUtility: [],
  grant: [],
  resources: {},
};

test('parseMeta', () => {
  expect(parseMeta(`\
// ==UserScript==
// @name New Script
// @namespace Violentmonkey Scripts
// @description This is a script
// @version 1.0
// @match *://*/*
// @grant none
// ==/UserScript==
`)).toEqual(Object.assign({}, baseMeta, {
    name: 'New Script',
    namespace: 'Violentmonkey Scripts',
    description: 'This is a script',
    version: '1.0',
    match: ['*://*/*'],
    grant: ['none'],
  }));
  expect(parseMeta(`\
// ==UserScript==
// @name New Script
// @namespace Violentmonkey Scripts
// @match *://*/*
// @noframes
// ==/UserScript==
`)).toEqual(Object.assign({}, baseMeta, {
    name: 'New Script',
    namespace: 'Violentmonkey Scripts',
    match: ['*://*/*'],
    noframes: true,
  }));
});

test('parseMetaIrregularities', () => {
  const baseMetaFoo = {
    ...baseMeta,
    name: 'foo',
  };
  const parseWeirdMeta = code => {
    const errors = [];
    const res = parseMeta(code, { errors });
    return errors.length ? [res, ...errors] : res;
  };
  expect(parseWeirdMeta(`\
  // ==UserScript==============
// @name foo
 // @namespace bar
// ==/UserScript===================
  `)).toEqual({
    ...baseMetaFoo,
    namespace: 'bar',
  });
  expect(parseWeirdMeta(`\
// ==UserScript==
//@name foo
// ==/UserScript==`)).toEqual([baseMetaFoo,
    ERR_META_SPACE_INSIDE + `"//@name foo"`,
  ]);
  expect(parseWeirdMeta(`\
//==UserScript==
// @name foo
//\t==/UserScript==`)).toEqual([baseMetaFoo,
    ERR_META_SPACE_INSIDE + `"//==UserScript=="`,
    ERR_META_SPACE_INSIDE + String.raw`"//\t==/UserScript=="`,
  ]);
  expect(parseWeirdMeta(`\
/*
//
  ==UserScript==
// @name foo
//
==/UserScript==
*/`)).toBeFalsy();
});

const utilityMetaBlock = `\
// ==UtilityScript==
// @name        My lib
// @namespace   UtilityScripts
// @version     1.0.0
//
// @description A library
// ==/UtilityScript==
`;

test('parseMeta require-utility', () => {
  expect(parseMeta(`\
// ==UserScript==
// @name Consumer
// @namespace Violentmonkey Scripts
// @require-utility UtilityScripts/util
// @match *://*/*
// ==/UserScript==
`)).toEqual(Object.assign({}, baseMeta, {
    name: 'Consumer',
    namespace: 'Violentmonkey Scripts',
    match: ['*://*/*'],
    requireUtility: ['UtilityScripts/util'],
  }));
});

test('parseMeta UtilityScript block', () => {
  expect(parseMeta(utilityMetaBlock)).toEqual(Object.assign({}, baseMeta, {
    name: 'My lib',
    namespace: 'UtilityScripts',
    utilityScript: true,
    version: '1.0.0',
    description: 'A library',
  }));
});

test('sanitizeUtilityMeta', () => {
  const meta = parseMeta(`\
// ==UtilityScript==
// @name        My lib
// @namespace   UtilityScripts
// @version     1.0.0
// @description A library
// @match *://*/*
// @grant GM_xmlhttpRequest
// @require https://example.com/lib.js
// @top-level-await
// ==/UtilityScript==
`, { retDefault: true });
  sanitizeUtilityMeta(meta);
  expect(meta).toMatchObject({
    name: 'My lib',
    namespace: 'UtilityScripts',
    utilityScript: true,
    version: '1.0.0',
    description: 'A library',
  });
  expect(meta.match).toEqual([]);
  expect(meta.grant).toEqual([]);
  expect(meta.require).toEqual([]);
  expect(meta.topLevelAwait).toBe(false);
  expect(meta.connect).toEqual([]);
});

test('sanitizeUtilityMetablock', () => {
  const body = '\nexport const x = 1;\n';
  const code = `\
// ==UtilityScript==
// @name        My lib
// @namespace   UtilityScripts
// @version     1.0.0
// @description A library
// @match *://*/*
// @grant none
// ==/UtilityScript==${body}`;
  const out = sanitizeUtilityMetablock(code);
  expect(out).not.toMatch(/@match|@grant/);
  expect(out).toMatch(/==UtilityScript==/);
  expect(out.endsWith(body)).toBe(true);
});

test('sanitizeUtilityMetablock non-utility unchanged', () => {
  const code = `\
// ==UserScript==
// @name foo
// @match *://*/*
// ==/UserScript==
`;
  expect(sanitizeUtilityMetablock(code)).toBe(code);
});

test('default utility template', () => {
  const meta = parseMeta(defaults[kUtilityScriptTemplate], { retDefault: true });
  expect(meta.utilityScript).toBe(true);
  expect(meta.match).toEqual([]);
  expect(meta.namespace).toBe('UtilityScripts');
});

test('newUtilityScript', () => {
  const { meta, config, code } = newUtilityScript();
  expect(meta.utilityScript).toBe(true);
  expect(meta.match).toEqual([]);
  expect(config.shouldUpdate).toBe(0);
  expect(code).toMatch(/==UtilityScript==/);
});

test('applyUtilityScriptRules', () => {
  const meta = parseMeta(utilityMetaBlock, { retDefault: true });
  meta.utilityScript = true;
  const custom = { match: ['*://*/*'], origMatch: false };
  const code = `\
// ==UtilityScript==
// @name        My lib
// @namespace   UtilityScripts
// @version     1.0.0
// @description A library
// @match *://*/*
// @grant none
// ==/UtilityScript==
body();`;
  const out = applyUtilityScriptRules(meta, custom, code);
  expect(meta.match).toEqual([]);
  expect(custom.match).toBeUndefined();
  expect(out).not.toMatch(/@match/);
  expect(out).toMatch(/body\(\)/);
});

test('validateUtilityTemplate', () => {
  expect(() => validateUtilityTemplate(defaults[kUtilityScriptTemplate])).not.toThrow();
  expect(() => validateUtilityTemplate(`\
// ==UserScript==
// @name x
// ==/UserScript==
`)).toThrow();
});

test('sanitizeUtilityCustom', () => {
  const custom = {
    match: ['*://*/*'],
    include: ['foo'],
    runAt: 'document-start',
    injectInto: PAGE,
    pathMap: { a: 1 },
    origMatch: false,
  };
  sanitizeUtilityCustom(custom);
  expect(custom.match).toBeUndefined();
  expect(custom.include).toBeUndefined();
  expect(custom.runAt).toBeUndefined();
  expect(custom.injectInto).toBeUndefined();
  expect(custom.pathMap).toBeUndefined();
  expect(custom.origMatch).toBe(true);
});
