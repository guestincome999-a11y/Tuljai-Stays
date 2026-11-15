import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');

// Execute the real components with controllable native load/layout/animation events.
function component(file, imports) {
  const state = [];
  const refs = [];
  const dependencies = [];
  let cursor = 0;
  let effects = [];
  const frames = new Map();
  let frameId = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [
        state[index],
        (value) => {
          state[index] = value;
        },
      ];
    },
    useRef(initial) {
      const index = cursor++;
      return (refs[index] ??= { current: initial });
    },
    useCallback(callback) {
      cursor++;
      return callback;
    },
    useEffect(callback, deps) {
      const index = cursor++;
      if (!dependencies[index] || deps.some((value, i) => value !== dependencies[index][i])) {
        dependencies[index] = deps;
        effects.push(callback);
      }
    },
  };
  const jsx = (type, props) => ({ type, props });
  const scope = {
    exports: {},
    requestAnimationFrame(callback) {
      frames.set(++frameId, callback);
      return frameId;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
    console: { warn() {} },
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name in imports) return imports[name];
      if (name.endsWith('.png')) return name;
      if (name.endsWith('design-tokens.json')) return { colors: { maroon: {}, bell: {} } };
      throw new Error(`Unexpected import ${name}`);
    },
  };
  const source = readFileSync(new URL(`../src/components/${file}.tsx`, import.meta.url), 'utf8');
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText,
    scope,
  );
  const render = (props) => {
    cursor = 0;
    effects = [];
    const tree = scope.exports[file](props);
    effects.forEach((effect) => effect());
    return tree;
  };
  render.flushFrame = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((callback) => callback());
  };
  return render;
}

const styles = { create: (value) => value, absoluteFill: {} };
function find(tree, type) {
  if (!tree || typeof tree !== 'object') return null;
  if (tree.type === type) return tree;
  return [tree.props?.children]
    .flat()
    .map((child) => find(child, type))
    .find(Boolean);
}

function photographHasAnimatedOpacity(tree, inherited = false) {
  if (!tree || typeof tree !== 'object') return false;
  const styleValues = [tree.props?.style].flat().filter(Boolean);
  const animated =
    inherited || styleValues.some((style) => style.opacity !== undefined && style.opacity !== 1);
  if (tree.type === 'Image') return animated;
  return [tree.props?.children]
    .flat()
    .some((child) => photographHasAnimatedOpacity(child, animated));
}

test('native splash stays until both decode and layout, then animation completes', () => {
  for (const first of ['load', 'layout']) {
    let ready = 0;
    let completed = 0;
    let animation;
    const render = component('AnimatedWelcomeSplash', {
      '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
      'expo-status-bar': { StatusBar: 'StatusBar' },
      'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
      '../connectivity/connectivity-context': { useConnectivity: () => ({ isOffline: true }) },
      'react-native': {
        StyleSheet: styles,
        Image: 'Image',
        Text: 'Text',
        View: 'View',
        ActivityIndicator: 'Spinner',
        Animated: {
          View: 'AnimatedView',
          Text: 'AnimatedText',
          Value: class {},
          timing: () => ({
            start: (callback) => {
              animation = callback;
            },
            stop() {},
          }),
        },
      },
    });
    const props = { onReady: () => ready++, onEntranceComplete: () => completed++ };
    let tree = render(props);
    assert.equal(
      photographHasAnimatedOpacity(tree),
      false,
      'photograph must never start transparent',
    );
    assert.equal(ready, 0);
    find(tree, 'Image').props.onLayout({ nativeEvent: { layout: { width: 0, height: 0 } } });
    tree = render(props);
    assert.equal(ready, 0);
    if (first === 'load') find(tree, 'Image').props.onLoad();
    else
      find(tree, 'Image').props.onLayout({ nativeEvent: { layout: { width: 260, height: 320 } } });
    tree = render(props);
    assert.equal(ready, 0);
    assert.equal(animation, undefined);
    if (first === 'load')
      find(tree, 'Image').props.onLayout({ nativeEvent: { layout: { width: 260, height: 320 } } });
    else find(tree, 'Image').props.onLoad();
    render(props);
    assert.equal(ready, 1);
    assert.equal(animation, undefined);
    render.flushFrame();
    assert.equal(animation, undefined);
    render.flushFrame();
    assert.equal(completed, 0);
    animation({ finished: false });
    assert.equal(completed, 0);
    animation({ finished: true });
    assert.equal(completed, 1);
  }
});

test('fast auth cannot remove splash before image entrance; later auth changes do not remount it', () => {
  for (const fastAuth of [true, false]) {
    let bootstrapComplete = fastAuth;
    let holds = 0;
    let hides = 0;
    const render = component('StartupSplash', {
      'expo-splash-screen': {
        setOptions: (options) => assert.equal(options.duration, 0),
        preventAutoHideAsync: async () => {
          holds++;
        },
        hide: () => hides++,
      },
      'react-native': { View: 'View', StyleSheet: styles },
      '../auth/auth-context': { useAuth: () => ({ bootstrapComplete }) },
      './AnimatedWelcomeSplash': { AnimatedWelcomeSplash: 'Splash' },
    });
    const props = { children: 'route or deep link' };
    let tree = render(props);
    assert.equal(holds, 1);
    assert.equal(hides, 0);
    assert.ok(find(tree, 'Splash'));
    find(tree, 'Splash').props.onReady();
    assert.equal(hides, 1);
    find(tree, 'Splash').props.onEntranceComplete();
    tree = render(props);
    if (!fastAuth) assert.ok(find(tree, 'Splash'));
    bootstrapComplete = true;
    render(props);
    tree = render(props);
    assert.equal(find(tree, 'Splash'), undefined);
    assert.equal(tree.props.children[0], props.children);
    bootstrapComplete = false;
    assert.equal(find(render(props), 'Splash'), undefined);
  }
});

test('decode failure retries the bundled original and terminal failure cannot deadlock startup', () => {
  let ready = 0;
  const render = component('AnimatedWelcomeSplash', {
    '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '../connectivity/connectivity-context': { useConnectivity: () => ({ isOffline: true }) },
    'react-native': {
      StyleSheet: styles,
      Image: 'Image',
      Text: 'Text',
      View: 'View',
      ActivityIndicator: 'Spinner',
      Animated: {
        View: 'AnimatedView',
        Text: 'AnimatedText',
        Value: class {},
        timing: () => ({ start() {}, stop() {} }),
      },
    },
  });
  const props = { onReady: () => ready++, onEntranceComplete() {} };
  let tree = render(props);
  find(tree, 'Image').props.onLayout({ nativeEvent: { layout: { width: 260, height: 320 } } });
  find(tree, 'Image').props.onError({ nativeEvent: { error: 'decode failed' } });
  tree = render(props);
  assert.match(find(tree, 'Image').props.source, /splash-screen\.png$/);
  assert.equal(ready, 0);
  find(tree, 'Image').props.onError({ nativeEvent: { error: 'corrupt install' } });
  render(props);
  assert.equal(ready, 1);
});

test('original photograph and cutout remain byte-identical, standard bounded 8-bit PNGs', () => {
  const assets = [
    [
      'splash-screen.png',
      'c7855d3fd9a565548c0b97354cba42428d596b403666d255e9d2dbbb1565d62d',
      1070,
      1470,
    ],
    [
      'splash-goddess-cutout.png',
      'd615748c5412ccf6c3a7c959254feb05bb46f9c1ef68cb1f48b0a9f53738412b',
      873,
      1200,
    ],
  ];
  for (const [name, hash, width, height] of assets) {
    const data = readFileSync(new URL(`../assets/${name}`, import.meta.url));
    assert.equal(createHash('sha256').update(data).digest('hex'), hash);
    assert.equal(data.readUInt32BE(16), width);
    assert.equal(data.readUInt32BE(20), height);
    assert.equal(data[24], 8);
    assert.ok(width * height * 4 < 7 * 1024 * 1024);
  }
});
