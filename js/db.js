/* ------------------------------------------------------------------ *
 *  db.js — capa de datos local-first sobre IndexedDB
 *  Un registro = un ejercicio en una sesión, con hasta 4 series (S1–S4)
 * ------------------------------------------------------------------ */
const DB = (() => {
  const DB_NAME = 'fuerza';
  const DB_VERSION = 1;
  const STORE = 'series';

  let _dbPromise = null;

  function open() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const os = db.createObjectStore(STORE, { keyPath: 'id' });
          os.createIndex('ejercicio', 'ejercicio', { unique: false });
          os.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return _dbPromise;
  }

  function reqP(request) {
    return new Promise((res, rej) => {
      request.onsuccess = () => res(request.result);
      request.onerror = () => rej(request.error);
    });
  }

  async function put(entry) {
    const db = await open();
    return reqP(db.transaction(STORE, 'readwrite').objectStore(STORE).put(entry));
  }

  async function getAll() {
    const db = await open();
    const all = await reqP(db.transaction(STORE, 'readonly').objectStore(STORE).getAll());
    // más reciente primero
    return all.sort((a, b) => b.timestamp - a.timestamp);
  }

  async function get(id) {
    const db = await open();
    return reqP(db.transaction(STORE, 'readonly').objectStore(STORE).get(id));
  }

  async function remove(id) {
    const db = await open();
    return reqP(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id));
  }

  async function bulkPut(entries) {
    const db = await open();
    const tx = db.transaction(STORE, 'readwrite');
    const os = tx.objectStore(STORE);
    entries.forEach((e) => os.put(e));
    return new Promise((res, rej) => {
      tx.oncomplete = () => res(entries.length);
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error);
    });
  }

  /* ---------- consultas derivadas (dataset pequeño → en memoria) ---------- */

  // Nombres de ejercicio ya usados, ordenados por uso más reciente
  async function usedExercises() {
    const all = await getAll(); // ya viene desc por timestamp
    const seen = new Set();
    const out = [];
    for (const e of all) {
      if (!seen.has(e.ejercicio)) { seen.add(e.ejercicio); out.push(e.ejercicio); }
    }
    return out;
  }

  // Última sesión registrada de un ejercicio (para "última vez")
  async function lastFor(nombre) {
    const all = await getAll();
    return all.find((e) => e.ejercicio === nombre) || null;
  }

  // Todas las sesiones de un ejercicio, desc
  async function historyFor(nombre) {
    const all = await getAll();
    return all.filter((e) => e.ejercicio === nombre);
  }

  /* ---------- export / import ---------- */

  async function exportJSON() {
    const all = await getAll();
    return JSON.stringify(all, null, 2);
  }

  async function exportCSV() {
    const all = await getAll();
    const head = ['fecha', 'ejercicio', 'grupo', 'peso', 's1', 's2', 's3', 's4', 's5', 's6', 'rir', 'molestias', 'nota'];
    const esc = (v) => {
      const s = (v ?? '') + '';
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const rows = all.map((e) => [
      e.fecha, e.ejercicio, e.grupo ?? '', e.peso,
      e.sets?.[0] ?? '', e.sets?.[1] ?? '', e.sets?.[2] ?? '', e.sets?.[3] ?? '',
      e.sets?.[4] ?? '', e.sets?.[5] ?? '',
      e.rir ?? '', e.molestias ?? '', e.nota ?? '',
    ].map(esc).join(','));
    return [head.join(','), ...rows].join('\n');
  }

  // Importa un backup JSON. Sobrescribe por id (mismo id = misma serie).
  async function importJSON(text) {
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error('El archivo no es una lista de series.');
    const clean = data.filter((e) => e && e.id && e.ejercicio);
    if (!clean.length) throw new Error('No se encontraron series válidas.');
    await bulkPut(clean);
    return clean.length;
  }

  // Renombra un ejercicio en todas sus series. Si newName ya existe, se fusionan
  // (las series renombradas adoptan el grupo del ejercicio destino).
  async function renameExercise(oldName, newName) {
    const all = await getAll();
    const target = all.find((e) => e.ejercicio === newName);
    const targetGrupo = target ? target.grupo : null;
    const toUpdate = all
      .filter((e) => e.ejercicio === oldName)
      .map((e) => ({ ...e, ejercicio: newName, grupo: targetGrupo || e.grupo }));
    if (!toUpdate.length) return { count: 0, merged: false };
    await bulkPut(toUpdate);
    return { count: toUpdate.length, merged: !!target };
  }

  // Cambia el grupo muscular de un ejercicio en todas sus series.
  async function regroupExercise(name, grupo) {
    const all = await getAll();
    const toUpdate = all.filter((e) => e.ejercicio === name).map((e) => ({ ...e, grupo }));
    if (!toUpdate.length) return 0;
    await bulkPut(toUpdate);
    return toUpdate.length;
  }

  // Elimina un ejercicio y todas sus series.
  async function deleteExercise(name) {
    const all = await getAll();
    const ids = all.filter((e) => e.ejercicio === name).map((e) => e.id);
    if (!ids.length) return 0;
    const db = await open();
    const tx = db.transaction(STORE, 'readwrite');
    const os = tx.objectStore(STORE);
    ids.forEach((id) => os.delete(id));
    return new Promise((res, rej) => {
      tx.oncomplete = () => res(ids.length);
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error);
    });
  }

  return {
    put, getAll, get, remove,
    usedExercises, lastFor, historyFor,
    renameExercise, deleteExercise, regroupExercise,
    exportJSON, exportCSV, importJSON,
  };
})();
