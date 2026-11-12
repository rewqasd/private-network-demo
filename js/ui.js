/* 通用 UI 片段 */
import { db, parseSrc, category } from './store.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const P = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const icon = {
  play: P('<path d="M7 5v14l11-7z" fill="currentColor" stroke="none"/>'),
  pause: P('<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/>'),
  prev: P('<path d="M15 18l-6-6 6-6"/>'),
  next: P('<path d="M9 18l6-6-6-6"/>'),
  replay: P('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'),
  full: P('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  exitFull: P('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'),
  presenter: P('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'),
  help: P('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01"/>'),
  menu: P('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  close: P('<path d="M6 6l12 12M18 6L6 18"/>'),
  arrow: P('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  doc: P('<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>'),
  fit: P('<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/>')
};

/** 资料出处标签 */
export function srcTags(ref) {
  return parseSrc(ref).map(s => {
    const title = s.doc ? `《${s.doc.title}》${s.loc ? ' ' + s.loc : ''}｜${s.doc.issuer}，${s.doc.date}` : s.id;
    return `<a class="src" href="#/sources?doc=${esc(s.id)}" title="${esc(title)}">${esc(s.id)}${s.loc ? ' ' + esc(s.loc) : ''}</a>`;
  }).join('');
}

export function scopeChip(p) {
  const map = { group: 'brand', province: 'security', legacy: 'outline', baseline: 'outline' };
  const label = db.scopes[p.scope]?.label || p.scope;
  return `<span class="chip ${map[p.scope] || ''}" title="${esc(p.scopeNote || '')}">${esc(label)}</span>`;
}

const CAT_TONE = { internet: 'flow', security: 'security', transport: 'hardpipe', networking: 'tunnel', service: 'ok' };
export function catChip(catId) {
  const c = category(catId);
  return c ? `<span class="chip ${CAT_TONE[catId] || ''}"><span class="dot"></span>${esc(c.name)}</span>` : '';
}
export const catTone = id => CAT_TONE[id] || '';

export function stBadge(st) {
  const m = { conflict: ['资料有差异', 'st-conflict'], regional: ['省内口径', 'st-regional'], old: ['早期资料', 'st-old'] };
  return m[st] ? `<span class="st-badge ${m[st][1]}">${m[st][0]}</span>` : '';
}

export function prodLink(id, cls = 'chip outline') {
  const p = db.prodMap.get(id);
  return p ? `<a class="${cls}" href="#/product/${esc(id)}">${esc(p.name)}</a>` : '';
}

export function toast(msg, ms = 1800) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

export function storage(key, val) {
  try {
    if (val === undefined) return JSON.parse(localStorage.getItem(`pnd4:${key}`) ?? 'null');
    localStorage.setItem(`pnd4:${key}`, JSON.stringify(val));
  } catch { /* 隐私模式等情况下忽略 */ }
  return null;
}

/** 点击后让按钮失焦，避免空格键被按钮“吞掉”而无法用于播放/暂停 */
export function blurOnPointer(root) {
  root.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b && e.detail > 0) b.blur();
  });
}
