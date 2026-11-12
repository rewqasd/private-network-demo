/* 06 产品对比 */
import { db, product, category } from '../store.js';
import { esc, srcTags, prodLink } from '../ui.js';
import { setQuery } from '../router.js';

function tableHTML(t) {
  return `<div class="card" style="padding:18px 20px">
    <h2 style="font-size:var(--fs-xl)">${esc(t.title)}</h2>
    <p class="note" style="margin-top:10px"><b>比较条件：</b>${esc(t.basis)} ${srcTags(t.src)}</p>
    <div class="table-wrap" style="margin-top:14px"><table class="table"><thead><tr><th>对比项</th>${t.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${t.rows.map(r => `<tr>${r.map((c, i) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <div class="chips" style="margin-top:12px">${t.products.map(id => prodLink(id)).join('')}</div>
  </div>`;
}

function fieldVal(p, path) {
  const v = path.split('.').reduce((o, k) => o?.[k], p);
  if (Array.isArray(v)) return v.map(x => typeof x === 'string' ? x : (x.name ? `${x.name}${x.desc ? '：' + x.desc : ''}` : x.text || '')).join('；');
  if (path === 'category') return category(v)?.name || v;
  return v || '—';
}

function customHTML(ids) {
  const ps = ids.map(product).filter(Boolean);
  if (ps.length < 2) return '<div class="empty">请至少选择两个产品</div>';
  const keyRows = [['技术参数（节选）', p => (db.params[p.id] || []).slice(0, 5).map(x => `${x.n}：${x.v}`).join('；') || '—']];
  return `<div class="table-wrap"><table class="table"><thead><tr><th>维度</th>${ps.map(p => `<th>${prodLink(p.id, '')}</th>`).join('')}</tr></thead><tbody>
    ${db.compare.dimensions.map(d => `<tr><td>${esc(d.label)}</td>${ps.map(p => `<td>${esc(fieldVal(p, d.field))}</td>`).join('')}</tr>`).join('')}
    ${keyRows.map(([lab, fn]) => `<tr><td>${esc(lab)}</td>${ps.map(p => `<td>${esc(fn(p))}</td>`).join('')}</tr>`).join('')}
  </tbody></table></div><p class="note" style="margin-top:10px">自选对比按产品库字段逐项列出；不同资料、不同省份口径的参数不可直接比较大小，请以上方“同一资料口径”对比表为准。</p>`;
}

export function render(view, { query }) {
  const tables = db.compare.tables;
  let cur = query.t || tables[0].id;
  let picks = (query.p || 'dia,cloud-broadband').split(',').filter(id => product(id));
  view.innerHTML = `<div class="page">
    <div class="page-head"><div><div class="eyebrow">06 产品对比</div><h1>同一口径下的横向对比</h1>
      <p>对比表直接取自同一份资料的对比内容，确保比较条件一致；不同资料口径不混排在同一列。</p></div></div>
    <div class="tabs" role="tablist" aria-label="对比表">${tables.map(t => `<button role="tab" data-t="${t.id}">${esc(t.title.split('：')[0])}</button>`).join('')}<button role="tab" data-t="custom">自选对比</button></div>
    <div class="cmp" style="margin-top:18px"></div></div>`;
  const box = view.querySelector('.cmp');
  const draw = () => {
    view.querySelectorAll('[data-t]').forEach(b => b.setAttribute('aria-selected', b.dataset.t === cur));
    if (cur === 'custom') {
      box.innerHTML = `<div class="card" style="padding:18px 20px"><h2 style="font-size:var(--fs-xl)">自选对比</h2>
        <div class="chips" style="margin:12px 0">${db.products.map(p => `<button class="chip ${picks.includes(p.id) ? 'brand' : 'outline'}" data-pick="${p.id}" aria-pressed="${picks.includes(p.id)}" style="cursor:pointer">${esc(p.name)}</button>`).join('')}</div>
        <div class="custom">${customHTML(picks)}</div></div>`;
    } else box.innerHTML = tableHTML(tables.find(t => t.id === cur) || tables[0]);
  };
  view.querySelector('.page').addEventListener('click', e => {
    const t = e.target.closest('[data-t]');
    if (t) { cur = t.dataset.t; setQuery({ t: cur }); draw(); return; }
    const p = e.target.closest('[data-pick]');
    if (p) {
      const id = p.dataset.pick;
      picks = picks.includes(id) ? picks.filter(x => x !== id) : [...picks, id].slice(-4);
      setQuery({ t: 'custom', p: picks.join(',') });
      draw();
    }
  });
  draw();
  const order = [...tables.map(t => t.id), 'custom'];
  const step = d => { cur = order[(order.indexOf(cur) + d + order.length) % order.length]; setQuery({ t: cur }); draw(); };
  return { keys: { prev: () => step(-1), next: () => step(1) } };
}
