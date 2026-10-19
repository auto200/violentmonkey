import { isUtilityScript } from '@/common/utility-meta';
import { parseMetaWithErrors } from '@/background/utils/script';

const utilityCode = `\
// ==UtilityScript==
// @name        My lib
// @namespace   UtilityScripts
// @version     1.0.0
// @match       *://*/*
// @grant       GM_xmlhttpRequest
// ==/UtilityScript==

export const x = 1;
`;

test('parseMetaWithErrors strips utility meta', () => {
  const { meta, errors } = parseMetaWithErrors({ code: utilityCode, custom: {} });
  expect(errors).toBeNull();
  expect(meta.utilityScript).toBe(true);
  expect(meta.match).toEqual([]);
  expect(meta.grant).toEqual([]);
});

test('isUtilityScript', () => {
  expect(isUtilityScript({ utilityScript: true })).toBe(true);
  expect(isUtilityScript({ utilityScript: false })).toBe(false);
  expect(isUtilityScript({})).toBe(false);
});

test('parseMetaWithErrors normal script still validates match', () => {
  const { errors } = parseMetaWithErrors({ code: `\
// ==UserScript==
// @name foo
// @match *://*/*
// ==/UserScript==
`, custom: {} });
  expect(errors).toBeNull();
});
