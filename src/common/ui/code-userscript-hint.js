import { UTILITY_META_HEADERS, USERSCRIPT_META_HEADERS } from '@/common/userscript-meta';

export const UTILITY_REQUIRE_REFS = 'utilityRequireRefs';

const META_BLOCKS = [
  {
    kind: 'user',
    openRe: /^\s*\/\/[\x20\t]*==UserScript==\s*$/,
    closeRe: /^\s*\/\/[\x20\t]*==\/UserScript==/,
    headers: USERSCRIPT_META_HEADERS,
  },
  {
    kind: 'utility',
    openRe: /^\s*\/\/[\x20\t]*==UtilityScript==\s*$/,
    closeRe: /^\s*\/\/[\x20\t]*==\/UtilityScript==/,
    headers: UTILITY_META_HEADERS,
  },
];

const META_HEADER_BEFORE_RE = /^\s*\/\/[\x20\t]@([\w-:]*)$/;
const META_REQUIRE_UTILITY_VALUE_RE = /^\s*\/\/[\x20\t]@require-utility[\x20\t]+(.*)$/i;
const META_REQUIRE_UTILITY_READY_RE = /^\s*\/\/[\x20\t]@require-utility[\x20\t]*$/i;

/**
 * @param {CodeMirror.Editor} cm
 * @param {number} maxLine
 * @param {RegExp} openRe
 * @returns {number}
 */
function getLastMetaOpenLine(cm, maxLine, openRe) {
  let openLine = -1;
  let lineNo = 0;
  cm.eachLine(0, maxLine + 1, ({ text }) => {
    if (openRe.test(text)) openLine = lineNo;
    lineNo++;
  });
  return openLine;
}

/**
 * @param {CodeMirror.Editor} cm
 * @param {number} line
 * @param {number} openLine
 * @param {RegExp} closeRe
 * @returns {boolean}
 */
function isCursorInsideMetaBlock(cm, line, openLine, closeRe) {
  if (openLine < 0 || line <= openLine) return false;
  let closeLine = -1;
  let lineNo = openLine + 1;
  cm.eachLine(openLine + 1, cm.lineCount(), ({ text }) => {
    if (closeLine < 0 && closeRe.test(text)) closeLine = lineNo;
    lineNo++;
  });
  return closeLine >= 0 && line < closeLine;
}

/**
 * @param {CodeMirror.Editor} cm
 * @param {CodeMirror.Pos} cursor
 * @returns {{ kind: string, headers: string[] } | null}
 */
function getActiveMetaBlock(cm, cursor) {
  const { line } = cursor;
  for (const block of META_BLOCKS) {
    const openLine = getLastMetaOpenLine(cm, line, block.openRe);
    if (isCursorInsideMetaBlock(cm, line, openLine, block.closeRe)) {
      return block;
    }
  }
  return null;
}

/**
 * @param {CodeMirror.Editor} cm
 * @param {CodeMirror.Pos} [cursor]
 * @returns {boolean}
 */
export function isInUserScriptMetaBlock(cm, cursor = cm.getCursor()) {
  return !!getActiveMetaBlock(cm, cursor);
}

/** @param {CodeMirror.Editor} cm */
export function isRequireUtilityValueContext(cm, cursor = cm.getCursor()) {
  const block = getActiveMetaBlock(cm, cursor);
  if (block?.kind !== 'user') return false;
  const before = cm.getLine(cursor.line).slice(0, cursor.ch);
  return META_REQUIRE_UTILITY_VALUE_RE.test(before)
    || META_REQUIRE_UTILITY_READY_RE.test(before);
}

/** @param {CodeMirror.Editor} cm */
export function getUserScriptMetaHint(cm) {
  const cur = cm.getCursor();
  const before = cm.getLine(cur.line).slice(0, cur.ch);
  const block = getActiveMetaBlock(cm, cur);
  if (!block) return;

  const utilValueMatch = block.kind === 'user' && before.match(META_REQUIRE_UTILITY_VALUE_RE);
  if (utilValueMatch) {
    const refs = cm.getOption(UTILITY_REQUIRE_REFS);
    const prefix = utilValueMatch[1];
    const list = (refs || []).filter(ref => ref.toLowerCase().startsWith(prefix.toLowerCase()));
    return {
      list,
      from: { line: cur.line, ch: cur.ch - prefix.length },
      to: cur,
    };
  }
  if (block.kind === 'user' && META_REQUIRE_UTILITY_READY_RE.test(before)) {
    const refs = cm.getOption(UTILITY_REQUIRE_REFS) || [];
    return {
      list: [...refs],
      from: cur,
      to: cur,
    };
  }

  const match = before.match(META_HEADER_BEFORE_RE);
  if (!match) return;

  const prefix = match[1].toLowerCase();
  const list = block.headers
    .filter(key => key.toLowerCase().startsWith(prefix))
    .map(key => `@${key}`);
  if (!list.length) return;
  return {
    list,
    from: { line: cur.line, ch: cur.ch - match[1].length - 1 },
    to: cur,
  };
}
