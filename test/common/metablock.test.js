import { matchScriptMetablock, stripScriptMetablock } from '@/common/metablock';

test('matchScriptMetablock UtilityScript', () => {
  const code = `\
// ==UtilityScript==
// @name lib
// ==/UtilityScript==
body`;
  const block = matchScriptMetablock(code);
  expect(block?.utility).toBe(true);
  expect(block?.match[0]).toMatch(/UtilityScript/);
});

test('matchScriptMetablock UserScript', () => {
  const code = `\
// ==UserScript==
// @name x
// ==/UserScript==
`;
  const block = matchScriptMetablock(code);
  expect(block?.utility).toBe(false);
});

test('stripScriptMetablock', () => {
  const code = `\
// ==UtilityScript==
// @name lib
// ==/UtilityScript==
export const x = 1;`;
  expect(stripScriptMetablock(code).trim()).toBe('export const x = 1;');
});
