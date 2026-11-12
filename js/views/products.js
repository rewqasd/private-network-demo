/* 02 产品中心：列表 + 详情 */
import { db, product, category, demosForProduct } from '../store.js';
import { esc, icon, srcTags, scopeChip, catChip, catTone, stBadge, prodLink } from '../ui.js';
import { mountPlayer } from '../components/demo-player.js';
import { setQuery } from '../router.js';

const keyParams = {
  dia: ['带宽范围', '固定公网 IP', '时延'],
  'security-line': ['全场景安全监测', '1G 清洗', '适用带宽'],
  'smart-dia': ['100M 及以上专线', '流量预警规则'],
  'premium-network': ['带宽范围', '保护倒换', '电路可用率'],
  'cloud-connect': ['带宽范围', '弹性阶梯', '云资源池'],
  'pon-network': ['专线带宽', '部署时效'],
  'sdh-mstp': ['单点割接中断']
};

function card(p) {
  const params = (db.params[p.id] || []).filter(x => (keyParams[p.id] || []).includes(x.n)).slice(0, 3);
  const demos = demosForProduct(p.id).filter(d => d.kind !== 'industry');
  return `<article class="pcard c-${p.category}">
    <div class="chips">${catChip(p.category)}${scopeChip(p)}${p.parent ? `<span class="chip outline">${esc(product(p.parent)?.name || '')} 子产品</span>` : ''}</div>
    <h3><a href="#/product/${esc(p.id)}">${esc(p.name)}</a></h3>
    ${p.aka?.length ? `<div class="aka">又称：${p.aka.map(esc).join(' / ')}</div>` : ''}
    <p>${esc(p.tagline)}</p>
    ${params.length ? `<div class="facts">${params.map(x => `<span class="chip ${catTone(p.category)}" title="${esc(x.c || '')}">${esc(x.n)}：${esc(x.v)}</span>`).join('')}</div>` : ''}
    <div class="acts"><a class="btn sm" href="#/product/${esc(p.id)}">产品详情</a>${demos[0] ? `<a class="btn sm" href="#/demo/${esc(demos[0].id)}">${icon.play} 动态演示</a>` : ''}</div>
  </article>`;
}

export function renderList(view, { query }) {
  let cat = query.cat || 'all';
  let kw = '';
  view.innerHTML = `<div class="page">
    <div class="page-head"><div><div class="eyebrow">02 产品中心</div><h1>按正式产品分类浏览</h1>
      <p>产品名称、参数与表述均来自金山文档资料并标注出处；省内产品注明资料来源省份。</p></div>
      <label class="search"><span class="sr-only">搜索产品</span><input type="search" placeholder="搜索产品名称 / 别名 / 关键词" aria-label="搜索产品"></label>
    </div>
    <div class="split">
      <aside class="split-side"><div class="catlist" role="group" aria-label="产品分类">
        <button data-cat="all">全部产品 <small>${db.products.length}</small></button>
        ${db.categories.map(c => `<button data-cat="${c.id}" style="--c:var(--${catTone(c.id)})"><span><span class="sw"></span>${esc(c.name)}</span><small>${db.products.filter(p => p.category === c.id).length}</small></button>`).join('')}
      </div>
      <div class="note" style="margin-top:12px">分类依据：${esc(db.categories[0] ? '政企专线联网产品线布局' : '')} ${srcTags('S01:P2; S23:P2')}</div></aside>
      <div class="plist"></div>
    </div></div>`;
  const list = view.querySelector('.plist');
  const draw = () => {
    view.querySelectorAll('[data-cat]').forEach(b => b.setAttribute('aria-pressed', b.dataset.cat === cat));
    const match = p => !kw || [p.name, p.tagline, ...(p.aka || [])].join(' ').toLowerCase().includes(kw);
    const groups = db.categories.filter(c => cat === 'all' || c.id === cat);
    const html = groups.map(c => {
      const ps = db.products.filter(p => p.category === c.id && match(p));
      if (!ps.length) return '';
      return `<section class="section" style="margin-top:0;margin-bottom:28px"><h2 style="font-size:var(--fs-lg);margin-bottom:6px">${esc(c.name)} <span class="muted" style="font-weight:500;font-size:var(--fs-sm)">${esc(c.short)}</span></h2>
        <p class="muted" style="margin-bottom:14px;font-size:var(--fs-sm)">${esc(c.summary)}</p>
        <div class="grid auto">${ps.map(card).join('')}</div></section>`;
    }).join('');
    list.innerHTML = html || '<div class="empty">没有匹配的产品</div>';
  };
  view.querySelector('.catlist').addEventListener('click', e => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    cat = b.dataset.cat;
    setQuery(cat === 'all' ? {} : { cat });
    draw();
  });
  view.querySelector('input[type=search]').addEventListener('input', e => { kw = e.target.value.trim().toLowerCase(); draw(); });
  draw();
  const order = ['all', ...db.categories.map(c => c.id)];
  const step = d => { cat = order[(order.indexOf(cat) + d + order.length) % order.length]; setQuery(cat === 'all' ? {} : { cat }); draw(); };
  return { keys: { prev: () => step(-1), next: () => step(1) } };
}

function paramTable(p) {
  const list = db.params[p.id] || [];
  if (!list.length) return '<p class="muted">资料中暂无可结构化的技术参数。</p>';
  let g = null;
  const rows = list.map(x => {
    const head = x.g !== g ? `<tr class="grp"><td colspan="4">${esc(x.g)}</td></tr>` : '';
    g = x.g;
    return `${head}<tr><td>${esc(x.n)}</td><td><b>${esc(x.v)}</b>${x.u ? ` <span class="muted">${esc(x.u)}</span>` : ''} ${stBadge(x.st)}</td><td class="muted">${esc(x.c || '—')}</td><td>${srcTags(x.src)}</td></tr>`;
  }).join('');
  return `<div class="table-wrap"><table class="table"><thead><tr><th>参数</th><th>数值 / 口径</th><th>适用范围与条件</th><th>出处</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${list.some(x => x.g === '标准资费') ? `<p class="note" style="margin-top:10px">${esc(db.meta.pricePolicy)}</p>` : ''}`;
}

function listCards(items, cls = 'grid c2') {
  return `<div class="${cls}">${items.map(x => `<div class="card" style="padding:16px 18px"><h3 style="font-size:var(--fs-md)">${esc(x.name)}</h3><p style="margin-top:6px;color:var(--ink-700)">${esc(x.desc)}</p>${x.src ? `<div style="margin-top:8px">${srcTags(x.src)}</div>` : ''}</div>`).join('')}</div>`;
}

export function renderDetail(view, { params }) {
  const p = product(params.id);
  if (!p) { view.innerHTML = `<div class="page"><div class="empty">未找到产品：${esc(params.id)}。<a href="#/products">返回产品中心</a></div></div>`; return {}; }
  const c = category(p.category);
  const demos = demosForProduct(p.id);
  const mainDemo = (p.demos || [])[0] ? db.demoMap.get(p.demos[0]) : null;
  const cases = db.industries.flatMap(i => i.cases.map(cs => ({ ...cs, ind: i }))).filter(cs => cs.products.includes(p.id));
  const sections = [];
  const sec = (id, title, html) => { if (html) sections.push({ id, title, html }); };

  sec('intro', '产品定位与介绍', `<p style="font-size:var(--fs-lg);color:var(--ink-900);font-weight:600">${esc(p.positioning)}</p>
    <p style="margin-top:10px">${esc(p.intro)} ${srcTags(p.introSrc || '')}</p>
    ${p.customers?.length ? `<h3 style="font-size:var(--fs-md);margin-top:18px">目标客户 ${srcTags(p.customersSrc || '')}</h3><div class="chips" style="margin-top:8px">${p.customers.map(x => `<span class="chip">${esc(x)}</span>`).join('')}</div>` : ''}
    ${p.needs?.length ? `<h3 style="font-size:var(--fs-md);margin-top:18px">客户需求 ${srcTags(p.needsSrc || '')}</h3><ul class="ticks" style="margin-top:10px">${p.needs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}`);
  if (p.children?.length) sec('family', '产品集合', `<div class="grid c3">${p.children.map(id => { const ch = product(id); return `<a class="pcard c-${ch.category}" href="#/product/${id}" style="text-decoration:none"><h3>${esc(ch.name)}</h3><p>${esc(ch.tagline)}</p></a>`; }).join('')}</div>`);
  sec('functions', '产品功能', p.functions?.length ? listCards(p.functions) : '');
  if (p.versions) sec('versions', '安全服务规格（2026 焕新版）', `${listCards(p.versions.map(v => ({ name: `${v.name} · ${v.layer}`, desc: v.desc, src: v.src })), 'grid c3')}
    <details class="acc" style="margin-top:14px"><summary>版本演进：2023 上线版 → 2026 焕新版</summary><div class="acc-body">
      <p><b>旧：</b>${esc(p.versionHistory.old)}</p><p style="margin-top:6px"><b>新：</b>${esc(p.versionHistory.new)}</p>
      <div class="table-wrap" style="margin-top:10px"><table class="table"><thead><tr><th>原套餐</th><th>新规格</th></tr></thead><tbody>${p.versionHistory.mapping.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</tbody></table></div>
      <div style="margin-top:8px">${srcTags(p.versionHistory.src)}</div></div></details>`);
  if (p.serviceLayers) sec('services', '服务体系', p.serviceLayers.map(l => `<div class="card" style="margin-bottom:12px;padding:16px 18px"><div class="eyebrow">${esc(l.goal)}</div><h3 style="font-size:var(--fs-md)">${esc(l.name)}</h3><p class="muted" style="margin-top:4px">${esc(l.desc)}</p>
    ${l.items.length ? `<ul class="ticks" style="margin-top:12px;--c:var(--ok)">${l.items.map(i => `<li><b>${esc(i.name)}：</b>${esc(i.desc)}</li>`).join('')}</ul>` : ''}</div>`).join('') + srcTags(p.serviceLayersSrc));
  sec('tech', '核心技术', p.tech?.length ? listCards(p.tech) : '');
  sec('params', '技术参数', paramTable(p));
  sec('arch', '网络架构', `${p.architecture?.summary ? `<p>${esc(p.architecture.summary)}</p>` : ''}
    ${p.architecture?.chain?.length ? `<div class="chain" style="margin-top:12px">${p.architecture.chain.map(x => `<span>${esc(x)}</span>`).join('<i>→</i>')}</div>` : ''}
    ${p.architecture?.boundary ? `<p class="note" style="margin-top:12px">产权分界：${esc(p.architecture.boundary)} ${srcTags(p.architecture.boundarySrc)}</p>` : ''}
    ${p.access?.length ? `<dl class="kv" style="margin-top:16px"><dt>接入方式</dt><dd>${p.access.map(esc).join('；')} ${srcTags(p.accessSrc || '')}</dd>
      ${p.devices?.length ? `<dt>核心设备</dt><dd>${p.devices.map(esc).join('；')} ${srcTags(p.devicesSrc || '')}</dd>` : ''}
      ${p.services?.length ? `<dt>服务能力</dt><dd>${p.services.map(esc).join('；')} ${srcTags(p.servicesSrc || '')}</dd>` : ''}</dl>` : ''}
    ${mainDemo ? '<div class="embed" style="margin-top:18px"></div>' : ''}`);
  if (p.migration) sec('migration', p.migration.title, `<ul class="ticks">${p.migration.points.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="note" style="margin-top:12px">${esc(p.migration.case)} ${srcTags(p.migration.src)}</p>`);
  sec('scenarios', '应用场景', p.scenarios?.length ? listCards(p.scenarios, 'grid c3') : '');
  sec('advantages', '产品优势', p.advantages?.length ? listCards(p.advantages, 'grid c3') : '');
  sec('limits', '使用限制与适用条件', p.limits?.length ? `<ul class="ticks warn">${p.limits.map(x => `<li>${esc(x.text)} ${x.status === 'conflict' ? stBadge('conflict') : ''} ${srcTags(x.src)}</li>`).join('')}</ul>` : '');
  sec('diff', '与其他产品的差异', p.diff?.length ? `<div class="grid c2">${p.diff.map(d => `<div class="card" style="padding:16px 18px"><div class="chips">${prodLink(d.vs)}</div><p style="margin-top:8px">${esc(d.text)}</p><div style="margin-top:8px">${srcTags(d.src)}</div></div>`).join('')}</div><a class="btn sm" style="margin-top:12px" href="#/compare">进入产品对比</a>` : '');
  sec('cases', '相关案例', cases.length ? `<div class="grid c2">${cases.map(cs => `<div class="card case ${cs.type}" style="padding:16px 18px"><div class="chips"><span class="chip">${esc(cs.ind.name)}</span>${caseType(cs.type)}</div><h3 style="font-size:var(--fs-md);margin-top:8px">${esc(cs.title)}</h3><p style="margin-top:6px">${esc(cs.summary)}</p><div style="margin-top:8px">${srcTags(cs.src)}</div></div>`).join('')}</div>` : '');
  if (p.teacher) sec('teacher', '讲师提示', `<dl class="kv"><dt>先讲</dt><dd>${esc(p.teacher.open)}</dd><dt>突出</dt><dd>${esc(p.teacher.highlight)}</dd><dt>展示</dt><dd>${esc(p.teacher.show)}</dd><dt>解释</dt><dd>${esc(p.teacher.explain)}</dd><dt>引出</dt><dd>${esc(p.teacher.bridge)}</dd></dl>`);
  sec('sources', '资料来源', `<ul class="ticks" style="--c:var(--ink-400)">${(p.src || []).map(id => { const d = db.sources.get(id); return d ? `<li><a href="#/sources?doc=${id}">${id}</a> 《${esc(d.title)}》 <span class="muted">${esc(d.issuer)} · ${esc(d.date)} · ${esc(d.scope)}</span></li>` : ''; }).join('')}</ul>`);

  const idx = db.products.indexOf(p);
  const prevP = db.products[(idx - 1 + db.products.length) % db.products.length];
  const nextP = db.products[(idx + 1) % db.products.length];
  view.innerHTML = `<div class="page">
    <nav class="trail" aria-label="位置"><a href="#/products">产品中心</a><span>/</span><a href="#/products?cat=${p.category}">${esc(c?.name || '')}</a><span>/</span><span>${esc(p.name)}</span></nav>
    <header class="card" style="margin-top:12px;border-top:4px solid var(--${catTone(p.category)})">
      <div class="chips">${catChip(p.category)}${scopeChip(p)}<span class="chip outline">${esc(p.status)}</span></div>
      <h1 style="font-size:var(--fs-2xl);margin-top:10px">${esc(p.name)}</h1>
      <dl class="kv" style="margin-top:10px">
        ${p.aka?.length ? `<dt>别名 / 简称</dt><dd>${p.aka.map(esc).join(' / ')}</dd>` : ''}
        ${p.en ? `<dt>英文名称</dt><dd>${esc(p.en)}</dd>` : ''}
        <dt>品牌</dt><dd>${esc(p.brand)} ${srcTags(p.brandSrc || '')}</dd>
        ${p.code ? `<dt>产品编码</dt><dd>${esc(p.code)} ${srcTags(p.codeSrc || '')}</dd>` : ''}
        <dt>适用范围</dt><dd>${esc(p.scopeNote)}</dd>
      </dl>
      <p style="margin-top:12px;font-size:var(--fs-lg);color:var(--ink-700)">${esc(p.tagline)} ${srcTags(p.taglineSrc || '')}</p>
      <div class="hero-actions" style="margin-top:14px">${demos.filter(d => d.kind !== 'industry').map(d => `<a class="btn primary" href="#/demo/${d.id}">${icon.play} ${esc(d.title.split('：')[0])}演示</a>`).slice(0, 2).join('')}<a class="btn" href="#/compare">产品对比</a></div>
    </header>
    <div class="detail" style="margin-top:24px">
      <div>${sections.map(s => `<section class="section" id="sec-${s.id}" style="margin-top:28px"><h2>${esc(s.title)}</h2>${s.html}</section>`).join('')}
        <nav class="grid c2" style="margin-top:36px" aria-label="上一个/下一个产品">
          <a class="card" href="#/product/${prevP.id}" style="text-decoration:none"><span class="muted">← 上一个产品</span><h3>${esc(prevP.name)}</h3></a>
          <a class="card" href="#/product/${nextP.id}" style="text-decoration:none;text-align:right"><span class="muted">下一个产品 →</span><h3>${esc(nextP.name)}</h3></a>
        </nav></div>
      <nav class="toc" aria-label="本页目录"><b>本页目录</b>${sections.map(s => `<a href="#sec-${s.id}" data-anchor="sec-${s.id}">${esc(s.title)}</a>`).join('')}</nav>
    </div></div>`;
  view.querySelectorAll('[data-anchor]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); document.getElementById(a.dataset.anchor)?.scrollIntoView({ behavior: 'smooth' }); }));
  let embed = null;
  const host = view.querySelector('.embed');
  if (host && mainDemo) embed = mountPlayer(host, mainDemo, { mode: 'compact', headingTag: 'h3', eyebrow: '动态演示（可在此直接分步讲解）' });
  return {
    destroy: () => embed?.destroy(),
    keys: { prev: () => { location.hash = `#/product/${prevP.id}`; }, next: () => { location.hash = `#/product/${nextP.id}`; } },
    title: p.name
  };
}

export function caseType(t) {
  return { official: '<span class="chip brand">正式案例</span>', anonymized: '<span class="chip tunnel">资料脱敏案例</span>', training: '<span class="chip security">培训材料案例 · 需业务确认</span>' }[t] || '';
}
