/* 07 营销实战 */
import { db, product } from '../store.js';
import { esc, srcTags, prodLink } from '../ui.js';
import { setQuery } from '../router.js';

const SECTIONS = [
  ['decision', '需求识别'], ['signals', '商机信号'], ['combos', '产品组合'], ['spin', 'SPIN 提问'], ['objections', '异议处理'], ['faq', '客户常见提问']
];

function decisionHTML(state) {
  const tree = db.sales.decision;
  const trail = state.trail.map(t => `<span class="chip">${esc(t)}</span>`).join('<span>›</span>');
  if (tree.results[state.at]) {
    const r = tree.results[state.at];
    return `<div class="tree"><div class="trail">${trail}</div>
      <div class="result"><div class="eyebrow">推荐产品</div><div class="chips" style="margin:8px 0">${r.products.map(id => prodLink(id, 'chip brand')).join('')}</div>
      <p style="font-size:var(--fs-lg);color:var(--ink-900)">${esc(r.why)}</p><div style="margin-top:8px">${srcTags(r.src)}</div></div>
      <div class="chips">${r.products.map(id => { const d = db.demos.find(x => x.products?.[0] === id && x.kind === 'product'); return d ? `<a class="btn sm" href="#/demo/${d.id}">演示：${esc(product(id).name)}</a>` : ''; }).join('')}
      <button class="btn sm" data-restart>重新识别</button></div></div>`;
  }
  const n = tree.nodes[state.at];
  return `<div class="tree"><div class="trail">${trail || '<span class="muted">从客户的一句话开始</span>'}</div>
    <div class="tree-q">${esc(n.q)}</div>
    <div class="tree-opts">${n.options.map((o, i) => `<button class="opt" data-opt="${i}">${esc(o.label)}</button>`).join('')}</div>
    ${state.trail.length ? '<button class="btn sm ghost" data-restart>重新开始</button>' : ''}</div>`;
}

export function render(view, { query }) {
  let cur = SECTIONS.some(s => s[0] === query.s) ? query.s : 'decision';
  const tree = { at: db.sales.decision.start, trail: [] };
  let spinP = db.sales.spin[0].product;
  view.innerHTML = `<div class="page">
    <div class="page-head"><div><div class="eyebrow">07 营销实战</div><h1>把产品知识转成营销语言</h1>
      <p>提问清单与异议应答框架来自营销工具包与集团产品资料；举证只用有出处的事实，不虚构案例、效果、SLA 或资源。</p></div></div>
    <div class="tabs" role="tablist" aria-label="营销模块">${SECTIONS.map(([id, t]) => `<button role="tab" data-s="${id}">${t}</button>`).join('')}</div>
    <div class="sales-body" style="margin-top:18px"></div></div>`;
  const body = view.querySelector('.sales-body');
  const draw = () => {
    view.querySelectorAll('[data-s]').forEach(b => b.setAttribute('aria-selected', b.dataset.s === cur));
    const S = db.sales;
    let html = '';
    if (cur === 'decision') html = `<div class="card"><h2 style="font-size:var(--fs-xl)">${esc(S.decision.title)}</h2><div class="dtree" style="margin-top:16px">${decisionHTML(tree)}</div></div>`;
    if (cur === 'signals') html = `<div class="grid c2">${S.signals.map(s => `<div class="card" style="padding:16px 18px"><div class="chips">${prodLink(s.product, 'chip brand')}</div><h3 style="font-size:var(--fs-md);margin-top:8px">${esc(s.signal)}</h3><p style="margin-top:6px;color:var(--ink-700)">→ ${esc(s.action)}</p><div style="margin-top:8px">${srcTags(s.src)}</div></div>`).join('')}</div>`;
    if (cur === 'combos') html = `<div class="grid c2">${S.combos.map(c => `<div class="card"><h3>${esc(c.name)}</h3><p class="muted" style="margin-top:4px">适用：${esc(c.for)}</p><div class="chips" style="margin:10px 0">${c.products.map(id => prodLink(id)).join('<span class="muted">+</span>')}</div><p>${esc(c.logic)}</p><div style="margin-top:8px">${srcTags(c.src)}</div></div>`).join('')}</div>`;
    if (cur === 'spin') {
      const s = S.spin.find(x => x.product === spinP) || S.spin[0];
      html = `<div class="tabs" style="margin-bottom:14px">${S.spin.map(x => `<button data-spin="${x.product}" aria-selected="${x.product === s.product}">${esc(product(x.product).name)}</button>`).join('')}</div>
        <div class="card"><h2 style="font-size:var(--fs-xl)">${esc(s.title)}</h2><p class="muted" style="margin-top:4px">资料话术 ${srcTags(s.src)}</p>
        <div class="grid c2" style="margin-top:14px">${[['S', '背景问题：了解现状'], ['P', '难点问题：挖掘痛点'], ['I', '暗示问题：放大影响'], ['N', '需求效益：引导价值']].map(([k, t]) => `<div class="card" style="padding:14px 16px;background:var(--surface-2)"><h3 style="font-size:var(--fs-md)"><span class="chip brand">${k}</span> ${t}</h3><ol style="margin-top:8px;padding-left:20px;display:grid;gap:6px">${(s[k] || []).map(q => `<li>${esc(q)}</li>`).join('')}</ol></div>`).join('')}</div></div>`;
    }
    if (cur === 'objections') html = S.objections.map(o => `<details class="acc"><summary><span>${prodLink(o.product, 'chip outline')} “${esc(o.q)}”</span></summary><div class="acc-body"><p>${esc(o.a)}</p><div style="margin-top:8px">${srcTags(o.src)}</div></div></details>`).join('') + '<p class="note" style="margin-top:12px">通用应对框架：认同 + 共情 + 举证 + 引导（资料原文）。举证只使用资料中有出处的事实，不虚构案例、效果、SLA 或资源。</p>';
    if (cur === 'faq') html = S.faq.map(f => `<details class="acc"><summary>${esc(f.q)}</summary><div class="acc-body"><p>${esc(f.a)}</p><div style="margin-top:8px">${srcTags(f.src)}</div></div></details>`).join('');
    body.innerHTML = html;
  };
  view.querySelector('.page').addEventListener('click', e => {
    const s = e.target.closest('[data-s]');
    if (s) { cur = s.dataset.s; setQuery({ s: cur }); draw(); return; }
    const o = e.target.closest('[data-opt]');
    if (o) { const n = db.sales.decision.nodes[tree.at]; const opt = n.options[Number(o.dataset.opt)]; tree.trail.push(opt.label); tree.at = opt.next; draw(); return; }
    if (e.target.closest('[data-restart]')) { tree.at = db.sales.decision.start; tree.trail = []; draw(); return; }
    const sp = e.target.closest('[data-spin]');
    if (sp) { spinP = sp.dataset.spin; draw(); }
  });
  draw();
  const order = SECTIONS.map(s => s[0]);
  const step = d => { cur = order[(order.indexOf(cur) + d + order.length) % order.length]; setQuery({ s: cur }); draw(); };
  return { keys: { prev: () => step(-1), next: () => step(1) } };
}
