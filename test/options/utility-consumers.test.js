import {
  buildUtilityToUserScriptWarningMessage,
  findUtilityConsumers, listUtilityRequireRefs, utilityMetaFromRequireRef,
} from '@/common/utility-consumers';
import {
  formatUtilityRequireRef, utilityMetaMatchesRequireRef,
} from '@/common/utility-require';

test('utilityMetaMatchesRequireRef', () => {
  const meta = { namespace: 'UtilityScripts', name: 'My lib' };
  expect(utilityMetaMatchesRequireRef(meta, 'UtilityScripts/My lib')).toBe(true);
  expect(utilityMetaMatchesRequireRef(meta, 'UtilityScripts/Other')).toBe(false);
  expect(utilityMetaMatchesRequireRef(meta, 'bad')).toBe(false);
});

test('formatUtilityRequireRef', () => {
  expect(formatUtilityRequireRef({ namespace: 'Ns', name: 'n' })).toBe('Ns/n');
  expect(formatUtilityRequireRef({ namespace: '', name: 'n' })).toBe(null);
});

test('utilityMetaFromRequireRef', () => {
  expect(utilityMetaFromRequireRef('Ns/n')).toMatchObject({
    utilityScript: true,
    namespace: 'Ns',
    name: 'n',
  });
});

test('listUtilityRequireRefs', () => {
  const scripts = [
    {
      props: { id: 1 },
      config: { removed: false },
      meta: { utilityScript: true, namespace: 'B', name: 'b' },
    },
    {
      props: { id: 2 },
      config: { removed: true },
      meta: { utilityScript: true, namespace: 'X', name: 'x' },
    },
    {
      props: { id: 3 },
      config: { removed: false },
      meta: { utilityScript: true, namespace: 'A', name: 'a' },
    },
    {
      props: { id: 4 },
      config: { removed: false },
      meta: { name: 'user' },
    },
  ];
  expect(listUtilityRequireRefs(scripts)).toEqual(['A/a', 'B/b']);
});

test('buildUtilityToUserScriptWarningMessage', () => {
  const meta = { utilityScript: true, namespace: 'UtilityScripts', name: 'Lib' };
  const msg = buildUtilityToUserScriptWarningMessage(
    meta,
    [{ meta: { name: 'Consumer' } }],
    s => s.meta.name,
  );
  expect(msg).toMatch(/@require-utility UtilityScripts\/Lib/);
  expect(msg).toMatch(/Consumer/);
  expect(msg).toMatch(/no longer be available/);
});

test('findUtilityConsumers', () => {
  const utilityMeta = { utilityScript: true, namespace: 'UtilityScripts', name: 'Lib' };
  const consumer = {
    props: { id: 2 },
    config: { removed: false },
    meta: { requireUtility: ['UtilityScripts/Lib'], name: 'C' },
  };
  const other = {
    props: { id: 3 },
    config: { removed: false },
    meta: { requireUtility: ['UtilityScripts/Other'], name: 'O' },
  };
  const utility = {
    props: { id: 1 },
    config: { removed: false },
    meta: utilityMeta,
  };
  const scripts = [utility, consumer, other];
  expect(findUtilityConsumers(scripts, utilityMeta, { excludeId: 1 })).toEqual([consumer]);
});
