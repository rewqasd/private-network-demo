/* 05 行业解决方案 */
import { db, industry } from '../store.js';
import { esc, srcTags, prodLink } from '../ui.js';
import { mountPlayer, renderThumb } from '../components/demo-player.js';
import { caseType } from './products.js';

export function renderList(view) {
  view.innerHTML = `<div class="page">
    <div class="page-head"><div><div class="eyebrow">05 行业解决方案</div><h1>按行业组合真实产品</h1>
      <p>行业需求与产品定位取自资料；每个行业给出组合演示（教学抽象场景）与资料中的正式 / 脱敏案例。</p></div></div>
    <div class="grid auto">${db.industries.map(i => `<a class="pcard" href="#/industry/${i.id}" style="text-decoration:none">
      <div class="thumb" data-thumb="${i.demo}"></div>
      <h3>${esc(i.name)}</h3><p>${esc(i.summary)}</p>
      <div class="chips">${i.products.map(x => `<span class="chip outline">${esc(db.prodMap.get(x.id)?.name || '')}</span>`).join('')}</div>
      <div class="chips"><span class="chip">${i.cases.length} 个资料案例</span></div>
    </a>`).join('')}</div></div>`;
  const stages = [];
  view.querySelectorAll('[data-thumb]').forEach(t => { const d = db.demoMap.get(t.dataset.thumb); if (d) stages.push(renderThumb(t, d.scenes[0])); });
  return { destroy: () => stages.forEach(s => s.destroy()) };
}

export function renderDetail(view, { params }) {
  const ind = industry(params.id);
  if (!ind) { view.innerHTML = `<div class="page"><div class="empty">未找到行业。<a href="#/industries">返回</a></div></div>`; return {}; }
  const d = db.demoMap.get(ind.demo);
  const i = db.industries.indexOf(ind);
  const prev = db.industries[(i - 1 + db.industries.length) % db.industries.length];
  const next = db.industries[(i + 1) % db.industries.length];
  view.innerHTML = `<div class="page demo-page has-tabs">
    <nav class="trail"><a href="#/industries">行业方案</a><span>/</span><span>${esc(ind.name)}</span></nav>
    <div class="tabs" style="margin:10px 0 12px" role="tablist" aria-label="行业切换">${db.industries.map(x => `<button role="tab" aria-selected="${x.id === ind.id}" data-ind="${x.id}">${esc(x.name)}</button>`).join('')}</div>
    <div class="host"></div>
    <p class="note" style="margin-top:12px">上方拓扑为教学抽象场景：依据资料中的行业需求与产品定位绘制，不代表任何单一客户的实际部署。</p>
    <div class="grid c2" style="margin-top:20px">
      <div class="card"><div class="eyebrow">业务节点</div><div class="chips" style="margin-top:6px">${ind.nodes.map(n => `<span class="chip">${esc(n)}</span>`).join('')}</div>
        <div class="eyebrow" style="margin-top:18px">客户需求</div><ul class="ticks" style="margin-top:8px">${ind.needs.map(n => `<li>${esc(n.text)} ${srcTags(n.src)}</li>`).join('')}</ul></div>
      <div class="card"><div class="eyebrow">推荐产品组合（正式产品名称）</div>
        <div class="table-wrap" style="margin-top:10px"><table class="table"><tbody>${ind.products.map(x => `<tr><td>${prodLink(x.id, '')}</td><td>${esc(x.role)}</td></tr>`).join('')}</tbody></table></div></div>
    </div>
    <section class="section"><h2>资料中的案例</h2>
      <div class="grid c2">${ind.cases.map(cs => `<div class="card case ${cs.type}"><div class="chips">${caseType(cs.type)}${cs.products.map(p => prodLink(p)).join('')}</div>
        <h3 style="margin-top:10px">${esc(cs.title)}</h3><p style="margin-top:8px;color:var(--ink-700)">${esc(cs.summary)}</p><div style="margin-top:10px">${srcTags(cs.src)}</div></div>`).join('')}</div>
    </section>
    <nav class="grid c2" style="margin-top:28px"><a class="card" href="#/industry/${prev.id}" style="text-decoration:none"><span class="muted">← 上一个行业</span><h3>${esc(prev.name)}</h3></a>
      <a class="card" href="#/industry/${next.id}" style="text-decoration:none;text-align:right"><span class="muted">下一个行业 →</span><h3>${esc(next.name)}</h3></a></nav>
  </div>`;
  view.querySelector('.tabs').addEventListener('click', e => { const b = e.target.closest('[data-ind]'); if (b) location.hash = `#/industry/${b.dataset.ind}`; });
  const player = d ? mountPlayer(view.querySelector('.host'), d, { mode: 'full', headingTag: 'h1', eyebrow: `05 行业方案 · ${ind.name}` }) : null;
  return {
    destroy: () => player?.destroy(), player, title: `${ind.name}行业方案`,
    keysAlt: { prev: () => { location.hash = `#/industry/${prev.id}`; }, next: () => { location.hash = `#/industry/${next.id}`; } }
  };
}
