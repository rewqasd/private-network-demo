/* 03 产品动态演示：列表 + 播放页 */
import { db, demo as getDemo } from '../store.js';
import { esc, icon, srcTags } from '../ui.js';
import { mountPlayer, renderThumb } from '../components/demo-player.js';
import { setQuery } from '../router.js';

const KIND = { product: '产品原理演示', tech: '网络技术演示', industry: '行业方案演示' };

export function renderList(view) {
  const groups = ['product', 'industry', 'tech'];
  view.innerHTML = `<div class="page">
    <div class="page-head"><div><div class="eyebrow">03 产品动态演示</div><h1>分步讲解网络如何工作</h1>
      <p>每套演示都可逐步播放、暂停、回放、调速；点击设备查看说明，点击流量图例高亮路径。共 ${db.demos.length} 套、${db.demos.reduce((s, d) => s + d.scenes.length, 0)} 个场景。</p></div></div>
    ${groups.map(g => {
      const ds = db.demos.filter(d => d.kind === g);
      return ds.length ? `<section class="section" style="margin-top:8px;margin-bottom:28px"><h2>${KIND[g]}</h2>
        <div class="grid auto">${ds.map(d => `<a class="pcard" href="#/demo/${d.id}" style="text-decoration:none">
          <div class="thumb" data-thumb="${d.id}"></div>
          <h3 style="font-size:var(--fs-md)">${esc(d.title)}</h3>
          <p>${esc(d.summary)}</p>
          <div class="chips">${d.scenes.map(s => `<span class="chip">${esc(s.title)} · ${s.steps.length} 步</span>`).join('')}</div>
        </a>`).join('')}</div></section>` : '';
    }).join('')}
  </div>`;
  const stages = [];
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      const d = getDemo(en.target.dataset.thumb);
      if (d) stages.push(renderThumb(en.target, d.scenes[0]));
    });
  }, { rootMargin: '200px' }) : null;
  view.querySelectorAll('[data-thumb]').forEach(t => {
    if (io) io.observe(t);
    else { const d = getDemo(t.dataset.thumb); if (d) stages.push(renderThumb(t, d.scenes[0])); }
  });
  return { destroy: () => { io?.disconnect(); stages.forEach(s => s.destroy()); } };
}

export function renderDemo(view, { params, query }) {
  const d = getDemo(params.id);
  if (!d) { view.innerHTML = `<div class="page"><div class="empty">未找到演示：${esc(params.id)}。<a href="#/demos">返回演示列表</a></div></div>`; return {}; }
  const idx = db.demos.indexOf(d);
  const prevD = db.demos[(idx - 1 + db.demos.length) % db.demos.length];
  const nextD = db.demos[(idx + 1) % db.demos.length];
  const srcIds = new Set();
  d.scenes.forEach(s => s.steps.forEach(st => String(st.src || '').split(';').forEach(x => { const id = x.trim().split(':')[0]; if (id) srcIds.add(id); })));
  view.innerHTML = `<div class="page demo-page">
    <nav class="trail" aria-label="位置"><a href="#/demos">动态演示</a><span>/</span><span>${esc(KIND[d.kind] || '')}</span></nav>
    <div class="host" style="margin-top:10px"></div>
    ${d.kind === 'industry' ? `<p class="note" style="margin-top:14px">教学抽象场景：依据资料中的行业需求与产品定位绘制，不代表任何单一客户的实际部署；具名案例见“行业方案”页。</p>` : ''}
    <section class="section">
      <h2 style="font-size:var(--fs-lg)">本演示依据的资料</h2>
      <ul class="ticks" style="--c:var(--ink-400)">${[...srcIds].map(id => { const s = db.sources.get(id); return s ? `<li><a href="#/sources?doc=${id}">${id}</a> 《${esc(s.title)}》 <span class="muted">${esc(s.issuer)} · ${esc(s.date)}</span></li>` : ''; }).join('')}</ul>
    </section>
    <nav class="grid c2" style="margin-top:28px" aria-label="上一个/下一个演示">
      <a class="card" href="#/demo/${prevD.id}" style="text-decoration:none"><span class="muted">← 上一个演示</span><h3 style="font-size:var(--fs-md)">${esc(prevD.title)}</h3></a>
      <a class="card" href="#/demo/${nextD.id}" style="text-decoration:none;text-align:right"><span class="muted">下一个演示 →</span><h3 style="font-size:var(--fs-md)">${esc(nextD.title)}</h3></a>
    </nav>
  </div>`;
  const step = Math.max(0, (Number(query.step) || 1) - 1);
  const player = mountPlayer(view.querySelector('.host'), d, {
    mode: 'full', headingTag: 'h1', eyebrow: KIND[d.kind], scene: query.scene, step,
    onState: (scene, i) => setQuery({ scene: d.scenes.length > 1 ? scene : undefined, step: i ? i + 1 : undefined })
  });
  return { destroy: () => player.destroy(), player, title: d.title };
}

export { icon, srcTags };
