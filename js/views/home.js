/* 01 首页：产品全景 */
import { db, product } from '../store.js';
import { esc, icon, srcTags } from '../ui.js';
import { textWidth } from '../topology/engine.js';
import { renderThumb } from '../components/demo-player.js';

const W = 1280, H = 640;

function chipLayout(items, x0, x1, y0, rowH, fs) {
  // items: [{id,label,kind}] → 居中折行布局
  const rows = [[]];
  let w = 0;
  const gap = 10;
  for (const it of items) {
    it.w = textWidth(it.label, fs) + 30;
    if (w + it.w > x1 - x0 && rows[rows.length - 1].length) { rows.push([]); w = 0; }
    rows[rows.length - 1].push(it);
    w += it.w + gap;
  }
  rows.forEach((row, r) => {
    const total = row.reduce((s, it) => s + it.w, 0) + gap * (row.length - 1);
    let x = x0 + (x1 - x0 - total) / 2;
    row.forEach(it => { it.x = x; it.y = y0 + r * rowH; x += it.w + gap; });
  });
  return items;
}

function chipSVG(it, fs) {
  const p = product(it.id);
  const label = esc(it.label);
  const inner = `<rect x="${it.x.toFixed(1)}" y="${it.y}" width="${it.w.toFixed(1)}" height="${fs + 20}" rx="${(fs + 20) / 2}"/>
    <text x="${(it.x + it.w / 2).toFixed(1)}" y="${it.y + fs + 8}" text-anchor="middle">${label}</text>`;
  return p ? `<a class="pm-chip ${it.kind || ''}" href="#/product/${esc(it.id)}" aria-label="${esc(p.name)}"><title>${esc(p.name)}：${esc(p.tagline || '')}</title>${inner}</a>`
    : `<g class="pm-chip static">${inner}</g>`;
}

function panorama() {
  const boxes = [
    { id: 'internet', x: 300, y: 24, w: 680, h: 196, title: '互联网接入 · 点到网', tone: 'flow', items: [
      { id: 'dia', label: '互联网专线', kind: 'main' }, { id: 'security-line', label: '互联网安全专线', kind: 'main sec' }, { id: 'smart-dia', label: '智能互联网专线', kind: 'main' },
      { id: 'business-line', label: '商务专线（省内）' }, { id: 'cloud-broadband', label: '云宽带（省内）' }, { id: 'cloud-fusion', label: '云网融合（省内）' }, { id: 'zhifu', label: '智赋万企（省内）' }, { id: 'broadband', label: '公众宽带（对照）', kind: 'ghost' }
    ] },
    { id: 'networking', x: 16, y: 248, w: 360, h: 220, title: '组网与云网 · 三层组网', tone: 'tunnel', items: [
      { id: 'cloud-connect', label: '云联网', kind: 'main' }, { id: 'pon-network', label: 'PON 组网专线（省内）' }, { id: 'sd-wan', label: 'SD-WAN' }
    ] },
    { id: 'transport', x: 904, y: 248, w: 360, h: 220, title: '精品传输 · 二层硬管道', tone: 'hardpipe', items: [
      { id: 'premium-network', label: '政企精品网', kind: 'main' }, { id: 'finance-premium', label: '金融精品网' }, { id: 'smart-otn', label: '智能 OTN' }, { id: 'common-otn', label: '普通 OTN' }, { id: 'sdh-mstp', label: 'SDH / MSTP（迁转）', kind: 'ghost' }, { id: 'dark-fiber', label: '裸光纤（受限）', kind: 'ghost' }
    ] },
    { id: 'service', x: 300, y: 496, w: 680, h: 128, title: '网络延伸服务 · 一条线到一张网', tone: 'ok', items: [
      { id: 'extension-services', label: '网络延伸服务', kind: 'main' },
      { label: '设备调测' }, { label: '综合布线' }, { label: 'WLAN 覆盖' }, { label: '机房巡检' }, { label: '运行报告' }, { label: '专线自服务' }, { label: '重保' }, { label: '企业网络管家' }
    ] }
  ];
  const fs = 15;
  let out = '';
  for (const b of boxes) {
    out += `<g class="pm-box tone-${b.tone}"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="20"/>
      <text class="pm-title" x="${b.x + 20}" y="${b.y + 32}">${esc(b.title)}</text>`;
    chipLayout(b.items, b.x + 16, b.x + b.w - 16, b.y + 50, fs + 30, fs).forEach(it => { out += chipSVG(it, fs); });
    out += '</g>';
  }
  const cx = 640, cy = 358;
  const links = [
    { d: `M${cx} ${cy - 62} L${cx} 220`, cls: 'flow', label: '点到网' },
    { d: `M${cx - 62} ${cy} L376 ${cy}`, cls: 'tunnel', label: '多点组网 / 上云' },
    { d: `M${cx + 62} ${cy} L904 ${cy}`, cls: 'hardpipe', label: '点到点' },
    { d: `M${cx} ${cy + 62} L${cx} 496`, cls: 'ok', label: '服务' }
  ];
  const conn = links.map(l => `<path class="pm-link ${l.cls}" d="${l.d}"/><path class="pm-flow ${l.cls}" d="${l.d}"/>`).join('');
  const labs = [
    [cx + 12, 250, '点到网'], [470, cy - 12, '多点组网 / 上云'], [800, cy - 12, '点到点'], [cx + 12, 470, '服务']
  ].map(([x, y, t]) => `<text class="pm-lab" x="${x}" y="${y}"${x < cx && x > 400 ? ' text-anchor="middle"' : ''}>${t}</text>`).join('');
  return `<svg class="panorama" viewBox="0 0 ${W} ${H}" role="group" aria-label="产品全景地图：点击产品进入详情">
    ${conn}${labs}${out}
    <g class="pm-center"><circle cx="${cx}" cy="${cy}" r="62"/><use href="#i-building" x="${cx - 24}" y="${cy - 38}" width="48" height="48"/>
    <text x="${cx}" y="${cy + 34}" text-anchor="middle">政企客户</text></g>
  </svg>`;
}

export function render(view) {
  const m = db.meta;
  const nDemo = db.demos.length;
  const nScene = db.demos.reduce((s, d) => s + d.scenes.length, 0);
  const featured = ['dia', 'security-line', 'premium-network', 'cloud-connect'].map(id => db.demoMap.get(id)).filter(Boolean);
  view.innerHTML = `
  <div class="page home">
    <section class="hero">
      <div>
        <div class="eyebrow">中国联通 · 政企专线产品培训 V${esc(m.version)}</div>
        <h1>让客户经理<em>看懂网络</em>，<br>让客户<em>看见价值</em></h1>
        <p class="hero-lead">以金山文档正式资料为依据，用可分步控制的动态拓扑讲清互联网专线、互联网安全专线、政企精品网、云联网等产品如何工作、解决什么问题。</p>
        <div class="hero-actions">
          <a class="btn primary" href="#/demos">${icon.play} 开始动态演示</a>
          <a class="btn" href="#/products">进入产品中心</a>
          <button class="btn" data-act="presenter">${icon.presenter} 讲师模式</button>
        </div>
        <div class="stats">
          <div class="stat"><b>${db.products.length}</b><span>正式产品条目</span></div>
          <div class="stat"><b>${nDemo}</b><span>套动态演示 · ${nScene} 个场景</span></div>
          <div class="stat"><b>${m.research.readFiles}</b><span>份资料完整读取</span></div>
          <div class="stat"><b>${db.quiz.questions.length}</b><span>道课堂互动题</span></div>
        </div>
      </div>
      <div class="map-card" aria-hidden="false">
        ${featured[0] ? `<a class="thumb" href="#/demo/${featured[0].id}" data-thumb="${featured[0].id}" aria-label="打开演示：${esc(featured[0].title)}"></a>` : ''}
        <p class="muted" style="font-size:13px;margin:8px 4px 2px">示例：${esc(featured[0]?.title || '')}（点击打开）</p>
      </div>
    </section>

    <section class="section">
      <div class="page-head" style="margin-bottom:12px">
        <div><div class="eyebrow">产品全景</div><h2>政企专线联网产品地图</h2>
        <p>依据资料中的“政企专线联网产品线布局”：互联网专线（点到网）、组网专线（点到点）、延伸服务（一条线到一张网）。点击产品进入详情。 ${srcTags('S01:P2; S23:P2')}</p></div>
        <div class="chips"><span class="chip flow"><span class="dot"></span>互联网接入</span><span class="chip security"><span class="dot"></span>网络安全</span><span class="chip hardpipe"><span class="dot"></span>精品传输</span><span class="chip tunnel"><span class="dot"></span>组网与云网</span><span class="chip ok"><span class="dot"></span>延伸服务</span></div>
      </div>
      <div class="card" style="padding:12px">${panorama()}</div>
    </section>

    <section class="section">
      <h2>快速进入</h2>
      <div class="grid c4">
        ${featured.map(d => `<a class="pcard" href="#/demo/${d.id}" style="text-decoration:none">
          <div class="thumb" data-thumb="${d.id}"></div>
          <h3 style="font-size:var(--fs-md)">${esc(d.title)}</h3>
          <p>${esc(d.summary)}</p></a>`).join('')}
      </div>
      <div class="grid c4" style="margin-top:16px">
        <a class="card" href="#/industries" style="text-decoration:none"><div class="eyebrow">05</div><h3>行业解决方案</h3><p class="muted">${db.industries.map(i => esc(i.name)).join(' · ')}</p></a>
        <a class="card" href="#/compare" style="text-decoration:none"><div class="eyebrow">06</div><h3>产品对比</h3><p class="muted">同一资料口径下的横向对比，条件一致才比较</p></a>
        <a class="card" href="#/sales" style="text-decoration:none"><div class="eyebrow">07</div><h3>营销实战</h3><p class="muted">需求识别、商机信号、产品组合、SPIN 提问、异议处理</p></a>
        <a class="card" href="#/quiz" style="text-decoration:none"><div class="eyebrow">08</div><h3>课堂互动</h3><p class="muted">六类题型，答题、解析、得分统计</p></a>
      </div>
    </section>

    <section class="section grid c2">
      <div class="card">
        <h3>讲师怎么用</h3>
        <div class="keys" style="margin-top:12px">
          <kbd>← →</kbd><span>上一步 / 下一步（翻页笔 PageUp/PageDown 同样有效）</span>
          <kbd>空格</kbd><span>自动播放 / 暂停</span>
          <kbd>R</kbd><span>重播当前演示</span>
          <kbd>F</kbd><span>全屏投影</span>
          <kbd>P</kbd><span>讲师模式：放大拓扑、隐藏次要信息</span>
          <kbd>T</kbd><span>讲师提示</span>
          <kbd>?</kbd><span>快捷键说明</span>
        </div>
      </div>
      <div class="card">
        <h3>资料口径</h3>
        <p class="muted" style="margin-top:8px">${esc(m.research.note)}</p>
        <p class="muted" style="margin-top:8px">${esc(m.pricePolicy)}</p>
        <a class="btn sm" style="margin-top:14px" href="#/sources">${icon.doc} 查看资料来源与待确认事项</a>
      </div>
    </section>
  </div>`;
  const stages = [];
  view.querySelectorAll('[data-thumb]').forEach(t => {
    const d = db.demoMap.get(t.dataset.thumb);
    if (d) stages.push(renderThumb(t, d.scenes[0]));
  });
  view.querySelector('[data-act="presenter"]')?.addEventListener('click', () => document.dispatchEvent(new CustomEvent('pnd:presenter')));
  return { destroy: () => stages.forEach(s => s.destroy()) };
}
