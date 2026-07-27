/* ------------------------------------------------------------------ *
 *  app.js — UI y lógica de Fuerza
 * ------------------------------------------------------------------ */

// Ejercicios por grupo muscular. Bootstrapea el selector la primera vez;
// cualquier ejercicio que registres pasa a mostrarse por uso reciente.
// Para cambiar los grupos, edita solo esta lista.
const GRUPOS = [
  ['Pecho', ['Press banca', 'Press inclinado mancuernas', 'Aperturas', 'Fondos']],
  ['Espalda', ['Dominadas', 'Jalón al pecho', 'Remo con barra', 'Remo mancuerna']],
  ['Hombro', ['Press militar', 'Elevaciones laterales', 'Face pull']],
  ['Bíceps', ['Curl bíceps', 'Curl martillo']],
  ['Tríceps', ['Extensiones de tríceps', 'Press francés']],
  ['Cuádriceps', ['Sentadilla', 'Prensa', 'Extensión de cuádriceps', 'Zancadas']],
  ['Isquios y glúteo', ['Peso muerto rumano', 'Curl femoral', 'Hip thrust']],
  ['Gemelos', ['Gemelos de pie']],
  ['Core', ['Rueda abdominal', 'Elevaciones de piernas', 'Pallof press']],
];

const GRUPO_NOMBRES = GRUPOS.map((g) => g[0]);
const SEED = GRUPOS.flatMap((g) => g[1]);
const EJ_GRUPO = {};
GRUPOS.forEach(([grupo, ejs]) => ejs.forEach((e) => { EJ_GRUPO[e] = grupo; }));
function grupoDe(nombre) { return EJ_GRUPO[nombre] || state.learnedGroups[nombre] || 'Otros'; }

const state = {
  tab: 'log',
  selectedExercise: null,
  selectedGroup: null,   // null = "Todos"
  detail: null,
  exerciseList: [],
  usedSet: new Set(),
  learnedGroups: {},     // ejercicio -> grupo, aprendido de los datos (importados o registrados)
  histGroup: null,       // filtro del historial por grupo muscular
  histExercise: null,    // filtro del historial por ejercicio (dentro del grupo)
};

/* ---------------------------- helpers ---------------------------- */

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function todayISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtDate(iso, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-ES', opts);
}

function daysAgo(iso) {
  const today = new Date(todayISO() + 'T00:00:00');
  const then = new Date(iso + 'T00:00:00');
  const diff = Math.round((today - then) / 86400000);
  if (diff <= 0) return 'hoy';
  if (diff === 1) return 'ayer';
  return `hace ${diff} días`;
}

function rirColorVar(r) {
  if (r === null || r === undefined) return 'var(--muted)';
  if (r === 0) return 'var(--danger)';
  if (r <= 2) return 'var(--good)';
  if (r === 3) return 'var(--warn)';
  return 'var(--danger)';
}

function setsStr(sets) {
  return (sets || []).filter((n) => n !== null && n !== undefined && n !== '')
    .join('<span>·</span>');
}

function sparkline(values) {
  if (values.length < 2) return '';
  const w = 100, h = 30, pad = 3;
  const min = Math.min(...values), max = Math.max(...values);
  const range = (max - min) || 1;
  const step = (w - pad * 2) / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = pad + i * step;
    const y = pad + (h - pad * 2) * (1 - (v - min) / range);
    return [x, y];
  });
  const d = pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ');
  const last = pts[pts.length - 1];
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <polyline points="${d}" fill="none" stroke="var(--gold)" stroke-width="1.5"
      stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.5" fill="var(--gold)"
      vector-effect="non-scaling-stroke"/>
  </svg>`;
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('is-show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-show'), 1900);
}

function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function ensureExerciseList() {
  const all = await DB.getAll(); // desc por timestamp
  const used = [];
  const usedSet = new Set();
  const learned = {};
  for (const e of all) {
    if (!usedSet.has(e.ejercicio)) { usedSet.add(e.ejercicio); used.push(e.ejercicio); }
    if (e.grupo && !(e.ejercicio in learned)) learned[e.ejercicio] = e.grupo;
  }
  const rest = SEED.filter((s) => !usedSet.has(s)).sort((a, b) => a.localeCompare(b, 'es'));
  state.exerciseList = [...used, ...rest];
  state.usedSet = usedSet;
  state.learnedGroups = learned;
}

/* ------------------------------ views ---------------------------- */

function buildGroupBar(active) {
  const hasOtros = state.exerciseList.some((n) => grupoDe(n) === 'Otros');
  const grupos = [...GRUPO_NOMBRES, ...(hasOtros ? ['Otros'] : [])];
  const chip = (label, val) =>
    `<button class="groupchip${active === val ? ' is-active' : ''}" data-action="pick-group" data-group="${val === null ? '' : esc(val)}">${esc(label)}</button>`;
  return chip('Todos', null) + grupos.map((g) => chip(g, g)).join('');
}

function buildChips(query, group) {
  const q = (query || '').trim().toLowerCase();
  let list = state.exerciseList;
  if (group) list = list.filter((n) => grupoDe(n) === group);
  if (q) list = list.filter((n) => n.toLowerCase().includes(q));

  let html = list.slice(0, 60).map((n) =>
    `<button class="chip" data-action="pick-exercise" data-ex="${esc(n)}">${esc(n)}` +
    (state.usedSet.has(n) ? '<span class="chip__recent">✓</span>' : '') +
    `</button>`).join('');

  const exact = state.exerciseList.some((n) => n.toLowerCase() === q);
  if (q && !exact) {
    html += `<button class="chip chip--add" data-action="add-exercise">+ Añadir "${esc(query.trim())}"</button>`;
  }
  return html || '<p class="picker__hint">Sin resultados. Escribe el nombre completo y pulsa Añadir.</p>';
}

async function renderLog() {
  if (!state.selectedExercise) {
    await ensureExerciseList();
    return `
      <p class="section-label">Registrar serie</p>
      <input class="picker__search" type="text" inputmode="search"
        placeholder="Buscar o añadir ejercicio…" autocomplete="off" />
      <div class="groupbar">${buildGroupBar(state.selectedGroup)}</div>
      <div class="chips">${buildChips('', state.selectedGroup)}</div>
    `;
  }

  const name = state.selectedExercise;
  const hist = await DB.historyFor(name);
  const last = hist[0] || null;
  const prev = hist[1] || null;

  let card;
  if (last) {
    let delta = '';
    if (prev && last.peso !== prev.peso) {
      const d = last.peso - prev.peso;
      const up = d > 0;
      delta = `<div class="lastcard__delta">${up ? '▲' : '▼'} <b style="color:${up ? 'var(--good)' : 'var(--danger)'}">${up ? '+' : ''}${(+d.toFixed(2))} kg</b> desde la sesión anterior</div>`;
    }
    card = `
      <div class="lastcard">
        <div class="lastcard__top">
          <span class="lastcard__label">Última vez</span>
          <span class="lastcard__date">${fmtDate(last.fecha)} · ${daysAgo(last.fecha)}</span>
        </div>
        <div class="lastcard__row">
          <span class="lastcard__peso num">${(+last.peso)}<small>kg</small></span>
          <span class="lastcard__sets num">${setsStr(last.sets) || '—'}</span>
          ${last.rir !== null && last.rir !== undefined
            ? `<span class="lastcard__rir num" style="color:${rirColorVar(last.rir)}">RIR ${last.rir === 4 ? '4+' : last.rir}</span>`
            : ''}
        </div>
        ${delta}
      </div>`;
  } else {
    card = `<div class="lastcard lastcard--empty">Primera vez que registras <b>${esc(name)}</b>. Marca hoy la referencia.</div>`;
  }

  const ph = (i) => (last && last.sets && last.sets[i] != null ? `placeholder="${last.sets[i]}"` : 'placeholder="–"');

  return `
    <button class="log__back" data-action="back-to-picker">‹ Cambiar ejercicio</button>
    <h1 class="log__title">${esc(name)}</h1>
    ${card}

    <div class="field">
      <div class="field__label"><span>Peso</span></div>
      <div class="weight">
        <button class="weight__step" data-action="weight-step" data-delta="-2.5" aria-label="Bajar 2,5 kg">−</button>
        <input class="weight__input num" id="f-peso" type="number" inputmode="decimal" step="2.5"
          value="${last ? (+last.peso) : ''}" placeholder="0" aria-label="Peso en kg" />
        <button class="weight__step" data-action="weight-step" data-delta="2.5" aria-label="Subir 2,5 kg">+</button>
      </div>
    </div>

    <div class="field">
      <div class="field__label"><span>Series — repeticiones</span></div>
      <div class="sets">
        ${[0, 1, 2, 3].map((i) => `
          <div class="setcell">
            <span class="setcell__tag">S${i + 1}</span>
            <input class="setcell__input num" id="f-s${i + 1}" type="number" inputmode="numeric" ${ph(i)} aria-label="Serie ${i + 1}" />
          </div>`).join('')}
      </div>
    </div>

    <div class="field">
      <div class="field__label"><span>RIR</span><span class="field__note">objetivo 1–2</span></div>
      <div class="rir" id="f-rir">
        ${[0, 1, 2, 3, 4].map((v) => `
          <button class="rir__opt num" data-action="rir-pick" data-rir="${v}"
            style="color:${rirColorVar(v)}">${v === 4 ? '4+' : v}</button>`).join('')}
      </div>
      <p class="rir__legend">0 fallo · 1–2 productivo · 3 ligero · 4+ demasiado ligero</p>
    </div>

    <div class="field">
      <div class="field__label"><span>Molestias</span><span class="field__note">opcional</span></div>
      <textarea class="textfield" id="f-molestias" rows="1" placeholder="p. ej. antebrazo / codo"></textarea>
    </div>

    <div class="field">
      <div class="field__label"><span>Nota</span><span class="field__note">opcional</span></div>
      <textarea class="textfield" id="f-nota" rows="1" placeholder="técnica, tempo, sensaciones…"></textarea>
    </div>

    <button class="btn-primary" data-action="save-set">Guardar serie</button>
  `;
}

async function renderHistory() {
  const all = await DB.getAll();

  const tools = `
    <div class="history__tools">
      <button class="btn-ghost" data-action="export-copy">Copiar</button>
      <button class="btn-ghost" data-action="export-json">Exportar</button>
      <button class="btn-ghost" data-action="export-csv">CSV</button>
      <button class="btn-ghost" data-action="import-open">Importar</button>
    </div>
  `;

  if (!all.length) {
    return tools + `
      <div class="empty">
        <div class="empty__icon">▤</div>
        <p class="empty__text">Aún no hay series.<br>Registra la primera en la pestaña <b>Registrar</b>.</p>
      </div>`;
  }

  // --- barra de grupos (solo los que tienen series) ---
  const gruposPresentes = new Set(all.map((e) => grupoDe(e.ejercicio)));
  const ordered = [...GRUPO_NOMBRES.filter((g) => gruposPresentes.has(g)),
    ...(gruposPresentes.has('Otros') ? ['Otros'] : [])];
  const gchip = (label, val, active) =>
    `<button class="groupchip${active ? ' is-active' : ''}" data-action="hist-group" data-group="${val === null ? '' : esc(val)}">${esc(label)}</button>`;
  const groupBar = `<div class="groupbar">` +
    gchip('Todos', null, !state.histGroup) +
    ordered.map((g) => gchip(g, g, state.histGroup === g)).join('') + `</div>`;

  // --- barra de ejercicios del grupo elegido ---
  let exBar = '';
  if (state.histGroup) {
    const exs = [];
    const seen = new Set();
    for (const e of all) {
      if (grupoDe(e.ejercicio) === state.histGroup && !seen.has(e.ejercicio)) {
        seen.add(e.ejercicio); exs.push(e.ejercicio);
      }
    }
    const echip = (label, val, active) =>
      `<button class="groupchip${active ? ' is-active' : ''}" data-action="hist-exercise" data-ex="${val === null ? '' : esc(val)}">${esc(label)}</button>`;
    exBar = `<div class="groupbar groupbar--sub">` +
      echip('Todos', null, !state.histExercise) +
      exs.map((n) => echip(n, n, state.histExercise === n)).join('') + `</div>`;
  }

  const filters = groupBar + exBar;

  // note de respaldo solo en la vista completa (sin filtros), para no estorbar en el uso diario
  const note = (!state.histGroup && !state.histExercise)
    ? `<p class="backup-note"><b>Copiar</b> pega tus datos en el chat con tu coach o donde quieras. <b>Exportar</b> guarda un archivo de respaldo — hazlo de vez en cuando: los datos viven solo en este iPhone.</p>`
    : '';

  // --- aplicar filtros ---
  let entries = all;
  if (state.histExercise) entries = entries.filter((e) => e.ejercicio === state.histExercise);
  else if (state.histGroup) entries = entries.filter((e) => grupoDe(e.ejercicio) === state.histGroup);

  if (!entries.length) {
    return tools + filters + `
      <div class="empty">
        <div class="empty__icon">▤</div>
        <p class="empty__text">No hay series con este filtro.</p>
      </div>`;
  }

  // agrupar por fecha (desc, ya viene ordenado por timestamp)
  const groups = [];
  const idx = {};
  for (const e of entries) {
    if (!(e.fecha in idx)) { idx[e.fecha] = groups.length; groups.push({ fecha: e.fecha, items: [] }); }
    groups[idx[e.fecha]].items.push(e);
  }

  const body = groups.map((g) => `
    <section class="daygroup">
      <h2 class="daygroup__head">${fmtDate(g.fecha, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
      ${g.items.map((e) => `
        <div class="entry" data-action="open-detail" data-ex="${esc(e.ejercicio)}">
          <div class="entry__main">
            <div class="entry__name">${esc(e.ejercicio)}</div>
            <div class="entry__meta num"><b>${(+e.peso)} kg</b> · ${setsStr(e.sets) || '—'}</div>
            ${e.molestias ? `<div class="entry__molestia">⚠ ${esc(e.molestias)}</div>` : ''}
          </div>
          ${e.rir !== null && e.rir !== undefined
            ? `<span class="entry__rir num" style="color:${rirColorVar(e.rir)}">RIR ${e.rir === 4 ? '4+' : e.rir}</span>`
            : ''}
        </div>`).join('')}
    </section>`).join('');

  return tools + filters + note + body;
}

async function renderDetail(name) {
  const hist = await DB.historyFor(name);
  if (!hist.length) { state.detail = null; return renderHistory(); }

  const asc = [...hist].reverse();
  const spark = sparkline(asc.map((e) => +e.peso));

  const sessions = hist.map((e) => `
    <div class="detail__session">
      <span class="detail__date">${fmtDate(e.fecha)}</span>
      <span class="detail__stats num">${(+e.peso)} kg <small>· ${setsStr(e.sets) || '—'}${
        e.rir !== null && e.rir !== undefined ? ` · RIR ${e.rir === 4 ? '4+' : e.rir}` : ''}</small></span>
      <button class="chip" style="padding:4px 10px;font-size:16px;line-height:1" data-action="delete-entry" data-id="${esc(e.id)}" aria-label="Eliminar">✕</button>
    </div>`).join('');

  return `
    <button class="log__back" data-action="close-detail">‹ Historial</button>
    <h1 class="log__title">${esc(name)}</h1>
    ${spark ? `<div class="detail__spark">${spark}</div>` : ''}
    <p class="section-label">${hist.length} sesión${hist.length === 1 ? '' : 'es'}</p>
    ${sessions}
  `;
}

async function render() {
  const view = document.getElementById('view');
  if (state.tab === 'log') view.innerHTML = await renderLog();
  else view.innerHTML = state.detail ? await renderDetail(state.detail) : await renderHistory();
}

/* --------------------------- interactions ------------------------ */

async function saveSet() {
  const name = state.selectedExercise;
  const pesoRaw = document.getElementById('f-peso').value;
  const peso = parseFloat(pesoRaw);
  const sets = [1, 2, 3, 4].map((i) => {
    const v = document.getElementById('f-s' + i).value.trim();
    return v === '' ? null : parseInt(v, 10);
  });
  const rirEl = document.querySelector('#f-rir .rir__opt.is-active');
  const rir = rirEl ? parseInt(rirEl.dataset.rir, 10) : null;
  const molestias = document.getElementById('f-molestias').value.trim();
  const nota = document.getElementById('f-nota').value.trim();

  if (!name || isNaN(peso) || peso <= 0 || sets.every((s) => s === null)) {
    toast('Añade peso y al menos la serie 1');
    return;
  }

  const entry = {
    id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()),
    fecha: todayISO(),
    timestamp: Date.now(),
    ejercicio: name,
    grupo: grupoDe(name),
    peso,
    sets,
    rir,
    molestias,
    nota,
  };

  try {
    await DB.put(entry);
    toast('Serie guardada ✓');
    state.selectedExercise = null;
    await ensureExerciseList();
    await render();
  } catch (err) {
    console.error(err);
    toast('Error al guardar');
  }
}

function handleClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;

  switch (action) {
    case 'pick-exercise':
      state.selectedExercise = el.dataset.ex;
      render();
      break;

    case 'add-exercise': {
      const input = document.querySelector('.picker__search');
      const val = (input && input.value.trim()) || '';
      if (val) { state.selectedExercise = val; render(); }
      break;
    }

    case 'pick-group': {
      state.selectedGroup = el.dataset.group || null;
      document.querySelectorAll('.groupchip').forEach((c) => c.classList.remove('is-active'));
      el.classList.add('is-active');
      const input = document.querySelector('.picker__search');
      const chips = document.querySelector('.chips');
      if (chips) chips.innerHTML = buildChips(input ? input.value : '', state.selectedGroup);
      break;
    }

    case 'back-to-picker':
      state.selectedExercise = null;
      render();
      break;

    case 'weight-step': {
      const input = document.getElementById('f-peso');
      const cur = parseFloat(input.value) || 0;
      const next = Math.max(0, cur + parseFloat(el.dataset.delta));
      input.value = Number.isInteger(next) ? next : +next.toFixed(2);
      break;
    }

    case 'rir-pick': {
      const wasActive = el.classList.contains('is-active');
      document.querySelectorAll('#f-rir .rir__opt').forEach((o) => o.classList.remove('is-active'));
      if (!wasActive) el.classList.add('is-active'); // segundo toque = deseleccionar
      break;
    }

    case 'save-set':
      saveSet();
      break;

    case 'hist-group':
      state.histGroup = el.dataset.group || null;
      state.histExercise = null;
      render();
      break;

    case 'hist-exercise':
      state.histExercise = el.dataset.ex || null;
      render();
      break;

    case 'open-detail':
      state.detail = el.dataset.ex;
      render();
      break;

    case 'close-detail':
      state.detail = null;
      render();
      break;

    case 'delete-entry':
      deleteEntry(el.dataset.id);
      break;

    case 'export-copy':
      exportCopy();
      break;

    case 'export-json':
      DB.exportJSON().then((t) => { download(`fuerza-${todayISO()}.json`, t, 'application/json'); toast('Respaldo descargado ✓'); });
      break;

    case 'export-csv':
      DB.exportCSV().then((t) => { download(`fuerza-${todayISO()}.csv`, t, 'text/csv'); toast('CSV descargado ✓'); });
      break;

    case 'import-open':
      document.getElementById('import-input').click();
      break;
  }
}

async function deleteEntry(id) {
  if (!window.confirm('¿Eliminar esta serie? No se puede deshacer.')) return;
  try {
    await DB.remove(id);
    toast('Serie eliminada');
    await render();
  } catch (err) {
    console.error(err);
    toast('Error al eliminar');
  }
}

async function exportCopy() {
  try {
    const text = await DB.exportJSON();
    await navigator.clipboard.writeText(text);
    toast('JSON copiado ✓');
  } catch (err) {
    console.error(err);
    // fallback si el portapapeles no está disponible
    DB.exportJSON().then((t) => download(`fuerza-${todayISO()}.json`, t, 'application/json'));
    toast('Copia no disponible — descargado');
  }
}

function handleInput(e) {
  if (e.target.classList.contains('picker__search')) {
    const chips = document.querySelector('.chips');
    if (chips) chips.innerHTML = buildChips(e.target.value, state.selectedGroup);
  }
}

async function handleImportFile(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = ''; // permite reimportar el mismo archivo
  if (!file) return;
  try {
    const text = await file.text();
    const n = await DB.importJSON(text);
    toast(`Importadas ${n} series ✓`);
    await ensureExerciseList();
    await render();
  } catch (err) {
    console.error(err);
    toast('Archivo no válido');
  }
}

function switchTab(tab) {
  state.tab = tab;
  state.detail = null;
  document.querySelectorAll('.tabbar__btn').forEach((b) =>
    b.setAttribute('aria-selected', b.dataset.tab === tab ? 'true' : 'false'));
  render();
}

/* ------------------------------- init ---------------------------- */

function init() {
  document.getElementById('topbar-date').textContent =
    fmtDate(todayISO(), { weekday: 'long', day: 'numeric', month: 'short' });

  document.querySelectorAll('.tabbar__btn').forEach((b) =>
    b.addEventListener('click', () => switchTab(b.dataset.tab)));

  const view = document.getElementById('view');
  view.addEventListener('click', handleClick);
  view.addEventListener('input', handleInput);
  document.getElementById('import-input').addEventListener('change', handleImportFile);

  render();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((err) =>
        console.warn('SW no registrado:', err));
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
