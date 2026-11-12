/* 资料口径：研究概况、资料来源、版本差异、待确认事项 */
import { db } from '../store.js';
import { esc, srcTags } from '../ui.js';

export function render(view, { query }) {
  const m = db.meta;
  const docs = [...db.sources.values()];
  const usage = id => db.products.filter(p => (p.src || []).includes(id)).map(p => p.name);
  view.innerHTML = `<div class="page">
    <div class="page-head"><div><div class="eyebrow">资料口径</div><h1>资料来源、版本差异与待确认事项</h1>
      <p>${esc(m.research.note)}</p></div></div>
    <div class="grid c4">
      <div class="stat"><b>${m.research.searchedKeywords}</b><span>检索关键词（文件名 + 正文）</span></div>
      <div class="stat"><b>${m.research.searchHits}</b><span>命中文件</span></div>
      <div class="stat"><b>${m.research.readFiles}</b><span>完整读取文档</span></div>
      <div class="stat"><b>${docs.length}</b><span>平台引用资料</span></div>
    </div>
    <section class="section"><h2>展示口径</h2>
      <div class="note">${esc(m.pricePolicy)}</div>
      <ul class="ticks warn" style="margin-top:14px">${m.excluded.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    </section>
    <section class="section"><h2>资料差异与处理方式（${m.conflicts.length} 项）</h2>
      <div class="table-wrap"><table class="table"><thead><tr><th>主题</th><th>资料差异</th><th>平台处理</th><th>出处</th></tr></thead><tbody>
      ${m.conflicts.map(c => `<tr><td>${esc(c.topic)}</td><td>${esc(c.detail)}</td><td>${esc(c.handling)}</td><td>${srcTags(c.src)}</td></tr>`).join('')}</tbody></table></div>
    </section>
    <section class="section"><h2>资料来源（${docs.length} 份）</h2>
      <p class="muted" style="margin-bottom:12px">${esc(db.paramNote || '')}</p>
      <div class="table-wrap"><table class="table"><thead><tr><th>编号</th><th>资料名称</th><th>发布单位 / 日期</th><th>适用范围 / 受众</th><th>用于产品</th></tr></thead><tbody>
      ${docs.map(d => `<tr id="doc-${d.id}" ${query.doc === d.id ? 'style="outline:3px solid var(--brand);outline-offset:-3px"' : ''}><td>${d.id}</td><td>《${esc(d.title)}》<br><span class="muted">${esc(d.type)}${d.pages ? ` · ${d.pages} 页` : ''}</span></td><td>${esc(d.issuer)}<br><span class="muted">${esc(d.date)}</span></td><td>${esc(d.scope)}<br><span class="muted">${esc(d.audience)}</span></td><td>${usage(d.id).map(esc).join('、') || '<span class="muted">行业/营销/演示</span>'}</td></tr>`).join('')}
      </tbody></table></div>
    </section>
  </div>`;
  if (query.doc) setTimeout(() => document.getElementById(`doc-${query.doc}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  return {};
}
