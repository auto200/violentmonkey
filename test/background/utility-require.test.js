import {
  parseUtilityRequire, utilityRequireKey, isUtilityRequireKey, utilityRequireRefFromKey,
} from '@/common/utility-require';
import {
  findUtilityScript, findUtilityScriptForEdit, findUtilityScriptForEditByRef,
  resolveUtilityRequire,
} from '@/background/utils/utility-require';
import { aliveScripts } from '@/background/utils/script';

jest.mock('@/background/utils/storage', () => ({
  __esModule: true,
  default: {
    code: {
      getOne: jest.fn(async id => (id === 42
        ? '// ==UtilityScript==\n// @name x\n// ==/UtilityScript==\n\nbody'
        : null)),
    },
  },
  S_CODE: 'code',
}));

test('parseUtilityRequire', () => {
  expect(parseUtilityRequire('UtilityScripts/My lib')).toEqual({
    namespace: 'UtilityScripts',
    name: 'My lib',
  });
  expect(parseUtilityRequire('bad')).toBeNull();
  expect(parseUtilityRequire('Ns/a/b')).toEqual({
    namespace: 'Ns',
    name: 'a/b',
  });
});

test('utilityRequireKey', () => {
  expect(utilityRequireKey('UtilityScripts/util')).toBe('utility:UtilityScripts/util');
  expect(isUtilityRequireKey('utility:UtilityScripts/util')).toBe(true);
  expect(utilityRequireRefFromKey('utility:UtilityScripts/util')).toBe('UtilityScripts/util');
});

test('findUtilityScriptForEditByRef', () => {
  const util = {
    config: { enabled: 1, removed: 0 },
    meta: {
      utilityScript: true,
      namespace: 'UtilityScripts',
      name: 'My lib',
    },
    props: { id: 42 },
  };
  aliveScripts.push(util);
  try {
    expect(findUtilityScriptForEditByRef('UtilityScripts/My lib')).toBe(util);
    expect(findUtilityScriptForEditByRef('UtilityScripts/Other')).toBeUndefined();
  } finally {
    aliveScripts.pop();
  }
});

test('findUtilityScriptForEdit includes disabled utilities', () => {
  const util = {
    config: { enabled: 0, removed: 0 },
    meta: {
      utilityScript: true,
      namespace: 'UtilityScripts',
      name: 'OffLib',
    },
    props: { id: 44 },
  };
  aliveScripts.push(util);
  try {
    expect(findUtilityScript({ namespace: 'UtilityScripts', name: 'OffLib' })).toBeUndefined();
    expect(findUtilityScriptForEdit({ namespace: 'UtilityScripts', name: 'OffLib' })).toBe(util);
    util.config.removed = 1;
    expect(findUtilityScriptForEdit({ namespace: 'UtilityScripts', name: 'OffLib' })).toBeUndefined();
  } finally {
    aliveScripts.pop();
  }
});

test('resolveUtilityRequire strips metablock', async () => {
  const util = {
    config: { enabled: 1, removed: 0 },
    meta: { utilityScript: true, namespace: 'UtilityScripts', name: 'Lib' },
    props: { id: 42 },
  };
  aliveScripts.push(util);
  try {
    await expect(resolveUtilityRequire('UtilityScripts/Lib')).resolves.toBe('body');
  } finally {
    aliveScripts.pop();
  }
});
