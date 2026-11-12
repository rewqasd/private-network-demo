#!/usr/bin/env node
'use strict';
/*
 * V4.0 端到端测试（Playwright）
 * 用法：
 *   node tests/private_network_demo_v4_test.js                 # 自动启动本地服务器测试
 *   node tests/private_network_demo_v4_test.js <线上地址>       # 测试线上部署，如 https://rewqasd.github.io/private-network-demo/
 * 选项：--out=<目录> 截图与结果输出目录（默认 tests/output）；--browser=chromium|webkit；--skip-layout 跳过逐步布局检测
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { loadPlaywright, startServer, launch } = require('./helpers');

const args = process.argv.slice(2);
const opt = k => (args.find(a => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(opt('out') || path.join(__dirname, 'output'));
const BROWSER = opt('browser') || 'chromium';
const SIZES = [[1920, 1080], [1600, 900], [1366, 768], [768, 1024], [390, 844]];
fs.mkdirSync(path.join(OUT, 'screens'), { recursive: true });

const data = {};
for (const f of fs.readdirSync(path.join(ROOT, 'data'))) if (f.endsWith('.json')) data[f.replace('.json', '')] = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'));
const products = data.products.products;
const demos = [...data.topologies.demos, ...data['topologies-industry'].demos];

const results = [];
const record = (group, name, ok, detail = '') => {
  results.push({ group, name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${group}] ${name}${detail ? ' — ' + detail : ''}`);
};
const ONLY = opt('only');
async function check(group, name, fn) {
  if (ONLY && !`${group} ${name}`.includes(ONLY)) return;
  try { const d = await fn(); record(group, name, true, d || ''); } catch (e) { record(group, name, false, String(e.message || e).split('\n')[0]); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const PLACEHOLDER = /产品\s?[A-D](?![A-Za-z0-9])|(?<![A-Za-z0-9])[A-D]\s?产品|某安全专线|某品牌|某运营商产品|某型号设备/;

function expectedVisible(scene, i) {
  const vis = new Set(scene.base || []);
  for (let k = 0; k <= i; k++) {
    (scene.steps[k].add || []).forEach(id => vis.add(id));
    (scene.steps[k].remove || []).forEach(id => vis.delete(id));
  }
  const nodeIds = new Set((scene.nodes || []).map(n => n.id));
  return [...vis].filter(id => nodeIds.has(id)).sort();
}

(async () => {
  const pw = loadPlaywright();
  let server = null;
  let base = args.find(a => /^https?:\/\//.test(a));
  if (!base) { server = await startServer(8792); base = server.base; }
  if (!base.endsWith('/')) base += '/';
  const online = !server;
  console.log(`测试地址：${base}（${online ? '线上' : '本地'}，浏览器 ${BROWSER}）`);
  const browser = await launch(pw, BROWSER);
  const errors = [];
  const badResponses = [];

  async function newPage(w = 1920, h = 1080, extra = {}) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...extra });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`pageerror ${e.message}`));
    page.on('console', m => { if (m.type() === 'error' && !/favicon\.ico/.test(m.location()?.url || '')) errors.push(`console ${m.text()} @ ${m.location()?.url || ''}`); });
    page.on('response', r => { if (r.url().startsWith(new URL(base).origin) && r.status() >= 400 && !/favicon\.ico$/.test(r.url())) badResponses.push(`${r.status()} ${r.url()}`); });
    return page;
  }
  async function open(page, hash) {
    await page.goto(`${base}${hash ? '#' + hash : ''}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('html[data-ready="true"]', { timeout: 15000 });
    const route = (hash || '/').split('?')[0];
    await page.waitForFunction(r => document.documentElement.dataset.route === r, route, { timeout: 15000 });
    await page.waitForTimeout(80);
  }
  const stepOf = page => page.evaluate(() => {
    const m = (document.querySelector('.player .narr .no')?.textContent || '').match(/第\s*(\d+)\s*\/\s*(\d+)/);
    return m ? [Number(m[1]), Number(m[2])] : [0, 0];
  });
  const waitStep = (page, n) => page.waitForFunction(k => (document.querySelector('.player .narr .no')?.textContent || '').includes(`第 ${k} /`), n, { timeout: 15000 });
  const dotPos = page => page.evaluate(() => [...document.querySelectorAll('.player .tf-dots:not(.is-hidden) .tf-dot')].slice(0, 4).map(c => `${c.getAttribute('cx')},${c.getAttribute('cy')}`).join('|'));

  const page = await newPage();

  /* ---------- A 加载与导航 ---------- */
  await check('导航', '首页加载：产品全景地图与 18 个产品入口', async () => {
    await open(page, '/');
    const n = await page.locator('svg.panorama a.pm-chip').count();
    assert(n === products.length, `全景地图产品链接 ${n} 个，应为 ${products.length}`);
    const h1 = await page.locator('h1').first().innerText();
    return `全景链接 ${n} 个；标题“${h1.replace(/\s+/g, '')}”`;
  });
  await check('导航', '主导航 8 个入口逐一打开', async () => {
    const navs = await page.$$eval('#nav a', as => as.map(a => [a.dataset.nav, a.textContent.trim()]));
    assert(navs.length === 8, `导航 ${navs.length} 项`);
    for (const [key, label] of navs) {
      await page.click(`#nav a[data-nav="${key}"]`);
      await page.waitForFunction(k => document.querySelector(`#nav a[data-nav="${k}"]`)?.getAttribute('aria-current') === 'page', key);
      const h = await page.locator('#view h1').first().innerText();
      assert(h.trim().length > 0, `${label} 页面无标题`);
    }
    return navs.map(x => x[1]).join(' / ');
  });
  await check('导航', '深链刷新不 404（hash 路由）', async () => {
    await open(page, '/product/premium-network');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('html[data-ready="true"]');
    const h1 = await page.locator('#view h1').first().innerText();
    assert(h1.includes('政企精品网'), `刷新后标题为 ${h1}`);
    return '刷新后仍为“政企精品网”详情';
  });
  await check('导航', 'V3 历史深链 ?page=10 自动跳转到 /v3/', async () => {
    const p2 = await newPage();
    await p2.goto(`${base}?page=10`, { waitUntil: 'networkidle' });
    await p2.waitForTimeout(600);
    const url = p2.url();
    const title = await p2.locator('#pageTitle').innerText().catch(() => '');
    await p2.context().close();
    assert(/\/v3\/\?page=10/.test(url), `跳转后 URL ${url}`);
    assert(title.includes('政务'), `V3 页面标题 ${title}`);
    return `→ ${url.replace(base, '')}，V3 标题“${title}”`;
  });

  /* ---------- B 产品中心 ---------- */
  await check('产品中心', '产品卡片总数与分类筛选', async () => {
    await open(page, '/products');
    const all = await page.locator('.plist .pcard').count();
    assert(all === products.length, `卡片 ${all}`);
    await page.click('.catlist [data-cat="security"]');
    const sec = await page.locator('.plist .pcard').count();
    assert(sec === products.filter(p => p.category === 'security').length, `网络安全 ${sec}`);
    await page.click('.catlist [data-cat="all"]');
    await page.fill('input[type=search]', '云联网');
    const kw = await page.locator('.plist .pcard h3').allInnerTexts();
    assert(kw.some(t => t.includes('云联网')), '搜索无结果');
    return `全部 ${all}；网络安全 ${sec}；搜索“云联网”命中 ${kw.length}`;
  });
  await check('产品中心', '快捷键不干扰输入框（在搜索框输入 p/f）', async () => {
    await page.fill('input[type=search]', '');
    await page.focus('input[type=search]');
    await page.keyboard.type('pf');
    const presenter = await page.evaluate(() => document.body.classList.contains('presenter'));
    assert(!presenter, '在输入框内按 P 触发了讲师模式');
    return '输入框内按键未触发快捷键';
  });
  for (const p of products) {
    await check('产品详情', `${p.name}`, async () => {
      await open(page, `/product/${p.id}`);
      const h1 = (await page.locator('#view h1').first().innerText()).trim();
      assert(h1 === p.name, `标题“${h1}”与正式名称“${p.name}”不一致`);
      const params = (data.parameters.params[p.id] || []).length;
      const rows = await page.locator('#sec-params tbody tr:not(.grp)').count();
      assert(rows === params, `参数行 ${rows}，数据 ${params}`);
      const srcs = await page.locator('#view .src').count();
      assert(srcs > 0, '无资料出处标注');
      const txt = await page.locator('#view').innerText();
      const ph = txt.match(PLACEHOLDER);
      assert(!ph, `出现匿名化占位：${ph && ph[0]}`);
      if (p.aka?.length) assert(txt.includes(p.aka[0]), '别名未展示');
      return `参数 ${rows} 项，出处标注 ${srcs} 处${p.demos?.length ? '，含内嵌演示' : ''}`;
    });
  }
  await check('产品详情', '方向键切换上一个/下一个产品', async () => {
    await open(page, '/product/dia');
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => location.hash === '#/product/security-line');
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => location.hash === '#/product/dia');
    return '互联网专线 → 互联网安全专线 → 互联网专线';
  });

  /* ---------- C 动态演示：每套、每个场景 ---------- */
  for (const d of demos) {
    for (const sc of d.scenes) {
      await check('动态演示', `${d.title} · ${sc.title}`, async () => {
        await open(page, `/demo/${d.id}?scene=${sc.id}`);
        await waitStep(page, 1);
        const [, total] = await stepOf(page);
        assert(total === sc.steps.length, `步骤数 ${total}，数据 ${sc.steps.length}`);
        const svgOk = await page.locator('.player .stage svg.topo').count();
        assert(svgOk === 1, '未渲染 SVG');
        for (let i = 2; i <= total; i++) { await page.keyboard.press('ArrowRight'); await waitStep(page, i); }
        const nextDisabled = await page.locator('.player [data-act="next"]').isDisabled();
        assert(nextDisabled, '最后一步“下一步”未禁用');
        const vis = await page.$$eval('.player svg.topo :is(.tn,.tm):not(.is-hidden)', els => els.map(e => e.dataset.id).sort());
        const exp = expectedVisible(sc, sc.steps.length - 1);
        assert(JSON.stringify(vis) === JSON.stringify(exp), `末步可见节点不一致：页面 ${vis.length} / 数据 ${exp.length}`);
        await page.keyboard.press('ArrowLeft');
        await waitStep(page, total - 1);
        const narr = await page.locator('.player .narr h3').innerText();
        assert(narr === sc.steps[total - 2].t, `回退后讲解“${narr}”`);
        return `${total} 步逐步播放与回退正常，末步 ${vis.length} 个设备节点与数据一致`;
      });
    }
  }

  await check('演示控制', '播放 / 暂停 / 速度 / 重播 / 数字跳转 / Home·End', async () => {
    await open(page, '/demo/security-line?scene=ddos');
    await waitStep(page, 1);
    await page.click('.player .speed [data-speed="2"]');
    await page.keyboard.press(' ');
    await page.waitForFunction(() => document.querySelector('.player [data-act="toggle"]').textContent.includes('暂停'));
    await waitStep(page, 2);
    const moving1 = await dotPos(page); await page.waitForTimeout(450); const moving2 = await dotPos(page);
    assert(moving1 !== moving2, '播放中流量光点未移动');
    await page.keyboard.press(' ');
    await page.waitForFunction(() => document.querySelector('.player [data-act="toggle"]').textContent.includes('继续'));
    const f1 = await dotPos(page); await page.waitForTimeout(450); const f2 = await dotPos(page);
    assert(f1 === f2, '暂停后光点仍在移动');
    await page.keyboard.press('5'); await waitStep(page, 5);
    await page.keyboard.press('End'); await waitStep(page, 7);
    await page.keyboard.press('Home'); await waitStep(page, 1);
    await page.keyboard.press('r');
    await page.waitForFunction(() => document.querySelector('.player [data-act="toggle"]').textContent.includes('暂停'));
    await page.keyboard.press(' ');
    const pressed = await page.locator('.player .speed [aria-pressed="true"]').innerText();
    assert(pressed.includes('2'), `速度按钮状态 ${pressed}`);
    return '自动播放推进、暂停冻结动画、2× 速度、5 / End / Home / R 均生效';
  });
  await check('演示控制', '节点点击说明与路径高亮', async () => {
    await open(page, '/demo/premium-network?scene=protect&step=4');
    await waitStep(page, 4);
    await page.locator('.player svg.topo .tn.is-clickable:not(.is-hidden)').first().click();
    await page.waitForSelector('.player .nodeinfo:not([hidden])');
    const info = await page.locator('.player .nodeinfo').innerText();
    await page.locator('.player [data-flow]').first().click();
    const hl = await page.evaluate(() => document.querySelector('.player svg.topo').classList.contains('has-hl'));
    assert(hl, '路径高亮未生效');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    const cleared = await page.evaluate(() => !document.querySelector('.player svg.topo').classList.contains('has-hl') && document.querySelector('.player .nodeinfo').hidden);
    assert(cleared, 'Esc 未关闭说明/高亮');
    return `节点说明“${info.split('\n')[0]}”；高亮与 Esc 关闭正常`;
  });
  await check('演示控制', '场景切换与深链步骤（刷新保持）', async () => {
    await open(page, '/demo/cloud-connect?scene=multicloud&step=4');
    await waitStep(page, 4);
    const sel = await page.locator('.player [data-scene][aria-selected="true"]').innerText();
    assert(sel.includes('一点接入'), `当前场景 ${sel}`);
    await page.reload({ waitUntil: 'networkidle' });
    await waitStep(page, 4);
    await page.click('.player [data-scene="compare"]');
    await waitStep(page, 1);
    const url = page.url();
    assert(!url.includes('step='), 'URL 未同步');
    return '深链 step=4 刷新后保持；切换场景回到第 1 步并同步地址栏';
  });
  await check('演示控制', '讲师模式（P）、讲师提示（T）、快捷键说明（?）', async () => {
    await open(page, '/demo/dia?step=5');
    await waitStep(page, 5);
    await page.keyboard.press('p');
    await page.keyboard.press('t');
    const st = await page.evaluate(() => ({ p: document.body.classList.contains('presenter'), t: document.body.classList.contains('show-teacher'), pop: getComputedStyle(document.querySelector('.player .teacher-pop')).display }));
    assert(st.p && st.t && st.pop !== 'none', `讲师模式状态 ${JSON.stringify(st)}`);
    const stageW = await page.evaluate(() => document.querySelector('.player .stage').getBoundingClientRect().width);
    await page.keyboard.press('Shift+Slash');
    await page.waitForSelector('.overlay .dialog');
    await page.keyboard.press('Escape');
    assert(await page.locator('.overlay').count() === 0, '说明弹层未关闭');
    await page.keyboard.press('p');
    const off = await page.evaluate(() => document.body.classList.contains('presenter'));
    assert(!off, '再次按 P 未退出讲师模式');
    return `讲师模式下拓扑宽 ${Math.round(stageW)}px；提示浮层、快捷键说明、退出均正常`;
  });
  await check('演示控制', '全屏（F）', async () => {
    await open(page, '/demo/smart-dia');
    await waitStep(page, 1);
    await page.keyboard.press('f');
    await page.waitForTimeout(500);
    const fs1 = await page.evaluate(() => (document.fullscreenElement || document.webkitFullscreenElement)?.className || '');
    await page.evaluate(() => document.fullscreenElement && document.exitFullscreen());
    assert(fs1.includes('player'), `全屏元素“${fs1}”`);
    return '演示区进入浏览器全屏';
  });
  await check('演示控制', '减少动态效果（prefers-reduced-motion）', async () => {
    const p3 = await newPage(1920, 1080, { reducedMotion: 'reduce' });
    await open(p3, '/demo/security-line?scene=ddos&step=3');
    const r = await p3.evaluate(() => ({ cls: document.querySelector('.player svg.topo').classList.contains('reduced'), arrows: document.querySelectorAll('.player .tf-track[marker-end]').length }));
    await p3.context().close();
    assert(r.cls && r.arrows > 0, JSON.stringify(r));
    return `静态箭头替代动画（${r.arrows} 条流量轨迹带方向箭头）`;
  });

  /* ---------- D 网络技术中心 / E 行业方案 ---------- */
  for (const t of data.glossary.topics) {
    await check('网络技术', t.title, async () => {
      await open(page, `/network/${t.id}`);
      await waitStep(page, 1);
      const scene = await page.locator('.player [data-scene][aria-selected="true"]').innerText().catch(() => '');
      const terms = await page.locator('.section .card').count();
      assert(terms > 0, '无术语卡片');
      return `演示场景“${scene || '单场景'}”，术语 ${terms} 条`;
    });
  }
  for (const ind of data.scenarios.industries) {
    await check('行业方案', ind.name, async () => {
      await open(page, `/industry/${ind.id}`);
      await waitStep(page, 1);
      const rows = await page.locator('.table tbody tr').count();
      assert(rows === ind.products.length, `产品组合 ${rows} 行`);
      const names = await page.locator('.table tbody td:first-child').allInnerTexts();
      ind.products.forEach((x, i) => assert(names[i].trim() === products.find(p => p.id === x.id).name, `产品名“${names[i]}”`));
      const cases = await page.locator('.case').count();
      assert(cases === ind.cases.length, `案例 ${cases}`);
      return `产品组合 ${rows} 个（正式名称），资料案例 ${cases} 个`;
    });
  }

  /* ---------- F 对比 / G 营销 / H 测验 / I 资料 ---------- */
  await check('产品对比', '六张同口径对比表与自选对比', async () => {
    await open(page, '/compare');
    for (const t of data.comparison.tables) {
      await page.click(`[data-t="${t.id}"]`);
      const rows = await page.locator('.cmp tbody tr').count();
      assert(rows === t.rows.length, `${t.id} 行数 ${rows}`);
    }
    await page.click('[data-t="custom"]');
    await page.click('[data-pick="premium-network"]');
    const cols = await page.locator('.cmp thead th').count();
    assert(cols >= 4, `自选对比列数 ${cols}`);
    return `${data.comparison.tables.length} 张表行数与数据一致；自选对比 ${cols - 1} 个产品`;
  });
  await check('营销实战', '需求识别决策树、SPIN、异议、FAQ', async () => {
    await open(page, '/sales');
    await page.click('.opt >> text=总部、分支、数据中心之间内部互通');
    await page.click('.opt >> text=是，关键业务不能与公网流量混跑');
    await page.click('.opt >> text=是，设备用了很多年');
    const res = await page.locator('.result').innerText();
    assert(res.includes('政企精品网'), `推荐结果 ${res.slice(0, 40)}`);
    await page.click('[data-s="spin"]');
    const spinTabs = await page.locator('[data-spin]').count();
    await page.click('[data-s="objections"]');
    const obj = await page.locator('details.acc').count();
    await page.click('[data-s="faq"]');
    const faq = await page.locator('details.acc').count();
    assert(spinTabs === data.sales.spin.length && obj === data.sales.objections.length && faq === data.sales.faq.length, '数量不一致');
    return `决策树推荐“SDH / MSTP + 政企精品网”；SPIN ${spinTabs} 套、异议 ${obj} 条、FAQ ${faq} 条`;
  });
  await check('课堂互动', '全部题目作答、交卷、得分统计', async () => {
    await open(page, '/quiz');
    await page.click('[data-start]');
    let answered = 0;
    for (;;) {
      const stem = (await page.locator('.quiz h2').innerText()).trim();
      const q = data.quiz.questions.find(x => x.q === stem);
      assert(q, `题目未在题库中：${stem}`);
      await page.click(`[data-ans="${q.answer}"]`);
      answered++;
      const ok = await page.locator('.quiz .result').count();
      assert(ok === 1, '练习模式未显示正确解析');
      if (await page.locator('[data-finish]').count()) { await page.click('[data-finish]'); break; }
      await page.click('[data-nav="1"]');
    }
    const score = await page.locator('.score').innerText();
    assert(score.replace(/\s+/g, '').startsWith(`${answered}/${answered}`), `得分 ${score}`);
    return `练习模式 ${answered} 题全部答对，得分 ${score.replace(/\s+/g, ' ')}`;
  });
  await check('资料口径', '资料登记表与差异清单', async () => {
    await open(page, '/sources?doc=S13');
    const docs = await page.locator('tr[id^="doc-"]').count();
    const conf = await page.locator('section:has(h2:text-matches("资料差异")) tbody tr').count();
    assert(docs === data.sources.docs.length, `资料 ${docs}`);
    assert(conf === data.meta.conflicts.length, `差异 ${conf}`);
    return `资料 ${docs} 份，差异与处理 ${conf} 项`;
  });

  /* ---------- J 安全与内容 ---------- */
  await check('安全', '公开文件不含文档链接、凭据、手机号、个人邮箱', async () => {
    const files = [];
    const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
      if (['.git', 'node_modules', 'output', 'v3'].includes(e.name)) return;
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f); else if (/\.(html|js|mjs|css|json|md|svg)$/.test(e.name)) files.push(f);
    });
    walk(ROOT);
    const bad = [];
    const pats = [/kdocs\.cn|wps\.cn\/|link_id|file_id/i, /(?<![\d.])1[3-9]\d{9}(?![\d])/, /(?:token|secret|password|apikey)\s*[:=]\s*['"][^'"]{6,}/i, /@chinaunicom\.cn/i, /gh[pousr]_[A-Za-z0-9]{20,}/];
    for (const f of files) {
      if (f.endsWith(path.join('tests', 'private_network_demo_v4_test.js')) || f.endsWith('validate_data.mjs')) continue;
      const s = fs.readFileSync(f, 'utf8');
      pats.forEach(re => { const m = s.match(re); if (m) bad.push(`${path.relative(ROOT, f)}: ${m[0]}`); });
    }
    assert(!bad.length, bad.join('；'));
    return `扫描 ${files.length} 个文件，无敏感信息`;
  });

  /* ---------- K 多分辨率视觉 ---------- */
  const pages = [['home', '/'], ['products', '/products'], ['product', '/product/premium-network'], ['demo', '/demo/security-line?scene=ddos&step=5'], ['industry', '/industry/finance'], ['compare', '/compare'], ['sales', '/sales'], ['quiz', '/quiz'], ['network', '/network/otn']];
  for (const [w, h] of SIZES) {
    await check('多分辨率', `${w}×${h}`, async () => {
      const p = await newPage(w, h);
      const notes = [];
      for (const [name, hash] of pages) {
        await open(p, hash);
        if (hash.includes('step=')) await p.waitForTimeout(500);
        const m = await p.evaluate(() => {
          const r = { overflow: document.documentElement.scrollWidth - innerWidth };
          const stage = document.querySelector('.player .stage svg.topo');
          if (stage) {
            const ctm = stage.getScreenCTM();
            r.labelPx = +(17 * ctm.a).toFixed(1);
            const c = document.querySelector('.player .controls').getBoundingClientRect();
            r.controlsBottom = Math.round(c.bottom);
            const s = document.querySelector('.player .stage-wrap').getBoundingClientRect();
            r.stageRight = Math.round(s.right);
          }
          return r;
        });
        assert(m.overflow <= 1, `${name} 页面横向溢出 ${m.overflow}px`);
        if (m.labelPx !== undefined) {
          assert(m.labelPx >= 10.5, `${name} 拓扑文字仅 ${m.labelPx}px`);
          assert(m.stageRight <= w + 1, `${name} 拓扑区超出视口`);
          if (w >= 1366 && ['demo', 'industry', 'network'].includes(name)) assert(m.controlsBottom <= h, `${name} 控制条在首屏外（${m.controlsBottom} > ${h}）`);
          notes.push(`${name} 文字 ${m.labelPx}px`);
        }
        await p.screenshot({ path: path.join(OUT, 'screens', `${w}x${h}_${name}.png`) });
      }
      await p.context().close();
      return `${pages.length} 个页面无横向溢出；${notes.join('，')}`;
    });
  }

  /* ---------- L 运行期错误与资源 ---------- */
  await check('运行期', '控制台错误与资源加载', async () => {
    const uniqErr = [...new Set(errors)];
    const uniqBad = [...new Set(badResponses)];
    assert(!uniqErr.length, uniqErr.slice(0, 3).join(' | '));
    assert(!uniqBad.length, uniqBad.slice(0, 3).join(' | '));
    return '全程无控制台错误、无 4xx/5xx 资源';
  });

  await browser.close();

  /* ---------- M 逐步布局碰撞检测 ---------- */
  if (!args.includes('--skip-layout') && (!ONLY || '布局'.includes(ONLY))) {
    await check('布局', '全部演示逐步骤文字/元素碰撞检测', async () => {
      const r = spawnSync(process.execPath, [path.join(__dirname, 'layout_lint.js'), base], { encoding: 'utf8' });
      const last = (r.stdout || '').trim().split('\n').pop();
      assert(r.status === 0, `${last}；${(r.stdout || '').split('\n').filter(l => l.startsWith('LAYOUT')).slice(0, 2).join('；')}`);
      return last;
    });
  }

  server?.stop();
  const pass = results.filter(r => r.ok).length;
  const summary = { base, browser: BROWSER, online, at: new Date().toISOString(), total: results.length, pass, fail: results.length - pass, results };
  fs.writeFileSync(path.join(OUT, `results-${online ? 'online' : 'local'}-${BROWSER}.json`), JSON.stringify(summary, null, 2));
  console.log(`\n合计 ${results.length} 项：通过 ${pass}，失败 ${results.length - pass}。截图与结果：${OUT}`);
  process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error('FAILED', e); process.exit(1); });
