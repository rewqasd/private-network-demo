#!/usr/bin/env node
// 数据完整性校验：node tests/validate_data.mjs
// 检查：JSON 可解析；产品/分类/资料引用有效；拓扑节点、链路、流量、步骤引用的 ID 均存在；
// 流量路径相邻节点之间存在链路；公开数据中不含在线文档链接、文件 ID、手机号或凭据样式字符串。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => JSON.parse(fs.readFileSync(path.join(root, 'data', f), 'utf8'));
const errors = [];
const warns = [];
const err = m => errors.push(m);
const warn = m => warns.push(m);

const files = fs.readdirSync(path.join(root, 'data')).filter(f => f.endsWith('.json'));
const data = {};
for (const f of files) {
  try { data[f] = read(f); } catch (e) { err(`${f} 解析失败：${e.message}`); }
}

const sources = new Set((data['sources.json']?.docs || []).map(d => d.id));
const cats = new Set((data['categories.json']?.categories || []).map(c => c.id));
const products = data['products.json']?.products || [];
const pids = new Set(products.map(p => p.id));

function checkSrc(where, ref) {
  if (!ref) return;
  for (const part of String(ref).split(';')) {
    const id = part.trim().split(':')[0].trim();
    if (id && !sources.has(id)) err(`${where}: 资料编号 ${id} 不在 sources.json`);
  }
}
function walkSrc(where, obj) {
  if (Array.isArray(obj)) obj.forEach((x, i) => walkSrc(`${where}[${i}]`, x));
  else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (/^(src|introSrc|customersSrc|needsSrc|servicesSrc|accessSrc|devicesSrc|brandSrc|codeSrc|taglineSrc|boundarySrc|serviceLayersSrc)$/.test(k) && typeof v === 'string') checkSrc(`${where}.${k}`, v);
      else if (k === 'src' && Array.isArray(v)) v.forEach(x => checkSrc(`${where}.src`, x));
      else walkSrc(`${where}.${k}`, v);
    }
  }
}

// 产品
for (const p of products) {
  if (!cats.has(p.category)) err(`产品 ${p.id}: 分类 ${p.category} 不存在`);
  for (const r of p.related || []) if (!pids.has(r)) err(`产品 ${p.id}: related ${r} 不存在`);
  for (const c of p.children || []) if (!pids.has(c)) err(`产品 ${p.id}: children ${c} 不存在`);
  if (p.parent && !pids.has(p.parent)) err(`产品 ${p.id}: parent ${p.parent} 不存在`);
  for (const d of p.diff || []) if (!pids.has(d.vs)) err(`产品 ${p.id}: diff.vs ${d.vs} 不存在`);
  if (!p.name || !p.intro) err(`产品 ${p.id}: 缺少名称或介绍`);
}
walkSrc('products', products);
for (const [pid, list] of Object.entries(data['parameters.json']?.params || {})) {
  if (!pids.has(pid)) err(`parameters: 产品 ${pid} 不存在`);
  list.forEach((x, i) => { checkSrc(`parameters.${pid}[${i}]`, x.src); if (!['ok', 'regional', 'old', 'conflict'].includes(x.st)) err(`parameters.${pid}[${i}] 状态非法 ${x.st}`); });
}
for (const t of data['comparison.json']?.tables || []) {
  checkSrc(`comparison.${t.id}`, t.src);
  for (const p of t.products || []) if (!pids.has(p)) err(`comparison.${t.id}: 产品 ${p} 不存在`);
  for (const r of t.rows) if (r.length !== t.headers.length + 1) err(`comparison.${t.id}: 行“${r[0]}”列数与表头不一致`);
}
for (const ind of data['scenarios.json']?.industries || []) {
  for (const x of ind.products) if (!pids.has(x.id)) err(`scenarios.${ind.id}: 产品 ${x.id} 不存在`);
  for (const c of ind.cases) { checkSrc(`scenarios.${ind.id}.case`, c.src); for (const p of c.products) if (!pids.has(p)) err(`scenarios.${ind.id}.case: 产品 ${p} 不存在`); if (!['official', 'anonymized', 'training'].includes(c.type)) err(`case 类型非法 ${c.type}`); }
  ind.needs.forEach(n => checkSrc(`scenarios.${ind.id}.needs`, n.src));
}
const sales = data['sales.json'];
if (sales) {
  for (const r of Object.values(sales.decision.results)) for (const p of r.products) if (!pids.has(p)) err(`sales.decision: 产品 ${p} 不存在`);
  for (const [k, n] of Object.entries(sales.decision.nodes)) for (const o of n.options) if (!sales.decision.nodes[o.next] && !sales.decision.results[o.next]) err(`sales.decision.${k}: 跳转 ${o.next} 不存在`);
  walkSrc('sales', sales);
  for (const s of sales.signals) if (!pids.has(s.product)) err(`sales.signals: 产品 ${s.product} 不存在`);
}
for (const q of data['quiz.json']?.questions || []) {
  checkSrc(`quiz.${q.id}`, q.src);
  if (q.answer < 0 || q.answer >= q.options.length) err(`quiz.${q.id}: 答案越界`);
}
walkSrc('glossary', data['glossary.json']);

// 拓扑
const demoIds = new Set();
for (const f of ['topologies.json', 'topologies-industry.json']) {
  for (const demo of data[f]?.demos || []) {
    if (demoIds.has(demo.id)) err(`拓扑 ${demo.id} 重复`);
    demoIds.add(demo.id);
    for (const p of demo.products || []) if (!pids.has(p)) err(`拓扑 ${demo.id}: 产品 ${p} 不存在`);
    for (const sc of demo.scenes) {
      const where = `${demo.id}/${sc.id}`;
      const ids = new Map();
      const add = (id, kind) => { if (ids.has(id)) err(`${where}: ID 重复 ${id}`); ids.set(id, kind); };
      (sc.zones || []).forEach(z => add(z.id, 'zone'));
      (sc.nodes || []).forEach(n => add(n.id, 'node'));
      (sc.links || []).forEach(l => add(l.id, 'link'));
      (sc.callouts || []).forEach(c => add(c.id, 'callout'));
      const flowIds = new Set((sc.flows || []).map(x => x.id));
      const kpiIds = new Set((sc.kpis || []).map(x => x.id));
      const nodeIds = new Set((sc.nodes || []).map(n => n.id));
      for (const n of sc.nodes || []) {
        if (n.x < 0 || n.x > 1280 || n.y < 0 || n.y > 720) err(`${where}: 节点 ${n.id} 超出画布`);
        if (n.info) checkSrc(`${where}.${n.id}.info`, n.info.src);
      }
      const pairs = new Set();
      for (const l of sc.links || []) {
        if (!nodeIds.has(l.a) || !nodeIds.has(l.b)) err(`${where}: 链路 ${l.id} 端点不存在`);
        pairs.add(`${l.a}|${l.b}`); pairs.add(`${l.b}|${l.a}`);
      }
      for (const fl of sc.flows || []) {
        fl.path.forEach(id => { if (!nodeIds.has(id)) err(`${where}: 流量 ${fl.id} 节点 ${id} 不存在`); });
        for (let i = 1; i < fl.path.length; i++) if (!pairs.has(`${fl.path[i - 1]}|${fl.path[i]}`)) warn(`${where}: 流量 ${fl.id} ${fl.path[i - 1]}→${fl.path[i]} 无对应链路（将按直线绘制）`);
      }
      for (const c of sc.callouts || []) if (typeof c.at === 'string' && !nodeIds.has(c.at)) err(`${where}: 标注 ${c.id} 锚点 ${c.at} 不存在`);
      sc.kpis?.forEach(k => checkSrc(`${where}.kpi.${k.id}`, k.src));
      const visible = new Set();
      (sc.steps || []).forEach((s, i) => {
        const w = `${where} 步骤${i + 1}`;
        for (const id of s.add || []) { if (!ids.has(id)) err(`${w}: add ${id} 不存在`); else if (ids.get(id) === 'callout') err(`${w}: 标注 ${id} 应放在 callouts`); visible.add(id); }
        for (const id of s.remove || []) { if (!ids.has(id)) err(`${w}: remove ${id} 不存在`); visible.delete(id); }
        for (const id of Object.keys(s.states || {})) if (!ids.has(id)) err(`${w}: states ${id} 不存在`);
        for (const id of Object.keys(s.meters || {})) if (!nodeIds.has(id)) err(`${w}: meters ${id} 不存在`);
        for (const id of s.flows || []) {
          if (!flowIds.has(id)) { err(`${w}: flow ${id} 不存在`); continue; }
          const fl = sc.flows.find(x => x.id === id);
          for (const nid of fl.path) if (!visible.has(nid)) warn(`${w}: 流量 ${id} 经过尚未显示的节点 ${nid}`);
        }
        for (const id of s.callouts || []) if (ids.get(id) !== 'callout') err(`${w}: callout ${id} 不存在`);
        for (const id of s.kpis || []) if (!kpiIds.has(id)) err(`${w}: kpi ${id} 不存在`);
        for (const id of s.focus || []) if (!ids.has(id)) err(`${w}: focus ${id} 不存在`);
        checkSrc(w, s.src);
        if (!s.t || !s.say) err(`${w}: 缺少标题或讲解`);
      });
    }
  }
}
for (const p of products) for (const d of p.demos || []) if (!demoIds.has(d)) err(`产品 ${p.id}: 演示 ${d} 不存在`);
for (const ind of data['scenarios.json']?.industries || []) if (!demoIds.has(ind.demo)) err(`行业 ${ind.id}: 演示 ${ind.demo} 不存在`);

// 公开数据安全检查
const blob = files.map(f => fs.readFileSync(path.join(root, 'data', f), 'utf8')).join('\n');
const leaks = [
  [/kdocs\.cn|wps\.cn|link_id|file_id/i, '在线文档链接或文件 ID'],
  [/(?<!\d)1[3-9]\d{9}(?!\d)/, '手机号'],
  [/(?:token|secret|password|apikey|api_key)\s*[:=]/i, '凭据样式字符串'],
  [/@chinaunicom\.cn/i, '个人邮箱']
];
for (const [re, label] of leaks) if (re.test(blob)) err(`公开数据中疑似包含${label}：${blob.match(re)[0]}`);

const n = (data['topologies.json']?.demos.length || 0) + (data['topologies-industry.json']?.demos.length || 0);
console.log(`产品 ${products.length} 个；演示 ${n} 套；资料 ${sources.size} 份；题目 ${data['quiz.json']?.questions.length || 0} 道`);
warns.forEach(w => console.log('WARN', w));
if (errors.length) { errors.forEach(e => console.log('ERROR', e)); console.log(`FAILED ${errors.length} 个错误`); process.exit(1); }
console.log('OK 数据校验通过');
