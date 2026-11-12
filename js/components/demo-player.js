/*
 * 演示播放器组件：拓扑舞台 + 控制条 + 讲解侧栏。
 * 支持：开始/暂停、重播、上一步/下一步、步骤跳转、速度、场景切换、节点点击说明、流量路径高亮、讲师提示、全屏。
 */
import { TopologyStage } from '../topology/engine.js';
import { Player } from '../topology/player.js';
import { db, product } from '../store.js';
import { esc, icon, srcTags, prodLink, blurOnPointer } from '../ui.js';

const FLOW_LABEL = { data: '业务流量', video: '视频流量', attack: '攻击流量', clean: '清洗后流量', backup: '保护路由流量', tunnel: '隧道 / 组网流量', cloud: '上云流量', control: '管控信令', security: '安全保障' };
const FLOW_COLOR = { data: 'var(--flow)', video: 'var(--flow)', attack: 'var(--fault)', clean: 'var(--ok)', backup: 'var(--ok)', tunnel: 'var(--tunnel)', cloud: 'var(--tunnel)', control: 'var(--control)', security: 'var(--security)' };
const SPEEDS = [0.5, 1, 1.5, 2];
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

let activePlayer = null;
export const getActivePlayer = () => activePlayer;

export function mountPlayer(host, demo, opts = {}) {
  const mode = opts.mode || 'full';
  const H = opts.headingTag || 'h2';
  const el = document.createElement('section');
  el.className = `player ${mode === 'compact' ? 'compact' : ''}`;
  el.setAttribute('aria-label', `${demo.title} 动态演示`);
  const sceneTabs = demo.scenes.length > 1
    ? `<div class="tabs" role="tablist" aria-label="场景切换">${demo.scenes.map(s => `<button role="tab" data-scene="${esc(s.id)}">${esc(s.title)}</button>`).join('')}</div>`
    : '';
  const prodChips = (demo.products || []).map(id => prodLink(id)).join('');
  el.innerHTML = `
    ${opts.showHead === false ? '' : `<header class="player-head">
      <div>
        ${opts.eyebrow ? `<div class="eyebrow">${esc(opts.eyebrow)}</div>` : ''}
        <${H}>${esc(demo.title)}</${H}>
        <p class="player-sub">${esc(demo.summary || '')}</p>
      </div>
      ${sceneTabs}
    </header>`}
    <div class="player-body">
      <div class="player-main">
        <div class="stage-wrap">
          <div class="stage"></div>
          <div class="stage-hint">← 左右滑动查看完整拓扑，或点“适配屏宽” →</div>
        </div>
        <div class="controls" role="group" aria-label="演示控制">
          <button class="btn icon" data-act="replay" title="重播（R）" aria-label="重播">${icon.replay}</button>
          <button class="btn icon" data-act="prev" title="上一步（←）" aria-label="上一步">${icon.prev}</button>
          <button class="btn primary play" data-act="toggle" title="播放 / 暂停（空格）">${icon.play}<span>自动播放</span></button>
          <button class="btn icon" data-act="next" title="下一步（→）" aria-label="下一步">${icon.next}</button>
          <span class="sep"></span>
          <div class="dots" aria-label="步骤"></div>
          <span class="grow"></span>
          <div class="speed" role="group" aria-label="播放速度">${SPEEDS.map(s => `<button data-speed="${s}" aria-pressed="${s === 1}">${s}×</button>`).join('')}</div>
          <button class="btn icon fit-btn" data-act="fit" title="适配屏宽" aria-label="适配屏宽">${icon.fit}</button>
          <button class="btn icon" data-act="fs" title="全屏（F）" aria-label="全屏">${icon.full}</button>
          ${mode === 'compact' ? `<a class="btn sm" href="#/demo/${esc(demo.id)}">完整演示 ${icon.arrow}</a>` : ''}
        </div>
      </div>
      <aside class="player-side">
        <div class="narr" aria-live="polite">
          <div class="no"></div>
          <h3></h3>
          <p></p>
          <div class="srcs"></div>
        </div>
        <div class="kpis" aria-live="polite" aria-label="关键指标"></div>
        <div class="panel nodeinfo" hidden></div>
        <div class="panel"><h4>流量图例 <span class="muted" style="font-weight:500">点击高亮路径</span></h4><div class="legend flows"></div></div>
        <div class="panel"><h4>演示步骤</h4><ol class="steplist"></ol></div>
        <details class="panel teacher">
          <summary>讲师提示 <span class="muted" style="font-weight:500">（T）</span></summary>
          <div class="tbody"></div>
        </details>
        <div class="panel teacher-pop"><h4>讲师提示</h4><div class="tbody"></div></div>
        ${prodChips ? `<div class="panel"><h4>涉及产品</h4><div class="chips">${prodChips}</div></div>` : ''}
      </aside>
    </div>`;
  host.appendChild(el);

  const $ = s => el.querySelector(s);
  const stageEl = $('.stage');
  const nodeInfo = $('.nodeinfo');
  let scene = null;

  const stage = new TopologyStage(stageEl, { reducedMotion: reduced(), onNodeClick: n => showNode(n) });
  const player = new Player(stage, { onStep: (i, step, state) => renderStep(i, step, state), onPlayState: m => renderPlayState(m) });

  function teacherHTML(step) {
    const p = product((demo.products || [])[0]);
    const t = p?.teacher;
    const rows = [];
    if (step?.teacher) rows.push(`<p class="now"><b>本步：</b>${esc(step.teacher)}</p>`);
    if (t) {
      [['先讲', t.open], ['突出', t.highlight], ['展示', t.show], ['解释', t.explain], ['引出', t.bridge]].forEach(([k, v]) => { if (v) rows.push(`<p><b>${k}：</b>${esc(v)}</p>`); });
    }
    return rows.join('') || '<p class="muted">本演示暂无额外讲师提示。</p>';
  }

  function flowName(f) {
    if (f.label) return f.label;
    const nm = id => scene.nodes.find(n => n.id === id)?.label || id;
    return `${FLOW_LABEL[f.kind] || '流量'}：${nm(f.path[0])} → ${nm(f.path[f.path.length - 1])}`;
  }

  function renderStep(i, step, state) {
    const n = player.steps.length;
    $('.narr .no').textContent = `第 ${i + 1} / ${n} 步`;
    $('.narr h3').textContent = step.t;
    $('.narr p').textContent = step.say || '';
    $('.narr .srcs').innerHTML = step.src ? srcTags(step.src) : '';
    // 指标
    const kpis = (scene.kpis || []).filter(k => state.kpis.includes(k.id));
    $('.kpis').innerHTML = kpis.map(k => `<div class="kpi"><span>${esc(k.label)}</span><b>${esc(k.value)}</b>${k.src ? srcTags(k.src) : ''}</div>`).join('');
    // 步骤点与列表
    $('.dots').innerHTML = player.steps.map((s, k) => `<button data-step="${k}" title="${esc(s.t)}" class="${k < i ? 'done' : ''}" ${k === i ? 'aria-current="step"' : ''}>${k + 1}</button>`).join('');
    $('.steplist').innerHTML = player.steps.map((s, k) => `<li><button data-step="${k}" ${k === i ? 'aria-current="step"' : ''}><b>${k + 1}</b><span>${esc(s.t)}</span></button></li>`).join('');
    // 流量图例
    const flows = (scene.flows || []).filter(f => state.flows.has(f.id));
    $('.legend.flows').innerHTML = flows.length
      ? flows.map(f => `<button data-flow="${esc(f.id)}" aria-pressed="${stage.highlight === f.id}" style="--c:${FLOW_COLOR[f.kind] || 'var(--flow)'}"><i></i>${esc(flowName(f))}</button>`).join('')
      : '<span class="muted" style="font-size:13px">本步无流量</span>';
    el.querySelectorAll('.teacher .tbody, .teacher-pop .tbody').forEach(t => { t.innerHTML = teacherHTML(step); });
    $('[data-act="prev"]').disabled = i === 0;
    $('[data-act="next"]').disabled = i === n - 1;
    opts.onState?.(scene.id, i);
  }

  function renderPlayState(m) {
    const b = $('[data-act="toggle"]');
    b.innerHTML = m === 'playing' ? `${icon.pause}<span>暂停</span>` : `${icon.play}<span>${m === 'paused' ? '继续' : '自动播放'}</span>`;
    b.setAttribute('aria-pressed', m === 'playing');
    el.dataset.state = m;
    el.querySelectorAll('.speed button').forEach(x => x.setAttribute('aria-pressed', Number(x.dataset.speed) === player.speed));
  }

  function showNode(n) {
    const info = n.info || {};
    nodeInfo.hidden = false;
    nodeInfo.innerHTML = `<button class="btn icon sm ghost x" data-act="closeinfo" aria-label="关闭说明">${icon.close}</button>
      <h4>${esc(n.label)}${n.sub ? ` <span class="muted" style="font-weight:500">${esc(n.sub)}</span>` : ''}</h4>
      <p>${esc(info.t || '')}</p>
      ${info.src ? `<div style="margin-top:8px">${srcTags(info.src)}</div>` : ''}`;
    if (window.matchMedia('(max-width: 1180px)').matches) nodeInfo.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function setScene(id, step = 0) {
    scene = demo.scenes.find(s => s.id === id) || demo.scenes[0];
    el.querySelectorAll('[data-scene]').forEach(b => b.setAttribute('aria-selected', b.dataset.scene === scene.id));
    nodeInfo.hidden = true;
    stage.highlightFlow(null);
    player.load(scene);
    if (step) player.go(step);
  }

  el.addEventListener('click', e => {
    const t = e.target.closest('[data-act],[data-step],[data-speed],[data-scene],[data-flow]');
    if (!t || !el.contains(t)) return;
    if (t.dataset.step !== undefined) { player.pause(true); player.go(Number(t.dataset.step)); return; }
    if (t.dataset.speed) { player.setSpeed(Number(t.dataset.speed)); return; }
    if (t.dataset.scene) { setScene(t.dataset.scene); return; }
    if (t.dataset.flow) {
      const id = stage.highlight === t.dataset.flow ? null : t.dataset.flow;
      stage.highlightFlow(id);
      el.querySelectorAll('[data-flow]').forEach(b => b.setAttribute('aria-pressed', b.dataset.flow === id));
      return;
    }
    switch (t.dataset.act) {
      case 'toggle': player.toggle(); break;
      case 'prev': player.pause(true); player.prev(); break;
      case 'next': player.pause(true); player.next(); break;
      case 'replay': player.replay(); break;
      case 'fs': api.fullscreen(); break;
      case 'fit': el.classList.toggle('fit'); break;
      case 'closeinfo': nodeInfo.hidden = true; break;
    }
  });
  blurOnPointer(el);
  const onFs = () => {
    const on = document.fullscreenElement === el || document.webkitFullscreenElement === el;
    const b = $('[data-act="fs"]');
    if (b) { b.innerHTML = on ? icon.exitFull : icon.full; b.title = on ? '退出全屏（Esc）' : '全屏（F）'; }
  };
  document.addEventListener('fullscreenchange', onFs);
  document.addEventListener('webkitfullscreenchange', onFs);

  const api = {
    el, player, stage, demo,
    get scene() { return scene; },
    next: () => { player.pause(true); player.next(); },
    prev: () => { player.pause(true); player.prev(); },
    toggle: () => player.toggle(),
    replay: () => player.replay(),
    go: i => { player.pause(true); player.go(i); },
    first: () => { player.pause(true); player.go(0); },
    last: () => { player.pause(true); player.go(player.last); },
    setScene,
    closeInfo: () => { if (!nodeInfo.hidden) { nodeInfo.hidden = true; return true; } if (stage.highlight) { stage.highlightFlow(null); el.querySelectorAll('[data-flow]').forEach(b => b.setAttribute('aria-pressed', 'false')); return true; } return false; },
    toggleTeacher: () => {
      if (document.body.classList.contains('presenter')) document.body.classList.toggle('show-teacher');
      else { const d = $('details.teacher'); d.open = !d.open; if (d.open) d.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    },
    fullscreen: () => {
      const on = document.fullscreenElement || document.webkitFullscreenElement;
      if (on) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
    },
    destroy: () => {
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('webkitfullscreenchange', onFs);
      player.destroy();
      if (activePlayer === api) activePlayer = null;
      el.remove();
    }
  };
  if (mode === 'full' || !activePlayer) activePlayer = api;
  setScene(opts.scene, opts.step || 0);
  return api;
}

/** 静态缩略图：渲染场景最后一步（无动画） */
export function renderThumb(host, scene) {
  const stage = new TopologyStage(host, { reducedMotion: true });
  stage.load(scene);
  const p = new Player(stage);
  p.scene = scene;
  p.steps = scene.steps;
  p.calloutIds = new Set((scene.callouts || []).map(c => c.id));
  const st = p.computeState(scene.steps.length - 1);
  st.visible.forEach(id => { if (p.calloutIds.has(id)) st.visible.delete(id); });
  st.flows = new Set();
  st.focus = null;
  stage.apply(st);
  return stage;
}

export { db };
