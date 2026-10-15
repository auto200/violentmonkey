import CodeMirror from 'codemirror';
import '@/common/ui/code-js-mixed-mode';

const gallery = `const o = {
  w: 4,
  foo: 1,
  async bar() {},
  async async() {},
  async() {},
  async: true,
  async,
  bar: 2
};
foo({
  bar: async () => {},
});
foo({
  bar: async ()
  => {},
});
async();
const async = o;
function async() {}
const g = {
  async * gen() {},
};
const a = {
  async first() {
  },
  async() {},
};
baz({ qux: async (x) => x });`;

function collectTokens(code, words) {
  const mode = CodeMirror.getMode({}, 'javascript-mixed');
  const state = CodeMirror.startState(mode);
  const out = [];
  let lineNo = 0;
  for (const line of code.split('\n')) {
    const stream = new CodeMirror.StringStream(line, 2, 2);
    while (!stream.eol()) {
      stream.start = stream.pos;
      const style = mode.token(stream, state);
      const text = line.slice(stream.start, stream.pos);
      if (words.includes(text)) {
        out.push({ line: lineNo, text, style, rest: line.slice(stream.pos, stream.pos + 8) });
      }
      if (!stream.pos) stream.pos++;
    }
    lineNo++;
  }
  return out;
}

test('gallery async/bar token styles', () => {
  const tokens = collectTokens(gallery, ['async', 'bar', 'foo', 'w']);
  expect(tokens).toMatchSnapshot();
  const style = (line, text) => tokens.find(t => t.line === line && t.text === text)?.style;
  // Core async-modifier fix (not CM5 variable vs property key coloring):
  expect(style(3, 'async')).toBe('keyword'); // async bar()
  const asyncOn4 = tokens.filter(t => t.line === 4 && t.text === 'async');
  expect(asyncOn4[0]?.style).toBe('keyword'); // modifier
  expect(asyncOn4[1]?.style).toBe('property'); // method name
  expect(style(5, 'async')).toBe('property'); // method named async
  expect(style(11, 'async')).toBe('keyword'); // bar: async () =>
  expect(style(14, 'async')).toBe('keyword'); // split =>
  expect(style(21, 'async')).toBe('keyword'); // async * gen
  expect(style(28, 'async')).toBe('keyword'); // qux: async (x) =>
  expect(style(26, 'async')).toBe('property'); // lone async() after multiline method + comma
});
