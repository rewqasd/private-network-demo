/* 讲师交互：快捷键、讲师模式、全屏、快捷键说明 */
import { icon, storage, toast } from './ui.js';

let ctx = () => ({});
export const setContext = fn => { ctx = fn; };

export function isPresenter() { return document.body.classList.contains('presenter'); }

export function setPresenter(on) {
  document.body.classList.toggle('presenter', on);
  if (!on) document.body.classList.remove('show-teacher');
  document.querySelectorAll('[data-act="presenter"]').forEach(b => b.setAttribute('aria-pressed', on));
  storage('presenter', on);
  toast(on ? '已进入讲师模式（P 退出）' : '已退出讲师模式');
}

export function toggleFullscreen() {
  const c = ctx();
  if (c.player) { c.player.fullscreen(); return; }
  const on = document.fullscreenElement || document.webkitFullscreenElement;
  if (on) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  else (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen)?.call(document.documentElement);
}

export function showHelp() {
  closeOverlay();
  const o = document.createElement('div');
  o.className = 'overlay';
  o.innerHTML = `<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="help-t">
    <h2 id="help-t">快捷键</h2>
    <div class="keys">
      <span><kbd>←</kbd> <kbd>→</kbd></span><span>演示：上一步 / 下一步；其他页面：切换同级页面</span>
      <span><kbd>PageUp</kbd> <kbd>PageDown</kbd></span><span>同上（兼容翻页笔）</span>
      <span><kbd>空格</kbd></span><span>自动播放 / 暂停</span>
      <span><kbd>R</kbd></span><span>重播当前演示</span>
      <span><kbd>1</kbd>–<kbd>9</kbd></span><span>跳到第 N 步</span>
      <span><kbd>Home</kbd> <kbd>End</kbd></span><span>第一步 / 最后一步</span>
      <span><kbd>[</kbd> <kbd>]</kbd></span><span>行业 / 技术主题页：上一个 / 下一个主题</span>
      <span><kbd>F</kbd></span><span>全屏（演示区）</span>
      <span><kbd>P</kbd></span><span>讲师模式</span>
      <span><kbd>T</kbd></span><span>讲师提示</span>
      <span><kbd>Esc</kbd></span><span>关闭弹层 / 说明；全屏时退出全屏</span>
      <span><kbd>?</kbd></span><span>显示本说明</span>
    </div>
    <p class="muted" style="margin-top:14px;font-size:13px">在输入框中打字时快捷键不生效。</p>
    <div style="margin-top:16px;text-align:right"><button class="btn" data-close>关闭</button></div></div>`;
  o.addEventListener('click', e => { if (e.target === o || e.target.closest('[data-close]')) closeOverlay(); });
  document.body.appendChild(o);
  o.querySelector('[data-close]').focus();
}

export function closeOverlay() {
  const o = document.querySelector('.overlay');
  if (o) { o.remove(); return true; }
  return false;
}

export function setupInteraction() {
  if (storage('presenter')) document.body.classList.add('presenter');
  document.addEventListener('pnd:presenter', () => setPresenter(!isPresenter()));
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    const t = e.target;
    if (t.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
    const onControl = t.closest?.('button, a[href], summary, [role="button"], [role="tab"]');
    const c = ctx();
    const p = c.player;
    const k = e.key;
    if (document.querySelector('.overlay')) {
      if (k === 'Escape') { e.preventDefault(); closeOverlay(); }
      return;
    }
    const nav = (dir) => {
      if (p) (dir < 0 ? p.prev : p.next)();
      else if (c.keys) (dir < 0 ? c.keys.prev : c.keys.next)?.();
    };
    switch (k) {
      case 'ArrowRight': case 'PageDown': e.preventDefault(); nav(1); break;
      case 'ArrowLeft': case 'PageUp': e.preventDefault(); nav(-1); break;
      case ' ': case 'Spacebar':
        if (onControl) return;
        if (p) { e.preventDefault(); p.toggle(); }
        break;
      case 'Home': if (p) { e.preventDefault(); p.first(); } break;
      case 'End': if (p) { e.preventDefault(); p.last(); } break;
      case 'r': case 'R': if (p) { e.preventDefault(); p.replay(); } break;
      case 'f': case 'F': e.preventDefault(); toggleFullscreen(); break;
      case 'p': case 'P': e.preventDefault(); setPresenter(!isPresenter()); break;
      case 't': case 'T': if (p) { e.preventDefault(); p.toggleTeacher(); } break;
      case '[': if (c.keysAlt) { e.preventDefault(); c.keysAlt.prev(); } break;
      case ']': if (c.keysAlt) { e.preventDefault(); c.keysAlt.next(); } break;
      case '?': e.preventDefault(); showHelp(); break;
      case 'Escape':
        if (p?.closeInfo()) { e.preventDefault(); break; }
        if (document.querySelector('.nav.open')) { document.querySelector('.nav').classList.remove('open'); break; }
        if (isPresenter() && !document.fullscreenElement) setPresenter(false);
        break;
      default:
        if (/^[1-9]$/.test(k) && p) { e.preventDefault(); p.go(Number(k) - 1); }
    }
  });
}

export { icon };
