/* 应用入口：加载数据 → 注册路由 → 渲染 */
import { loadData, db, VERSION } from './store.js';
import { route, parseHash, match } from './router.js';
import { setupInteraction, setContext, setPresenter, isPresenter, toggleFullscreen, showHelp } from './interaction.js';
import { esc, icon } from './ui.js';
import * as home from './views/home.js';
import * as products from './views/products.js';
import * as demos from './views/demos.js';
import * as network from './views/network.js';
import * as industries from './views/industries.js';
import * as compare from './views/compare.js';
import * as sales from './views/sales.js';
import * as quiz from './views/quiz.js';
import * as sources from './views/sources.js';

const NAV = [
  ['/', '产品全景', 'home'], ['/products', '产品中心', 'products'], ['/demos', '动态演示', 'demos'], ['/network', '网络技术', 'network'],
  ['/industries', '行业方案', 'industries'], ['/compare', '产品对比', 'compare'], ['/sales', '营销实战', 'sales'], ['/quiz', '课堂互动', 'quiz']
];

route('/', home.render, { nav: 'home', title: '产品全景' });
route('/products', products.renderList, { nav: 'products', title: '产品中心' });
route('/product/:id', products.renderDetail, { nav: 'products' });
route('/demos', demos.renderList, { nav: 'demos', title: '动态演示' });
route('/demo/:id', demos.renderDemo, { nav: 'demos' });
route('/network', network.render, { nav: 'network' });
route('/network/:topic', network.render, { nav: 'network' });
route('/industries', industries.renderList, { nav: 'industries', title: '行业方案' });
route('/industry/:id', industries.renderDetail, { nav: 'industries' });
route('/compare', compare.render, { nav: 'compare', title: '产品对比' });
route('/sales', sales.render, { nav: 'sales', title: '营销实战' });
route('/quiz', quiz.render, { nav: 'quiz', title: '课堂互动' });
route('/sources', sources.render, { nav: '', title: '资料口径' });

const view = document.getElementById('view');
let current = null;
let lastPath = null;

function shell() {
  const nav = document.getElementById('nav');
  nav.innerHTML = NAV.map(([href, label, key]) => `<a href="#${href}" data-nav="${key}">${label}</a>`).join('');
  document.getElementById('tools').innerHTML = `
    <a class="btn ghost sm hide-sm" href="#/sources" title="资料来源与口径">${icon.doc}<span>资料口径</span></a>
    <button class="btn ghost icon sm" data-act="presenter" aria-pressed="${isPresenter()}" title="讲师模式（P）" aria-label="讲师模式">${icon.presenter}</button>
    <button class="btn ghost icon sm" data-act="fullscreen" title="全屏（F）" aria-label="全屏">${icon.full}</button>
    <button class="btn ghost icon sm hide-sm" data-act="help" title="快捷键（?）" aria-label="快捷键说明">${icon.help}</button>
    <button class="btn ghost icon sm menu-btn" data-act="menu" aria-label="打开导航" aria-expanded="false">${icon.menu}</button>`;
  document.querySelector('.app-header').addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (b) {
      if (b.dataset.act === 'presenter') setPresenter(!isPresenter());
      if (b.dataset.act === 'fullscreen') toggleFullscreen();
      if (b.dataset.act === 'help') showHelp();
      if (b.dataset.act === 'menu') { const open = nav.classList.toggle('open'); b.setAttribute('aria-expanded', open); }
      if (e.detail > 0) b.blur();
    }
    if (e.target.closest('#nav a')) nav.classList.remove('open');
  });
  document.getElementById('foot').innerHTML = `<span>中国联通政企专线产品动态演示平台 V${esc(db.meta.version)} · 数据版本 ${esc(db.meta.released)} · 内部培训演示，产品口径以资料原件与最新正式文件为准</span>
    <span><a href="#/sources">资料来源与待确认事项</a> · <a href="v3/">V3 历史版本</a></span>`;
}

function render() {
  const { path, query } = parseHash();
  const m = match(path);
  if (current?.destroy) { try { current.destroy(); } catch (e) { console.error(e); } }
  current = null;
  document.querySelectorAll('#nav a').forEach(a => a.toggleAttribute('aria-current', false));
  if (m?.meta.nav) document.querySelector(`#nav a[data-nav="${m.meta.nav}"]`)?.setAttribute('aria-current', 'page');
  if (!m) {
    view.innerHTML = `<div class="page"><div class="empty"><h1>页面不存在</h1><p style="margin-top:10px"><a href="#/">返回产品全景</a></p></div></div>`;
    document.title = '页面不存在 · 政企专线产品动态演示';
    return;
  }
  try {
    current = m.handler(view, { params: m.params, query }) || {};
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="page"><div class="empty">页面渲染出错：${esc(e.message)}</div></div>`;
    current = {};
  }
  const title = current.title || m.meta.title || '';
  document.title = `${title ? title + ' · ' : ''}政企专线产品动态演示 V4`;
  if (path !== lastPath) window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  lastPath = path;
  setContext(() => ({ player: current?.player || null, keys: current?.keys, keysAlt: current?.keysAlt }));
  view.focus({ preventScroll: true });
  document.documentElement.dataset.route = path;
}

async function boot() {
  try {
    const [icons] = await Promise.all([fetch(`svg/icons.svg?v=${VERSION}`).then(r => r.text()), loadData()]);
    const holder = document.createElement('div');
    holder.innerHTML = icons;
    document.body.prepend(holder.firstElementChild);
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="page"><div class="card"><h1>数据加载失败</h1><p style="margin-top:10px">${esc(e.message)}</p>
      <p class="muted" style="margin-top:10px">本平台通过 HTTP 读取 data/*.json。请使用线上地址访问，或在项目目录运行 <code>node tests/serve.mjs</code> 后打开 http://localhost:8080/ 。</p></div></div>`;
    return;
  }
  shell();
  setupInteraction();
  window.addEventListener('hashchange', render);
  render();
  document.documentElement.dataset.ready = 'true';
}

boot();
