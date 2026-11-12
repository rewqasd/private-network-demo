/* 数据加载与索引。所有内容来自 data/*.json，页面代码不硬编码产品信息。 */
export const VERSION = '4.0.0';
const FILES = ['meta', 'sources', 'categories', 'products', 'parameters', 'comparison', 'scenarios', 'sales', 'quiz', 'glossary', 'topologies', 'topologies-industry'];

export const db = {};

export async function loadData() {
  const results = await Promise.all(FILES.map(async f => {
    const res = await fetch(`data/${f}.json?v=${VERSION}`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${f}.json 加载失败（HTTP ${res.status}）`);
    return [f, await res.json()];
  }));
  const raw = Object.fromEntries(results);
  db.meta = raw.meta;
  db.sources = new Map(raw.sources.docs.map(d => [d.id, d]));
  db.categories = raw.categories.categories.slice().sort((a, b) => a.order - b.order);
  db.catMap = new Map(db.categories.map(c => [c.id, c]));
  db.scopes = raw.categories.scopes;
  db.products = raw.products.products;
  db.prodMap = new Map(db.products.map(p => [p.id, p]));
  db.params = raw.parameters.params;
  db.paramNote = raw.parameters.note;
  db.compare = raw.comparison;
  db.industries = raw.scenarios.industries;
  db.indMap = new Map(db.industries.map(i => [i.id, i]));
  db.sales = raw.sales;
  db.quiz = raw.quiz;
  db.glossary = raw.glossary.terms;
  db.topics = raw.glossary.topics || [];
  db.demos = [...raw.topologies.demos, ...raw['topologies-industry'].demos];
  db.demoMap = new Map(db.demos.map(d => [d.id, d]));
  return db;
}

export const product = id => db.prodMap.get(id);
export const category = id => db.catMap.get(id);
export const demo = id => db.demoMap.get(id);
export const industry = id => db.indMap.get(id);

/** 把“S01:P6; S05:四(一)”解析为 [{id, loc, doc}] */
export function parseSrc(ref) {
  if (!ref) return [];
  return String(ref).split(';').map(s => s.trim()).filter(Boolean).map(part => {
    const i = part.indexOf(':');
    const id = (i < 0 ? part : part.slice(0, i)).trim();
    const loc = i < 0 ? '' : part.slice(i + 1).trim();
    return { id, loc, doc: db.sources.get(id) };
  });
}

/** 产品可用的主演示 */
export function demosForProduct(id) {
  return db.demos.filter(d => (d.products || []).includes(id));
}
