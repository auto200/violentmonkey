import CodeMirror from 'codemirror';
import '@/common/ui/code-js-mixed-mode';

const gallery = `const obj = {
  // plain property keys
  width: 4,
  label: 1,

  // modifier, then the method name
  async bar() {},
  // modifier, then a method named async
  async async() {},
  // method named async
  async() {},

  // key, shorthand, and the following key
  async: true,
  async,
  bar: 2
};

// arrow in an object
fn({
  bar: async () => {},
});
// arrow whose => is on the next line
fn({
  bar: async ()
  => {},
});
// call
async();
// const binding
const async = obj;
// function declaration
function async() {}
// async generator method
const generators = {
  async * gen() {},
};
// method named async after a multiline method
const afterMultiline = {
  async first() {
  },
  async() {},
};
// arrow with a parameter
fn({ key: async (x) => x });`;

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
  const tokens = collectTokens(gallery, ['async', 'bar', 'label', 'width', 'fn']);
  expect(tokens).toMatchSnapshot();
  const style = (line, text) => tokens.find(t => t.line === line && t.text === text)?.style;
  expect(style(6, 'async')).toBe('keyword'); // async bar()
  expect(style(13, 'async')).toBe('property'); // key after CM5 loses objprop
  expect(style(14, 'async')).toBe('property'); // shorthand
  expect(style(15, 'bar')).toBe('property');
  const asyncModifierAndName = tokens.filter(t => t.line === 8 && t.text === 'async');
  expect(asyncModifierAndName[0]?.style).toBe('keyword'); // modifier
  expect(asyncModifierAndName[1]?.style).toBe('property'); // method name
  expect(style(10, 'async')).toBe('property'); // method named async
  expect(style(20, 'async')).toBe('keyword'); // bar: async () =>
  expect(style(24, 'async')).toBe('keyword'); // split =>
  expect(style(35, 'async')).toBe('keyword'); // async * gen
  expect(style(44, 'async')).toBe('keyword'); // key: async (x) =>
  expect(style(41, 'async')).toBe('property'); // lone async() after multiline method + comma
  expect(style(28, 'async')).toBe('variable'); // async();
  expect(style(32, 'async')).toBe('def'); // function async() {}
});
