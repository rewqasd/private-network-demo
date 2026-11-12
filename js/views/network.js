/* 04 网络技术中心 */
import { db } from '../store.js';
import { esc, srcTags } from '../ui.js';
import { mountPlayer } from '../components/demo-player.js';

export function render(view, { params }) {
  const topics = db.topics;
  const t = topics.find(x => x.id === params.topic) || topics[0];
  const d = db.demoMap.get(t.demo);
  const terms = db.glossary.filter(g => t.terms.includes(g.topic));
  view.innerHTML = `<div class="page demo-page has-topicbar">
    <div class="eyebrow" style="margin-top:6px">04 网络技术中心</div>
    <div class="topicbar" role="group" aria-label="技术主题">
      ${topics.map(x => `<button data-topic="${x.id}" aria-pressed="${x.id === t.id}">${esc(x.title)}</button>`).join('')}
    </div>
    <div class="host"></div>
    <section class="section">
      <h2 style="font-size:var(--fs-lg)">${esc(t.title)}：要点与术语</h2>
      <p class="muted" style="margin-bottom:12px">${esc(t.summary)} ${srcTags(t.src)}</p>
      <div class="grid c3">${terms.map(g => `<div class="card" style="padding:16px 18px"><h3 style="font-size:var(--fs-md)">${esc(g.term)}</h3><p style="margin-top:6px;color:var(--ink-700)">${esc(g.def)}</p><div style="margin-top:8px">${srcTags(g.src)}</div></div>`).join('')}</div>
    </section></div>`;
  view.querySelector('.topicbar').addEventListener('click', e => {
    const b = e.target.closest('[data-topic]');
    if (b) location.hash = `#/network/${b.dataset.topic}`;
  });
  const player = d ? mountPlayer(view.querySelector('.host'), d, { mode: 'full', headingTag: 'h1', scene: t.scene, eyebrow: t.title }) : null;
  view.querySelector('.topicbar [aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  const i = topics.indexOf(t);
  return {
    destroy: () => player?.destroy(),
    player,
    title: t.title,
    keysAlt: { prev: () => { location.hash = `#/network/${topics[(i - 1 + topics.length) % topics.length].id}`; }, next: () => { location.hash = `#/network/${topics[(i + 1) % topics.length].id}`; } }
  };
}
