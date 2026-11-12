/* 基于 hash 的路由：GitHub Pages 静态托管下刷新任意页面都不会 404 */
const table = [];

export function route(pattern, handler, meta = {}) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/\/:([^/]+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; }) + '/?$');
  table.push({ pattern, re, keys, handler, meta });
}

export function parseHash(hash = location.hash) {
  const raw = hash.replace(/^#/, '') || '/';
  const [p, q = ''] = raw.split('?');
  const path = p.startsWith('/') ? p : '/' + p;
  return { path, query: Object.fromEntries(new URLSearchParams(q)) };
}

export function match(path) {
  for (const r of table) {
    const m = path.match(r.re);
    if (m) return { ...r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}

export function go(path) {
  if (location.hash === '#' + path) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = path;
}

/** 只更新地址栏查询参数（不触发重新渲染），用于记录演示步骤，便于刷新与分享 */
export function setQuery(query) {
  const { path } = parseHash();
  const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();
  const url = `${location.pathname}${location.search}#${path}${qs ? '?' + qs : ''}`;
  history.replaceState(history.state, '', url);
}
