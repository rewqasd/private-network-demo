#!/usr/bin/env node
'use strict';
// 拓扑布局碰撞检测：逐演示、逐场景、逐步骤检查“文字被遮挡 / 元素重叠 / 超出画布”。
// 用法：node tests/layout_lint.js [baseUrl]   （不传 baseUrl 时自动启动本地服务器）
const { loadPlaywright, startServer, launch } = require('./helpers');

(async () => {
  const pw = loadPlaywright();
  let server = null;
  let base = process.argv[2];
  if (!base) { server = await startServer(8791); base = server.base; }
  const browser = await launch(pw);
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('html[data-ready="true"]');
  const demos = await page.evaluate(async () => {
    const a = await (await fetch('data/topologies.json')).json();
    const b = await (await fetch('data/topologies-industry.json')).json();
    return [...a.demos, ...b.demos].map(d => ({ id: d.id, scenes: d.scenes.map(s => ({ id: s.id, steps: s.steps.length })) }));
  });
  const problems = [];
  let checked = 0;
  for (const d of demos) {
    for (const sc of d.scenes) {
      for (let i = 0; i < sc.steps; i++) {
        await page.goto(`${base}#/demo/${d.id}?scene=${sc.id}&step=${i + 1}`);
        await page.waitForFunction(n => document.querySelector('.narr .no')?.textContent.includes(`第 ${n} /`), i + 1);
        await page.waitForTimeout(40);
        const found = await page.evaluate(() => {
          const svg = document.querySelector('.player .stage svg.topo');
          const vb = svg.viewBox.baseVal;
          const ctm = svg.getScreenCTM().inverse();
          const box = (el) => {
            const r = el.getBoundingClientRect();
            const p1 = new DOMPoint(r.left, r.top).matrixTransform(ctm);
            const p2 = new DOMPoint(r.right, r.bottom).matrixTransform(ctm);
            return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
          };
          const items = [];
          const push = (kind, id, el) => { if (el) items.push({ kind, id, ...box(el) }); };
          svg.querySelectorAll('.tn:not(.is-hidden)').forEach(n => {
            push('node', n.dataset.id, n.querySelector('.tn-plate'));
            push('label', n.dataset.id, n.querySelector('.tn-lab-bg'));
            push('badge', n.dataset.id, n.querySelector('.tn-badge rect'));
          });
          svg.querySelectorAll('.tc:not(.is-hidden)').forEach(n => push('callout', n.dataset.id, n.querySelector('.tc-box')));
          svg.querySelectorAll('.tm:not(.is-hidden)').forEach(n => push('meter', n.dataset.id, n.querySelector('.tm-card')));
          svg.querySelectorAll('.tl-lab:not(.is-hidden)').forEach(n => push('linklabel', n.dataset.id, n.querySelector('rect')));
          svg.querySelectorAll('.tz:not(.is-hidden)').forEach(n => push('zonelabel', n.dataset.id, n.querySelector('.tz-lab-bg')));
          const out = [];
          const area = (a, b) => Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1)) * Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
          const skip = (a, b) => (a.id === b.id && ['node', 'label', 'badge'].includes(a.kind) && ['node', 'label', 'badge'].includes(b.kind));
          for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
            const a = items[i], b = items[j];
            if (skip(a, b)) continue;
            if (a.kind === 'zonelabel' && b.kind === 'zonelabel') continue;
            const ov = area(a, b);
            if (ov > 14) out.push(`${a.kind}:${a.id} × ${b.kind}:${b.id}（重叠 ${Math.round(ov)}）`);
          }
          for (const it of items) {
            if (it.x1 < vb.x - 1 || it.y1 < vb.y - 1 || it.x2 > vb.x + vb.width + 1 || it.y2 > vb.y + vb.height + 1) out.push(`${it.kind}:${it.id} 超出画布 (${Math.round(it.x1)},${Math.round(it.y1)})-(${Math.round(it.x2)},${Math.round(it.y2)})`);
          }
          return out;
        });
        checked++;
        found.forEach(f => problems.push(`${d.id}/${sc.id} 步骤${i + 1}: ${f}`));
      }
    }
  }
  await browser.close();
  server?.stop();
  const uniq = [...new Set(problems)];
  uniq.forEach(p => console.log('LAYOUT', p));
  console.log(`已检查 ${demos.length} 套演示、${checked} 个步骤画面；发现 ${uniq.length} 处布局问题`);
  process.exit(uniq.length ? 1 : 0);
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
