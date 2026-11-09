// ---------- util ----------
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const fmt = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');

// ---------- configuração ----------
const DEFAULT_COLORS = { bg: '#0d3b72', box: null, text: '#eaf1ff' };   // box null = mesma cor do fundo
const cfg = Object.assign({ checkinMin: 5, volume: 70, pronoun: 'ela' }, load('cfg', {}));
cfg.colors = Object.assign({}, DEFAULT_COLORS, cfg.colors || {});
const saveCfg = () => save('cfg', cfg);

// ---------- pronomes: ele / ela / elu ----------
const SUFFIX = { ele: 'o', ela: 'a', elu: 'e' };
const sfx = () => SUFFIX[cfg.pronoun] || 'a';

// ---------- cores ----------
const isCustomTheme = () => cfg.colors.bg !== DEFAULT_COLORS.bg || cfg.colors.text !== DEFAULT_COLORS.text || !!cfg.colors.box;
function applyTheme() {
  const r = document.documentElement.style, c = cfg.colors;
  r.setProperty('--bg', c.bg); r.setProperty('--text', c.text);
  r.setProperty('--box', c.box || 'transparent');
  const derived = {   // bordas e destaques acompanham as cores escolhidas
    '--line': 'color-mix(in srgb, var(--text) 60%, var(--bg))',
    '--pill': 'color-mix(in srgb, var(--text) 70%, var(--bg))',
    '--ink': 'var(--bg)',
    '--field-line': 'color-mix(in srgb, var(--bg) 30%, #000)'
  };
  for (const k in derived) isCustomTheme() ? r.setProperty(k, derived[k]) : r.removeProperty(k);
}
applyTheme();
const PRAISE_MS = 3000;

// ---------- sons ----------
const sounds = { meow: new Audio('assets/meow.mp3'), click: new Audio('assets/click.mp3') };
Object.values(sounds).forEach(a => a.preload = 'auto');
function play(name) {
  const gain = name === 'click' ? 0.6 : 1;
  const a = sounds[name].cloneNode();
  a.volume = Math.min(1, cfg.volume / 100 * gain);
  if (a.volume > 0) a.play().catch(() => {});
}
// som de clique em qualquer botão
document.addEventListener('click', e => { if (e.target.closest('button')) play('click'); }, true);

// ---------- estado ----------
const S = {
  view: 'idle', prev: 'idle', task: '', total: null, elapsed: 0, since: 0, timer: null, paused: false, entry: null,
  thoughts: load('thoughts', []), history: load('history', [])
};
const catTop = side => `<img class="cat-top ${side}" src="assets/cat-peek.png" alt="">`;
const catSide = `<img class="cat-side" src="assets/cat-side.png" alt="">`;

// ---------- navegação ----------
function go(v) {
  const modal = ['history', 'thoughts', 'settings'];
  if (modal.includes(v) && !modal.includes(S.view)) S.prev = S.view;
  S.view = v; render();
}

// ---------- sessão ----------
function start(totalSec) {
  S.total = totalSec; S.elapsed = 0; S.since = 0; S.paused = false;
  clearInterval(S.timer); S.timer = setInterval(tick, 1000);
  go('compact');
}
function tick() {
  S.elapsed++; S.since++;
  if (S.total && S.elapsed >= S.total) return finish();
  if (S.since >= cfg.checkinMin * 60 && ['compact', 'open'].includes(S.view)) {
    S.since = 0; go('checkin'); api.attention(); play('meow');
  } else clock();
}
const active = () => S.timer || S.paused;
function togglePause() {
  if (!active()) return;
  if (S.paused) { S.paused = false; S.timer = setInterval(tick, 1000); }
  else { clearInterval(S.timer); S.timer = null; S.paused = true; }
  render();
}
function clock() {
  const t = S.total ? Math.max(S.total - S.elapsed, 0) : S.elapsed;
  document.querySelectorAll('.clock').forEach(e => e.textContent = fmt(t));
}
function finish() {
  clearInterval(S.timer); S.timer = null; S.paused = false;
  S.entry = { task: S.task, secs: S.elapsed, date: Date.now(), note: '' };
  go('done');
}
function reset() { S.task = ''; S.entry = null; go('idle'); }

// ---------- views ----------
function header() {
  const n = S.thoughts.filter(t => !t.done).length;
  return `<div class="hdr drag"><span class="logo-cat"></span><span class="logo">Fogato</span>
    <button class="tab" data-go="history">Histórico</button>
    <button class="tab" data-go="thoughts">Pensamentos${n ? `<sup>${n}</sup>` : ''}</button>
    <span class="win"><button data-go="settings" title="Configurações">⚙</button><button id="min" title="Minimizar">—</button><button id="x" title="Fechar">✕</button></span></div>`;
}
const taskRow = (extra = '') => `<div class="field"><span>${esc(S.task)}</span>${extra}</div>`;

const views = {
  idle: () => header() + `<input id="task" class="field" placeholder="Escreva sua tarefa" autofocus>`,
  setup: () => header() + taskRow('<span>↵</span>') +
    `<div class="pill"><span class="lbl" id="go">Timer: <input id="mins" type="number" min="1" value="25"> min</span>
     <button class="key" id="startbtn" title="Iniciar (Enter)">↵</button>
     <span>OU</span><button class="btn" id="free">FreeFlow</button><button class="x" id="cancel">✕</button></div>`,
  compact: () => `<div class="status">${S.paused ? 'em pausa ⏸' : `concentrad${sfx()}😺`}</div>
     <div class="compact"><span class="tname">${esc(S.task)}</span>
     <span class="right"><span class="clock"></span>
     <button class="pz" data-pause title="${S.paused ? 'Continuar' : 'Pausar'}">${S.paused ? '▶' : '⏸'}</button>
     <button class="pz" id="expand" title="Abrir painel">⤢</button></span></div>`,
  open: () => header() + taskRow('<b class="clock"></b>') +
    `<input id="th" class="field" placeholder="Anotar pensamento perdido…">
     <div class="pill"><button class="btn" data-pause>${S.paused ? '▶ Continuar' : '⏸ Pausar'}</button><button class="btn" id="end">Terminei</button><button class="btn alt" id="fold">Recolher</button></div>`,
  checkin: () => `${catSide}<div class="center"><p>Ainda focad${sfx()} em<br><u>${esc(S.task)}</u>?</p>
     <div class="btns"><button id="yes">👍 Sim</button><button id="no">👎 Não</button></div></div>`,
  praise: () => `<div class="compact"><span class="tname">${esc(S.task)}</span><span>Bom trabalho 💪</span></div>`,
  what: () => header() + taskRow() +
    `<div class="pill">O que aconteceu? <button class="btn" id="end">Terminei</button><button class="btn alt" id="dis">↩ Me distraí</button></div>`,
  back: () => header() + taskRow() +
    `<div class="pill">Acontece, <button class="btn" id="back">Volte</button> e se mantenha focad${sfx()}</div>`,
  done: () => header() + `<div class="panel"><h2>Sessão encerrada 🎉</h2>
     <p>Você ficou focad${sfx()} em <b>${esc(S.entry.task)}</b> por <b>${Math.max(1, Math.round(S.entry.secs / 60))} min</b>. Isso já é uma vitória.</p>
     <input id="note" class="field" style="margin-top:10px" placeholder="Recado para você mesm${sfx()} (onde parou?)">
     <p class="note">Enter para salvar</p></div>`,
  settings: () => header() + `<div class="panel"><button class="close" data-back>✕</button><h2>Configurações</h2>
     <label class="row"><span>Tempo entre avisos</span><span><input id="cfgMin" type="number" min="1" max="120" value="${cfg.checkinMin}"> min</span></label>
     <label class="row"><span>Volume dos sons</span><span class="vol"><input id="cfgVol" type="range" min="0" max="100" value="${cfg.volume}"><b id="volTxt">${cfg.volume}%</b></span></label>
     <div class="row"><span>Pronomes</span><span class="seg">${['ele', 'ela', 'elu'].map(p => `<button data-pron="${p}" class="${cfg.pronoun === p ? 'on' : ''}">${p[0].toUpperCase() + p.slice(1)}</button>`).join('')}</span></div>
     <label class="row"><span>Cor do fundo</span><input type="color" data-color="bg" value="${cfg.colors.bg}"></label>
     <label class="row"><span>Cor da caixa de texto</span><input type="color" data-color="box" value="${cfg.colors.box || cfg.colors.bg}"></label>
     <label class="row"><span>Cor do texto</span><input type="color" data-color="text" value="${cfg.colors.text}"></label>
     <div class="foot"><button id="resetColors">Restaurar cores</button><button id="testSound">🔊 Testar miado</button></div></div>`,
  history: () => header() + `<div class="panel"><button class="close" data-back>✕</button><h2>Histórico</h2>
     <div class="list">${S.history.length ? S.history.map(h => `<div class="item"><span>${esc(h.task)}${h.note ? `<br><small style="margin:0">${esc(h.note)}</small>` : ''}</span>
       <small>${Math.max(1, Math.round(h.secs / 60))} min · ${new Date(h.date).toLocaleDateString('pt-BR')}</small></div>`).join('')
       : '<p class="muted">Nenhuma sessão ainda.</p>'}</div></div>`,
  thoughts: () => header() + `<div class="panel"><button class="close" data-back>✕</button><h2>Pensamentos</h2>
     <input id="th" class="field" placeholder="No que estava pensando?">
     <div class="list">${S.thoughts.length ? S.thoughts.map((t, i) => `<label class="item ${t.done ? 'done' : ''}">
       <input type="checkbox" data-i="${i}" ${t.done ? 'checked' : ''}><span>${esc(t.text)}</span>
       <button class="focus" data-focus="${i}" title="Iniciar sessão de foco com este pensamento">▶ Focar</button></label>`).join('')
       : '<p class="muted">Anote aqui o que distrair você, e volte ao foco.</p>'}</div>
     <div class="foot"><button id="clear">Limpar completos</button><button id="all">Selecionar todos</button></div></div>`
};

// ---------- eventos ----------
function addThought(inp) {
  const v = inp.value.trim(); if (!v) return;
  S.thoughts.unshift({ text: v, done: false }); save('thoughts', S.thoughts); render(true);
}
const on = (sel, ev, fn) => { const e = $(sel); if (e) e.addEventListener(ev, fn); };
const enter = (sel, fn) => on(sel, 'keydown', e => { if (e.key === 'Enter') fn(e.target); });

function bind() {
  document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => go(S.prev));
  document.querySelectorAll('[data-pause]').forEach(b => b.onclick = e => { e.stopPropagation(); togglePause(); });
  on('#min', 'click', () => api.minimize());
  on('#x', 'click', () => { if (!active() || confirm('Encerrar o Fogato? A sessão atual será perdida.')) api.close(); });

  enter('#task', i => { if (i.value.trim()) { S.task = i.value.trim(); go('setup'); } });
  enter('#mins', i => start(Math.max(1, +i.value || 25) * 60));
  on('#go', 'click', e => { if (e.target.id === 'go') start(Math.max(1, +$('#mins').value || 25) * 60); });
  on('#free', 'click', () => start(null));
  on('#startbtn', 'click', () => start(Math.max(1, +$('#mins').value || 25) * 60));
  on('#cfgMin', 'change', e => { cfg.checkinMin = Math.min(120, Math.max(1, Math.round(+e.target.value) || 5)); e.target.value = cfg.checkinMin; saveCfg(); });
  on('#cfgVol', 'input', e => { cfg.volume = +e.target.value; $('#volTxt').textContent = cfg.volume + '%'; saveCfg(); });
  on('#testSound', 'click', () => play('meow'));
  document.querySelectorAll('[data-focus]').forEach(b => b.onclick = e => {
    e.preventDefault(); e.stopPropagation();
    if (active() && !confirm('Já existe uma sessão em andamento. Trocar pela tarefa deste pensamento?')) return;
    clearInterval(S.timer); S.timer = null; S.paused = false;
    S.task = S.thoughts[+b.dataset.focus].text;
    go('setup');
  });
  document.querySelectorAll('[data-pron]').forEach(b => b.onclick = () => { cfg.pronoun = b.dataset.pron; saveCfg(); render(); });
  document.querySelectorAll('[data-color]').forEach(i => i.oninput = () => {
    cfg.colors[i.dataset.color] = i.value; saveCfg(); applyTheme();
    const box = $('[data-color=box]'); if (box && !cfg.colors.box) box.value = cfg.colors.bg;
  });
  on('#resetColors', 'click', () => { cfg.colors = Object.assign({}, DEFAULT_COLORS); saveCfg(); applyTheme(); render(); });
  on('#cancel', 'click', reset);

  on('#expand', 'click', () => go('open'));
  on('#fold', 'click', () => go('compact'));
  on('#end', 'click', finish);
  enter('#th', addThought);

  on('#yes', 'click', () => { go('praise'); setTimeout(() => S.view === 'praise' && go('compact'), PRAISE_MS); });
  on('#no', 'click', () => go('what'));
  on('#dis', 'click', () => go('back'));
  on('#back', 'click', () => go('compact'));

  enter('#note', i => {
    S.entry.note = i.value.trim(); S.history.unshift(S.entry); save('history', S.history); reset();
  });

  document.querySelectorAll('input[type=checkbox][data-i]').forEach(c => c.onchange = () => {
    S.thoughts[+c.dataset.i].done = c.checked; save('thoughts', S.thoughts); render(true);
  });
  on('#clear', 'click', () => { S.thoughts = S.thoughts.filter(t => !t.done); save('thoughts', S.thoughts); render(true); });
  on('#all', 'click', () => { S.thoughts.forEach(t => t.done = true); save('thoughts', S.thoughts); render(true); });
}

// ---------- render + auto-resize da janela ----------
const app = $('#app'), stage = $('#stage');
function render(keepFocus) {
  app.style.width = (['compact', 'praise', 'checkin'].includes(S.view) ? 300 : 400) + 'px';
  stage.style.paddingLeft = S.view === 'checkin' ? '32px' : '0';
  stage.style.paddingTop = S.view === 'checkin' ? '0' : '34px';
  app.classList.toggle('paused', S.paused);
  app.innerHTML = (S.view === 'checkin' ? '' : catTop('right')) + views[S.view]();
  bind(); clock(); fit();
  const f = $('#task, #th, #note, #mins'); if (f) f.focus();
}
// o tamanho da janela segue o tamanho real do conteúdo (não o da janela atual)
function fit() {
  const side = S.view === 'checkin';
  api.resize(app.offsetWidth + (side ? 32 : 0), app.offsetHeight + (side ? 0 : 34));
}
new ResizeObserver(fit).observe(app);
render();
