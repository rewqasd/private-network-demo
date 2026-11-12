/*
 * 分步播放控制器。
 * 每一步的画面状态都从第 1 步开始“累积重放”计算，保证上一步/下一步/跳转结果确定一致。
 * 步骤字段：add/remove（显隐）、states（节点/链路状态，持续到被覆盖）、flows（当前流量，未声明则沿用）、
 * meters（仪表，合并）、kpis（指标，未声明则沿用）、callouts 与 focus（只作用于当前步）。
 */
export class Player {
  constructor(stage, hooks = {}) {
    this.stage = stage;
    this.hooks = hooks;
    this.i = 0;
    this.playing = false;
    this.frozen = false;
    this.speed = 1;
    this.baseDur = 6500;
    this.timer = null;
  }

  load(scene) {
    this.pause(true);
    this.scene = scene;
    this.steps = scene.steps || [{ t: scene.title, add: [] }];
    this.calloutIds = new Set((scene.callouts || []).map(c => c.id));
    this.stage.load(scene);
    this.stage.setSpeed(this.speed);
    this.frozen = false;
    this.stage.setRunning(true);
    this.go(0);
  }

  get last() { return this.steps.length - 1; }

  computeState(i) {
    const st = {
      visible: new Set(this.scene.base || []),
      states: new Map(),
      flows: new Set(),
      meters: new Map(),
      focus: null,
      kpis: []
    };
    let flows = new Set();
    let kpis = [];
    for (let k = 0; k <= i; k++) {
      const s = this.steps[k];
      (s.add || []).forEach(id => st.visible.add(id));
      (s.remove || []).forEach(id => st.visible.delete(id));
      if (s.states) for (const [id, v] of Object.entries(s.states)) st.states.set(id, v);
      if (s.flows) flows = new Set(s.flows);
      if (s.kpis) kpis = s.kpis.slice();
      if (s.meters) for (const [id, v] of Object.entries(s.meters)) st.meters.set(id, v);
    }
    for (const id of this.calloutIds) st.visible.delete(id);
    const cur = this.steps[i];
    (cur.callouts || []).forEach(id => st.visible.add(id));
    st.flows = flows;
    st.kpis = kpis;
    st.focus = cur.focus ? new Set(cur.focus) : null;
    return st;
  }

  go(i, opts = {}) {
    if (!this.steps) return;
    this.i = Math.max(0, Math.min(this.last, i));
    const state = this.computeState(this.i);
    this.state = state;
    this.stage.apply(state);
    if (!opts.auto && this.frozen && !this.playing) {
      this.frozen = false;
      this.stage.setRunning(true);
    }
    this.hooks.onStep?.(this.i, this.steps[this.i], state);
    if (this.playing) this._schedule();
  }

  next() { if (this.i < this.last) this.go(this.i + 1); }
  prev() { if (this.i > 0) this.go(this.i - 1); }

  play() {
    if (this.i >= this.last) this.go(0);
    this.playing = true;
    this.frozen = false;
    this.stage.setRunning(true);
    this._schedule();
    this.hooks.onPlayState?.(this._mode());
  }

  pause(silent) {
    clearTimeout(this.timer);
    this.timer = null;
    const was = this.playing;
    this.playing = false;
    if (!silent) {
      this.frozen = true;
      this.stage.setRunning(false);
    }
    if (!silent || was) this.hooks.onPlayState?.(this._mode());
  }

  toggle() { if (this.playing) this.pause(); else this.play(); }

  replay() { this.go(0); this.play(); }

  setSpeed(s) {
    this.speed = s;
    this.stage.setSpeed(s);
    if (this.playing) this._schedule();
    this.hooks.onPlayState?.(this._mode());
  }

  _mode() { return this.playing ? 'playing' : this.frozen ? 'paused' : 'ready'; }

  _schedule() {
    clearTimeout(this.timer);
    if (!this.playing) return;
    const step = this.steps[this.i];
    const dur = (step.dur || this.baseDur) / this.speed;
    this.timer = setTimeout(() => {
      if (!this.playing) return;
      if (this.i < this.last) this.go(this.i + 1, { auto: true });
      else this.pause();
    }, dur);
  }

  destroy() {
    clearTimeout(this.timer);
    this.playing = false;
    this.stage.destroy();
  }
}
