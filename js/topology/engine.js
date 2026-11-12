/*
 * 拓扑渲染引擎：把 data/topologies.json 中的一个“场景”渲染成 SVG，
 * 并根据播放器计算出的状态（可见元素、链路/节点状态、流量、标注、仪表）刷新画面。
 * 图层顺序：区域 → 链路 → 流量轨迹 → 流量光点 → 节点 → 标注。节点卡片与文字底板绘制在连线之上，避免压字。
 */
const NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

/** 估算文字宽度（viewBox 单位）。中文按 1em，数字/大写 0.62em，其余 0.54em。 */
export function textWidth(str, fs) {
  let w = 0;
  for (const ch of String(str || '')) {
    if (/[⺀-鿿豈-﫿＀-￯　-〿]/.test(ch)) w += fs;
    else if (/[A-Z0-9%]/.test(ch)) w += fs * 0.62;
    else if (ch === ' ') w += fs * 0.3;
    else w += fs * 0.54;
  }
  return w;
}

/** 按宽度折行（中文逐字、英文按词）。 */
export function wrapText(str, fs, maxW) {
  const lines = [];
  let cur = '';
  const tokens = String(str || '').match(/[A-Za-z0-9.%+\-/~×·]+|\s+|./gu) || [];
  for (const tk of tokens) {
    const next = cur + tk;
    if (textWidth(next, fs) > maxW && cur.trim()) {
      lines.push(cur.trim());
      cur = tk.trimStart();
    } else cur = next;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

const SIZE = { sm: { r: 22, ic: 26 }, md: { r: 28, ic: 32 }, lg: { r: 34, ic: 40 } };
const LABEL_FS = 17;
const SUB_FS = 13;

function polyLength(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    cum.push(cum[i - 1] + Math.hypot(dx, dy));
  }
  return cum;
}

function pointAt(pts, cum, d) {
  const L = cum[cum.length - 1];
  if (L === 0) return pts[0];
  d = Math.max(0, Math.min(L, d));
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid; else hi = mid;
  }
  const seg = cum[hi] - cum[lo] || 1;
  const t = (d - cum[lo]) / seg;
  return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * t, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * t];
}

function toPath(pts) {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
}

export class TopologyStage {
  constructor(host, opts = {}) {
    this.host = host;
    this.onNodeClick = opts.onNodeClick || (() => {});
    this.reducedMotion = !!opts.reducedMotion;
    this.speed = 1;
    this.running = true;
    this.activeFlows = [];
    this.highlight = null;
    this._raf = null;
    this._last = 0;
    this._t = 0;
  }

  /* ---------- 构建 ---------- */
  load(scene) {
    this.destroy();
    this.scene = scene;
    const [W, H] = scene.view || [1280, 720];
    const [cx, cy, cw, ch] = scene.crop || [0, 64, W, H - 84];
    this.W = W; this.H = H;
    this.nodes = new Map((scene.nodes || []).map(n => [n.id, n]));
    this.elems = new Map();
    this.extras = new Map();
    const svg = el('svg', {
      class: this.reducedMotion ? 'topo reduced' : 'topo', viewBox: `${cx} ${cy} ${cw} ${ch}`, role: 'img',
      'aria-label': scene.title || '网络拓扑', preserveAspectRatio: 'xMidYMid meet'
    });
    el('title', null, svg).textContent = scene.title || '网络拓扑';
    const defs = el('defs', null, svg);
    for (const k of ['flow', 'tunnel', 'security', 'ok', 'fault', 'control', 'link']) {
      const m = el('marker', { id: `arw-${k}`, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
      el('path', { d: 'M0 0L10 5L0 10z', class: `arw arw-${k}` }, m);
    }
    this.g = {};
    for (const layer of ['zones', 'links', 'tracks', 'dots', 'labels', 'nodes', 'callouts']) this.g[layer] = el('g', { class: `layer-${layer}` }, svg);
    this.svg = svg;

    (scene.zones || []).forEach(z => this._zone(z));
    this.linkGeom = new Map();
    (scene.links || []).forEach(l => this._link(l));
    (scene.nodes || []).forEach(n => (n.kind === 'meter' ? this._meter(n) : this._node(n)));
    this.flowGeom = new Map();
    (scene.flows || []).forEach(f => this._flowTrack(f));
    (scene.callouts || []).forEach(c => this._callout(c));
    this.host.innerHTML = '';
    this.host.appendChild(svg);
    this._loop = this._loop.bind(this);
  }

  _register(id, node) {
    node.classList.add('is-hidden');
    node.dataset.id = id;
    this.elems.set(id, node);
  }

  _zone(z) {
    const g = el('g', { class: `tz tone-${z.tone || 'neutral'}` }, this.g.zones);
    el('rect', { class: 'tz-box', x: z.x, y: z.y, width: z.w, height: z.h, rx: 18 }, g);
    if (z.label) {
      const fs = 15;
      const tw = textWidth(z.label, fs) + 24;
      const lp = z.lp || 'tl';
      const lx = lp.endsWith('r') ? z.x + z.w - tw - 14 : z.x + 14;
      const ly = lp.startsWith('b') ? z.y + z.h - 34 : z.y - 14;
      const lab = el('g', { class: 'tz-lab' }, g);
      el('rect', { class: 'tz-lab-bg', x: lx, y: ly, width: tw, height: 28, rx: 14 }, lab);
      const t = el('text', { class: 'tz-t', x: lx + tw / 2, y: ly + 19, 'text-anchor': 'middle' }, lab);
      t.textContent = z.label;
    }
    this._register(z.id, g);
  }

  _center(id) {
    const n = this.nodes.get(id);
    if (!n) throw new Error(`拓扑节点不存在: ${id}`);
    return [n.x, n.y];
  }

  _linkPoints(l) {
    const A = this._center(l.a);
    const B = this._center(l.b);
    if (l.via) return [A, ...l.via, B];
    switch (l.route) {
      case 'hv': return [A, [B[0], A[1]], B];
      case 'vh': return [A, [A[0], B[1]], B];
      case 'hvh': { const mx = l.mx ?? (A[0] + B[0]) / 2; return [A, [mx, A[1]], [mx, B[1]], B]; }
      case 'vhv': { const my = l.my ?? (A[1] + B[1]) / 2; return [A, [A[0], my], [B[0], my], B]; }
      case 'curve': {
        const bend = l.bend ?? 0.18;
        const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
        const dx = B[0] - A[0], dy = B[1] - A[1];
        const len = Math.hypot(dx, dy) || 1;
        const C = [mx - (dy / len) * len * bend, my + (dx / len) * len * bend];
        const pts = [];
        for (let i = 0; i <= 24; i++) {
          const t = i / 24;
          pts.push([(1 - t) * (1 - t) * A[0] + 2 * (1 - t) * t * C[0] + t * t * B[0], (1 - t) * (1 - t) * A[1] + 2 * (1 - t) * t * C[1] + t * t * B[1]]);
        }
        return pts;
      }
      default: return [A, B];
    }
  }

  _link(l) {
    const pts = this._linkPoints(l);
    const cum = polyLength(pts);
    this.linkGeom.set(l.id, { pts, cum, a: l.a, b: l.b });
    const g = el('g', { class: `tl kind-${l.kind || 'link'}` }, this.g.links);
    const extra = [];
    const d = toPath(pts);
    if (l.kind === 'hardpipe') el('path', { class: 'tl-base', d }, g);
    el('path', { class: 'tl-line', d }, g);
    const mid = pointAt(pts, cum, cum[cum.length - 1] * (l.lab ?? 0.5));
    if (l.label) {
      const fs = 13;
      const tw = textWidth(l.label, fs) + 16;
      const [ox, oy] = l.labOffset || [0, 0];
      const lab = el('g', { class: `tl-lab kind-${l.kind || 'link'} is-hidden`, transform: `translate(${(mid[0] + ox).toFixed(1)} ${(mid[1] + oy).toFixed(1)})` }, this.g.labels);
      lab.dataset.id = l.id;
      extra.push(lab);
      el('rect', { x: -tw / 2, y: -12, width: tw, height: 24, rx: 12 }, lab);
      el('text', { x: 0, y: 4.5, 'text-anchor': 'middle' }, lab).textContent = l.label;
    }
    const xm = pointAt(pts, cum, cum[cum.length - 1] * (l.cut ?? 0.5));
    const x = el('g', { class: 'tl-x is-hidden', transform: `translate(${xm[0].toFixed(1)} ${xm[1].toFixed(1)})` }, this.g.labels);
    el('circle', { r: 13 }, x);
    el('path', { d: 'M-6 -6L6 6M6 -6L-6 6' }, x);
    extra.push(x);
    this.extras.set(l.id, extra);
    this._register(l.id, g);
  }

  _labelBlock(g, n, R) {
    const lines = [];
    if (n.label) lines.push({ t: n.label, fs: LABEL_FS, cls: 'tn-t' });
    if (n.sub) lines.push({ t: n.sub, fs: SUB_FS, cls: 'tn-s' });
    if (!lines.length) return;
    const w = Math.max(...lines.map(l => textWidth(l.t, l.fs))) + 16;
    const h = lines.reduce((s, l) => s + l.fs + 6, 0) + 6;
    const lp = n.lp || 'b';
    let x, y, anchor = 'middle';
    if (lp === 't') { x = 0; y = -R - 8 - h; }
    else if (lp === 'l') { x = -R - 10 - w / 2; y = -h / 2; }
    else if (lp === 'r') { x = R + 10 + w / 2; y = -h / 2; }
    else { x = 0; y = R + 6; }
    const lab = el('g', { class: 'tn-lab' }, g);
    el('rect', { class: 'tn-lab-bg', x: x - w / 2, y, width: w, height: h, rx: 8 }, lab);
    let cy = y + 4;
    for (const l of lines) {
      cy += l.fs + 1;
      el('text', { class: l.cls, x, y: cy - 2, 'text-anchor': anchor }, lab).textContent = l.t;
      cy += 5;
    }
  }

  _node(n) {
    const s = SIZE[n.size || 'md'];
    const g = el('g', {
      class: `tn tone-${n.tone || 'neutral'}`, transform: `translate(${n.x} ${n.y})`,
      tabindex: n.info ? 0 : -1, role: n.info ? 'button' : 'img',
      'aria-label': [n.label, n.sub].filter(Boolean).join('，')
    }, this.g.nodes);
    el('circle', { class: 'tn-halo', r: s.r + 9 }, g);
    if (n.shape === 'cloud') {
      el('path', { class: 'tn-plate tn-cloud', d: `M${-s.r * 1.55} ${s.r * 0.62} a${s.r * 0.6} ${s.r * 0.6} 0 0 1 ${s.r * 0.25} ${-s.r * 1.18} a${s.r * 0.95} ${s.r * 0.95} 0 0 1 ${s.r * 1.62} ${-s.r * 0.42} a${s.r * 0.78} ${s.r * 0.78} 0 0 1 ${s.r * 1.26} ${s.r * 0.86} a${s.r * 0.6} ${s.r * 0.6} 0 0 1 ${-s.r * 0.08} ${s.r * 1.16} z` }, g);
    } else {
      el('rect', { class: 'tn-plate', x: -s.r, y: -s.r, width: s.r * 2, height: s.r * 2, rx: n.round ? s.r : 14 }, g);
    }
    if (n.icon) el('use', { href: `#i-${n.icon}`, class: 'tn-icon', x: -s.ic / 2, y: -s.ic / 2, width: s.ic, height: s.ic }, g);
    if (n.badge) {
      const bw = textWidth(n.badge, 12) + 12;
      const b = el('g', { class: 'tn-badge', transform: `translate(${s.r - 4} ${-s.r - 2})` }, g);
      el('rect', { x: -bw / 2, y: -11, width: bw, height: 22, rx: 11 }, b);
      el('text', { x: 0, y: 4.5, 'text-anchor': 'middle' }, b).textContent = n.badge;
    }
    this._labelBlock(g, n, n.shape === 'cloud' ? s.r * 0.9 : s.r);
    if (n.info) {
      const fire = () => this.onNodeClick(n);
      g.addEventListener('click', fire);
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); fire(); } });
      g.classList.add('is-clickable');
    }
    this._register(n.id, g);
  }

  _meter(n) {
    const w = n.w || 240;
    const g = el('g', { class: `tm tone-${n.tone || 'flow'}`, transform: `translate(${n.x} ${n.y})` }, this.g.nodes);
    el('rect', { class: 'tm-card', x: -w / 2 - 16, y: -44, width: w + 32, height: n.caption ? 98 : 80, rx: 14 }, g);
    el('text', { class: 'tm-title', x: -w / 2, y: -18 }, g).textContent = n.label || '';
    const val = el('text', { class: 'tm-val', x: w / 2, y: -18, 'text-anchor': 'end' }, g);
    val.textContent = n.valueText || '';
    el('rect', { class: 'tm-track', x: -w / 2, y: -4, width: w, height: 18, rx: 9 }, g);
    const fill = el('rect', { class: 'tm-fill', x: -w / 2, y: -4, width: w, height: 18, rx: 9 }, g);
    fill.style.transform = `scaleX(${(n.value ?? 0) / 100})`;
    if (n.mark) {
      const mx = -w / 2 + (w * n.mark) / 100;
      el('line', { class: 'tm-mark', x1: mx, y1: -10, x2: mx, y2: 20 }, g);
      el('text', { class: 'tm-mark-t', x: mx, y: 34, 'text-anchor': 'middle' }, g).textContent = `${n.mark}%`;
    }
    let cap = null;
    if (n.caption) {
      cap = el('text', { class: 'tm-cap', x: -w / 2, y: 46 }, g);
      cap.textContent = n.caption;
    }
    this._register(n.id, g);
    g.dataset.tone = n.tone || 'flow';
    g._meter = { fill, val, cap, g };
  }

  _flowTrack(f) {
    let pts = [];
    for (let i = 1; i < f.path.length; i++) {
      const u = f.path[i - 1], v = f.path[i];
      let seg = null;
      for (const geo of this.linkGeom.values()) {
        if (geo.a === u && geo.b === v) { seg = geo.pts; break; }
        if (geo.a === v && geo.b === u) { seg = [...geo.pts].reverse(); break; }
      }
      if (!seg) seg = [this._center(u), this._center(v)];
      pts = pts.length ? pts.concat(seg.slice(1)) : seg.slice();
    }
    const cum = polyLength(pts);
    const track = el('path', {
      class: `tf-track kind-${f.kind || 'data'}`, d: toPath(pts),
      'marker-end': this.reducedMotion ? `url(#arw-${this._markerKind(f.kind)})` : null
    }, this.g.tracks);
    const dots = el('g', { class: `tf-dots kind-${f.kind || 'data'}` }, this.g.dots);
    const n = f.n ?? 3;
    const list = [];
    for (let i = 0; i < n; i++) list.push(el('circle', { r: f.kind === 'attack' ? 6.5 : 5.5, class: 'tf-dot' }, dots));
    track.classList.add('is-hidden');
    dots.classList.add('is-hidden');
    this.flowGeom.set(f.id, { pts, cum, track, dots, list, f, nodes: new Set(f.path) });
  }

  _markerKind(kind) {
    return { data: 'flow', video: 'flow', attack: 'fault', clean: 'ok', backup: 'ok', tunnel: 'tunnel', cloud: 'tunnel', control: 'control', security: 'security' }[kind] || 'flow';
  }

  _callout(c) {
    const w = c.w || 260;
    const fs = 15;
    const lines = wrapText(c.text, fs, w - 30);
    const h = lines.length * (fs + 7) + 20;
    let ax, ay;
    if (typeof c.at === 'string') [ax, ay] = this._center(c.at); else [ax, ay] = c.at || [c.x, c.y];
    const bx = (c.x ?? ax + (c.dx ?? 0)) - (c.anchor === 'left' ? 0 : c.anchor === 'right' ? w : w / 2);
    const by = (c.y ?? ay + (c.dy ?? -110)) - h / 2;
    const g = el('g', { class: `tc tone-${c.tone || 'info'}` }, this.g.callouts);
    if (c.lead !== false && typeof c.at === 'string') {
      const cx = Math.max(bx, Math.min(bx + w, ax));
      const cy = ay < by ? by : ay > by + h ? by + h : by + h / 2;
      el('line', { class: 'tc-lead', x1: ax, y1: ay, x2: cx, y2: cy }, g);
      el('circle', { class: 'tc-dot', cx: ax, cy: ay, r: 4 }, g);
    }
    el('rect', { class: 'tc-box', x: bx, y: by, width: w, height: h, rx: 10 }, g);
    el('rect', { class: 'tc-bar', x: bx, y: by, width: 5, height: h, rx: 2.5 }, g);
    const t = el('text', { class: 'tc-text', x: bx + 16, y: by + 10 }, g);
    lines.forEach((ln, i) => {
      el('tspan', { x: bx + 16, dy: i === 0 ? fs + 3 : fs + 7 }, t).textContent = ln;
    });
    this._register(c.id, g);
  }

  /* ---------- 状态 ---------- */
  apply(state) {
    if (!this.svg) return;
    const visible = state.visible;
    const STATES = ['is-down', 'is-alert', 'is-ok', 'is-protect', 'is-active', 'is-standby', 'is-focus', 'is-hl'];
    for (const [id, node] of this.elems) {
      const hidden = !visible.has(id);
      node.classList.toggle('is-hidden', hidden);
      node.classList.remove(...STATES);
      for (const x of this.extras.get(id) || []) { x.classList.toggle('is-hidden', hidden); x.classList.remove(...STATES); }
    }
    for (const [id, st] of state.states) {
      const node = this.elems.get(id);
      if (!node || !st || st === 'normal') continue;
      node.classList.add(`is-${st}`);
      for (const x of this.extras.get(id) || []) x.classList.add(`is-${st}`);
    }
    for (const [id, m] of state.meters) {
      const node = this.elems.get(id);
      if (!node || !node._meter) continue;
      node._meter.fill.style.transform = `scaleX(${Math.max(0, Math.min(100, m.value)) / 100})`;
      if (m.text !== undefined) node._meter.val.textContent = m.text;
      if (m.caption !== undefined && node._meter.cap) node._meter.cap.textContent = m.caption;
      node.classList.remove('tone-flow', 'tone-ok', 'tone-fault', 'tone-security');
      node.classList.add(`tone-${m.tone || node.dataset.tone || 'flow'}`);
    }
    // 流量
    this.activeFlows = [];
    for (const [id, geo] of this.flowGeom) {
      const on = state.flows.has(id);
      geo.track.classList.toggle('is-hidden', !on);
      geo.dots.classList.toggle('is-hidden', !on || this.reducedMotion);
      if (on) this.activeFlows.push(geo);
    }
    // 聚焦
    const focus = state.focus && state.focus.size ? state.focus : null;
    this.svg.classList.toggle('has-focus', !!focus);
    if (focus) for (const id of focus) { this.elems.get(id)?.classList.add('is-focus'); for (const x of this.extras.get(id) || []) x.classList.add('is-focus'); }
    this.highlightFlow(this.highlight && state.flows.has(this.highlight) ? this.highlight : null);
    this._kick();
  }

  highlightFlow(id) {
    this.highlight = id;
    if (!this.svg) return;
    for (const node of this.elems.values()) node.classList.remove('is-hl');
    for (const list of this.extras.values()) for (const x of list) x.classList.remove('is-hl');
    for (const geo of this.flowGeom.values()) { geo.track.classList.remove('is-hl'); geo.dots.classList.remove('is-hl'); }
    this.svg.classList.toggle('has-hl', !!id);
    if (!id) return;
    const geo = this.flowGeom.get(id);
    if (!geo) return;
    geo.track.classList.add('is-hl');
    geo.dots.classList.add('is-hl');
    const path = geo.f.path;
    for (let i = 0; i < path.length; i++) {
      this.elems.get(path[i])?.classList.add('is-hl');
      if (i) {
        for (const [lid, lg] of this.linkGeom) {
          if ((lg.a === path[i - 1] && lg.b === path[i]) || (lg.b === path[i - 1] && lg.a === path[i])) {
            this.elems.get(lid)?.classList.add('is-hl');
            for (const x of this.extras.get(lid) || []) x.classList.add('is-hl');
          }
        }
      }
    }
  }

  setSpeed(s) { this.speed = s; }

  setRunning(on) {
    this.running = on;
    this._kick();
  }

  _kick() {
    if (this.reducedMotion || !this.running || !this.activeFlows.length) {
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = null;
      this._paint(0);
      return;
    }
    if (!this._raf) { this._last = performance.now(); this._raf = requestAnimationFrame(this._loop); }
  }

  _loop(now) {
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    this._t += dt * this.speed;
    this._paint();
    this._raf = this.running && this.activeFlows.length ? requestAnimationFrame(this._loop) : null;
  }

  _paint() {
    for (const geo of this.activeFlows) {
      const L = geo.cum[geo.cum.length - 1];
      if (!L) continue;
      const v = geo.f.speed || 150;
      const n = geo.list.length;
      geo.list.forEach((dot, i) => {
        const d = ((this._t * v) + (L * i) / n) % L;
        const p = pointAt(geo.pts, geo.cum, d);
        dot.setAttribute('cx', p[0].toFixed(1));
        dot.setAttribute('cy', p[1].toFixed(1));
      });
    }
  }

  destroy() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    this.activeFlows = [];
    if (this.host) this.host.innerHTML = '';
    this.svg = null;
  }
}
