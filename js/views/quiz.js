/* 08 课堂互动：练习 / 测验，答案解析与得分统计 */
import { db } from '../store.js';
import { esc, srcTags, storage } from '../ui.js';

function shuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

export function render(view) {
  const Q = db.quiz;
  const types = Q.types;
  const st = { phase: 'setup', type: 'all', mode: 'practice', list: [], i: 0, answers: [], shuffled: true };
  view.innerHTML = `<div class="page"><div class="page-head"><div><div class="eyebrow">08 课堂互动</div><h1>产品知识与营销场景测验</h1>
    <p>六类题型：${Object.values(types).join('、')}。每题解析附资料出处；成绩只保存在本机浏览器。</p></div></div><div class="quiz"></div></div>`;
  const box = view.querySelector('.quiz');

  const draw = () => {
    if (st.phase === 'setup') {
      const best = storage('quiz-best');
      box.innerHTML = `<div class="card">
        <h2 style="font-size:var(--fs-xl)">选择题型与模式</h2>
        <div class="chips" style="margin-top:14px" role="group" aria-label="题型">
          <button class="chip ${st.type === 'all' ? 'brand' : 'outline'}" data-type="all" style="cursor:pointer">全部（${Q.questions.length}）</button>
          ${Object.entries(types).map(([k, v]) => `<button class="chip ${st.type === k ? 'brand' : 'outline'}" data-type="${k}" style="cursor:pointer">${esc(v)}（${Q.questions.filter(q => q.type === k).length}）</button>`).join('')}
        </div>
        <div class="tabs" style="margin-top:16px;width:max-content" role="tablist" aria-label="模式">
          <button data-mode="practice" aria-selected="${st.mode === 'practice'}">练习模式：每题即时解析</button>
          <button data-mode="exam" aria-selected="${st.mode === 'exam'}">测验模式：交卷后统一看成绩</button>
        </div>
        <div style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary" data-start>开始答题</button></div>
        ${best ? `<p class="muted" style="margin-top:14px">本机最好成绩：${best.score} / ${best.total}（${esc(best.when)}）</p>` : ''}
      </div>`;
      return;
    }
    if (st.phase === 'q') {
      const q = st.list[st.i];
      const a = st.answers[st.i];
      const showAns = st.mode === 'practice' && a !== undefined;
      box.innerHTML = `<div class="card">
        <div class="trail"><span class="chip brand">${esc(types[q.type])}</span><span>第 ${st.i + 1} / ${st.list.length} 题</span></div>
        <div class="progress" style="margin:12px 0 18px"><i style="width:${(st.i / st.list.length) * 100}%"></i></div>
        <h2 style="font-size:var(--fs-xl)">${esc(q.q)}</h2>
        <div class="tree-opts" style="margin-top:18px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">${q.options.map((o, k) => {
          let cls = '';
          if (showAns) cls = k === q.answer ? 'right' : (k === a ? 'wrong' : '');
          else if (a === k) cls = 'right';
          return `<button class="opt ${cls}" data-ans="${k}" ${showAns ? 'disabled' : ''}><b>${'ABCD'[k]}.</b> ${esc(o)}</button>`;
        }).join('')}</div>
        ${showAns ? `<div class="${a === q.answer ? 'result' : 'note warn'}" style="margin-top:16px"><b>${a === q.answer ? '回答正确' : `回答错误，正确答案：${'ABCD'[q.answer]}`}</b><p style="margin-top:6px">${esc(q.explain)}</p><div style="margin-top:8px">${srcTags(q.src)}</div></div>` : ''}
        <div style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn" data-nav="-1" ${st.i === 0 ? 'disabled' : ''}>上一题</button>
          ${st.i < st.list.length - 1 ? `<button class="btn primary" data-nav="1" ${a === undefined ? 'disabled' : ''}>下一题</button>` : `<button class="btn primary" data-finish ${a === undefined ? 'disabled' : ''}>交卷看成绩</button>`}
          <button class="btn ghost" data-quit>退出</button>
        </div></div>`;
      return;
    }
    // 成绩
    const total = st.list.length;
    const score = st.list.filter((q, k) => st.answers[k] === q.answer).length;
    const byType = {};
    st.list.forEach((q, k) => { const t = byType[q.type] ||= { n: 0, ok: 0 }; t.n++; if (st.answers[k] === q.answer) t.ok++; });
    const best = storage('quiz-best');
    if (!best || score / total > best.score / best.total) storage('quiz-best', { score, total, when: new Date().toLocaleString('zh-CN') });
    box.innerHTML = `<div class="card">
      <div class="eyebrow">成绩</div><div class="score">${score} <span class="muted" style="font-size:var(--fs-xl)">/ ${total}</span></div>
      <p class="muted">正确率 ${Math.round((score / total) * 100)}%</p>
      <div class="table-wrap" style="margin-top:16px"><table class="table"><thead><tr><th>题型</th><th>答对 / 题数</th></tr></thead><tbody>${Object.entries(byType).map(([k, v]) => `<tr><td>${esc(types[k])}</td><td class="num">${v.ok} / ${v.n}</td></tr>`).join('')}</tbody></table></div>
      <h3 style="margin-top:22px">逐题解析</h3>
      ${st.list.map((q, k) => `<details class="acc" ${st.answers[k] !== q.answer ? 'open' : ''}><summary><span>${st.answers[k] === q.answer ? '✅' : '❌'} ${k + 1}. ${esc(q.q)}</span></summary><div class="acc-body"><p><b>正确答案：</b>${'ABCD'[q.answer]}. ${esc(q.options[q.answer])}${st.answers[k] !== q.answer ? `；<b>你的答案：</b>${st.answers[k] === undefined ? '未作答' : 'ABCD'[st.answers[k]] + '. ' + esc(q.options[st.answers[k]])}` : ''}</p><p style="margin-top:6px">${esc(q.explain)}</p><div style="margin-top:8px">${srcTags(q.src)}</div></div></details>`).join('')}
      <div style="margin-top:18px;display:flex;gap:10px"><button class="btn primary" data-again>再来一轮</button><button class="btn" data-quit>重新选择题型</button></div></div>`;
  };

  view.querySelector('.page').addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.type) { st.type = t.dataset.type; draw(); return; }
    if (t.dataset.mode) { st.mode = t.dataset.mode; draw(); return; }
    if (t.hasAttribute('data-start') || t.hasAttribute('data-again')) {
      const pool = Q.questions.filter(q => st.type === 'all' || q.type === st.type);
      st.list = shuffle(pool).slice(0, st.type === 'all' ? 12 : pool.length);
      st.i = 0; st.answers = []; st.phase = 'q'; draw(); return;
    }
    if (t.dataset.ans !== undefined) { st.answers[st.i] = Number(t.dataset.ans); draw(); return; }
    if (t.dataset.nav) { st.i = Math.max(0, Math.min(st.list.length - 1, st.i + Number(t.dataset.nav))); draw(); return; }
    if (t.hasAttribute('data-finish')) { st.phase = 'result'; draw(); return; }
    if (t.hasAttribute('data-quit')) { st.phase = 'setup'; draw(); }
  });
  draw();
  return {
    keys: {
      prev: () => { if (st.phase === 'q' && st.i > 0) { st.i--; draw(); } },
      next: () => { if (st.phase === 'q' && st.answers[st.i] !== undefined && st.i < st.list.length - 1) { st.i++; draw(); } }
    }
  };
}
