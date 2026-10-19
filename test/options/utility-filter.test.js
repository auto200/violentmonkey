import { filterUtilityScripts } from '@/options/utils/utility-list';

test('filterUtilityScripts', () => {
  const scripts = [
    { meta: { utilityScript: true, name: 'u' } },
    { meta: { name: 's' } },
  ];
  expect(filterUtilityScripts(scripts, false)).toHaveLength(2);
  expect(filterUtilityScripts(scripts, true)).toEqual([scripts[0]]);
});
