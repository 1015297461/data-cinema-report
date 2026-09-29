#!/usr/bin/env node
/**
 * 报告主脚本的「运行时」检查器（严格模式）。
 *
 * 为什么需要它：node --check 只验证语法，正则自检只验证字符串存在性，
 * 两者都抓不到运行时错误 —— 例如 TDZ（Cannot access 'fpc' before
 * initialization）、容器 id 与配置 id 不匹配导致 mk() 静默 return、
 * series 数据为空等。这类问题会让脚本中断或图表空白，
 * 而 .reveal{opacity:0} 会让整页看起来是全白的。
 *
 * 用法：
 *   node runtime_check.js <主脚本文件> [dom配置.json]
 * dom配置.json 形如：{"ids":["ch1",...],"tables":["tblA"],"reveals":31}
 * 传入后启用严格模式：getElementById 只对真实存在的 id 返回元素，
 * 从而能发现「容器缺失」这类静默失败。
 */
const fs = require('fs');
const vm = require('vm');

const file = process.argv[2];
if (!file) {
  console.error('用法: node runtime_check.js <主脚本文件> [dom配置.json]');
  process.exit(2);
}
const src = fs.readFileSync(file, 'utf8');

const domCfgPath = process.argv[3];
let domCfg = null;
if (domCfgPath && fs.existsSync(domCfgPath)) {
  domCfg = JSON.parse(fs.readFileSync(domCfgPath, 'utf8'));
}
const idSet = domCfg ? new Set(domCfg.ids || []) : null;
const tableSet = domCfg ? new Set(domCfg.tables || []) : null;
// allIds：HTML 里实际存在的全部 id（含 cards / progress 等非图表容器），
// 用于严格模拟 getElementById —— 只有这些才返回元素
const allIdSet = domCfg ? new Set(domCfg.allIds || domCfg.ids || []) : null;

// ---------- DOM 桩 ----------
// reveal 元素池：静态（HTML 里的）+ 动态（innerHTML 注入的）
const revealPool = [];
let dynSeq = 0;
const staticRevealCount = domCfg ? (domCfg.reveals || 0) : 0;
for (let i = 0; i < staticRevealCount; i++) revealPool.push(mkEl('_reveal' + i));

function mkEl(id) {
  const el = {
    id,
    style: {},
    dataset: {},
    _html: '',
    textContent: '',
    children: [],
    _cls: new Set(),
    classList: {
      add: (c) => el._cls.add(c),
      remove: (c) => el._cls.delete(c),
      contains: (c) => el._cls.has(c),
      toggle: (c) => (el._cls.has(c) ? el._cls.delete(c) : el._cls.add(c)),
    },
    addEventListener() {},
    appendChild(c) { el.children.push(c); },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    setAttribute() {},
    getAttribute() { return null; },
    getBoundingClientRect() { return { width: 800, height: 420, top: 0, left: 0 }; },
  };
  // innerHTML setter：解析注入内容里的 .reveal 元素并投入元素池，
  // 这样就能检测「运行时动态插入的卡片是否被 IntersectionObserver 观察」
  Object.defineProperty(el, 'innerHTML', {
    get() { return el._html; },
    set(v) {
      el._html = String(v == null ? '' : v);
      const n = (el._html.match(/class="[^"]*\breveal\b[^"]*"/g) || []).length;
      for (let k = 0; k < n; k++) {
        const d = mkEl('_dyn' + (dynSeq++));
        d._dynamic = true;
        revealPool.push(d);
      }
    },
  });
  return el;
}
const els = new Map();
const getEl = (id) => {
  // 严格模式：真实 HTML 里不存在的 id，返回 null（真实浏览器行为）
  if (allIdSet && !allIdSet.has(id)) return null;
  if (!els.has(id)) els.set(id, mkEl(id));
  return els.get(id);
};

const stat = { init: 0, setOption: 0, emptySeries: [], shortSeries: [], observed: 0 };
const charts = {};
const missingEls = [];

const echarts = {
  init(el) {
    stat.init++;
    return {
      setOption(o) {
        stat.setOption++;
        charts[el.id] = o;
      },
      resize() {},
      on() {},
      dispose() {},
    };
  },
  graphic: {
    LinearGradient: function () { return {}; },
    RadialGradient: function () { return {}; },
  },
  registerTheme() {},
};

const dynCount = () => revealPool.filter((e) => e._dynamic).length;

const observedSet = new Set();

const sandbox = {
  document: {
    getElementById: getEl,
    querySelectorAll: (sel) => (sel && sel.indexOf('reveal') >= 0 ? revealPool : []),
    querySelector: () => null,
    createElement: (t) => mkEl('_' + t),
    documentElement: { scrollTop: 0, scrollHeight: 1000, clientHeight: 800 },
    addEventListener() {},
    body: mkEl('body'),
  },
  window: { addEventListener() {}, innerWidth: 1440, innerHeight: 900 },
  echarts,
  IntersectionObserver: class {
    constructor(cb) { this.cb = cb; }
    observe(el) { stat.observed++; observedSet.add(el); }
    unobserve() {}
    disconnect() {}
  },
  console: { log() {}, warn() {}, error() {} },
  Math, JSON, Object, Array, String, Number, Boolean, Date, RegExp, Error,
  TypeError, ReferenceError, isNaN, parseFloat, parseInt, Infinity, NaN, Set, Map,
  requestAnimationFrame: (f) => f(),
  setTimeout: () => 0,
};
sandbox.globalThis = sandbox;

let failed = false;
try {
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'report_main.js' });
} catch (e) {
  failed = true;
  console.error('❌ 运行时抛出异常：');
  console.error('   ' + e.name + ': ' + e.message);
  const m = e.stack && e.stack.match(/report_main\.js:(\d+):(\d+)/);
  if (m) {
    const lines = src.split('\n');
    const n = parseInt(m[1], 10);
    console.error('   出错位置：主脚本第 ' + n + ' 行');
    console.error('   ' + (lines[n - 1] || '').trim().slice(0, 160));
  }
}

// ---------- 结果统计 ----------
const declaredCharts = [...src.matchAll(/mk\('(ch\d+)'/g)].map((m) => m[1]);
const declaredTables = [...src.matchAll(/fillTable\('(\w+)'/g)].map((m) => m[1]);

// 图表是否真正 setOption
const notRendered = declaredCharts.filter((c) => !charts[c]);
if (idSet) {
  declaredCharts.forEach((c) => { if (!idSet.has(c)) missingEls.push(c); });
}

// 每个图表的 series 数据是否非空
Object.keys(charts).forEach((id) => {
  const opt = charts[id];
  const series = opt && opt.series;
  if (!series || !series.length) { stat.emptySeries.push(id); return; }
  series.forEach((s, i) => {
    const d = s && s.data;
    // 辅助 series：data 为空但挂了 markLine/markArea，只用于画参考线，合法
    const isAux = s && (s.markLine || s.markArea) && (!Array.isArray(d) || d.length === 0);
    if (isAux) return;
    if (!Array.isArray(d) || d.length === 0) {
      if (!stat.emptySeries.includes(id)) stat.emptySeries.push(id + '#' + i);
    } else if (d.length < 2) {
      stat.shortSeries.push(id + '#' + i + '(' + d.length + ')');
    }
  });
});

const emptyTables = declaredTables.filter((t) => getEl(t) && getEl(t).innerHTML === '');
const missingTables = tableSet ? declaredTables.filter((t) => !tableSet.has(t)) : [];

console.log('静态声明：图表 ' + declaredCharts.length + ' 个，表格 ' + declaredTables.length + ' 张' +
  (domCfg ? '，静态 reveal ' + staticRevealCount + ' 个 + 动态注入 ' + dynCount() + ' 个' : ''));
console.log('实际执行：echarts.init ' + stat.init + ' 次，setOption ' + stat.setOption + ' 次');
if (domCfg) console.log('IntersectionObserver 注册 ' + stat.observed + ' 个元素');

if (notRendered.length) {
  console.log('❌ 未渲染的图表：' + notRendered.join(', '));
  failed = true;
}
if (missingEls.length) {
  console.log('❌ HTML 中不存在这些图表容器：' + missingEls.join(', '));
  failed = true;
}
if (missingTables.length) {
  console.log('❌ HTML 中不存在这些表格容器：' + missingTables.join(', '));
  failed = true;
}
if (emptyTables.length) {
  console.log('❌ 未填充的表格：' + emptyTables.join(', '));
  failed = true;
}
if (stat.emptySeries.length) {
  console.log('❌ 这些图表没有数据：' + stat.emptySeries.join(', '));
  failed = true;
}
if (stat.shortSeries.length) {
  console.log('⚠️  数据点少于 2 的系列：' + stat.shortSeries.join(', '));
}
// 关键：动态注入的 .reveal（如结论卡组 #cards）若没被重新 observe，
// 会永远停在 opacity:0 —— 表现为「这一节数据缺失/空白」
const notObserved = revealPool.filter((e) => !observedSet.has(e));
if (domCfg && notObserved.length > 0) {
  const dynNot = notObserved.filter((e) => e._dynamic).length;
  console.log('❌ 有 ' + notObserved.length + ' 个 .reveal 元素未被 IntersectionObserver 观察'
    + (dynNot ? '，其中 ' + dynNot + ' 个为运行时动态注入（会永远 opacity:0，表现为「数据缺失/空白」）' : '')
    + ' —— 页面会因 .reveal{opacity:0} 而整体不可见');
  failed = true;
}

if (!failed) {
  console.log('✅ 运行时检查通过：'
    + stat.setOption + ' 个图表全部渲染，'
    + declaredTables.length + ' 张表格全部填充'
    + (domCfg ? '，' + revealPool.length + ' 个 reveal 元素（含 ' + dynCount() + ' 个动态注入）全部注册入场' : ''));
}
process.exit(failed ? 1 : 0);
