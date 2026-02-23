import { db } from './firebase.js';
import { ref, set, get, onValue } from 'firebase/database';

// ── Local state ───────────────────────────────────────────────
export const state = {
  murid:  JSON.parse(localStorage.getItem('md3_murid')  || '[]'),
  rekod:  JSON.parse(localStorage.getItem('md3_rekod')  || '[]'),
  larian: JSON.parse(localStorage.getItem('md3_larian') ||
    '{"L12":{"s":"idle","mula":null,"tamat":null},"P12":{"s":"idle","mula":null,"tamat":null}}'),
  cL: parseInt(localStorage.getItem('md3_cL') || '0'),
  cP: parseInt(localStorage.getItem('md3_cP') || '0'),
  apiKey:        localStorage.getItem('md3_ak') || '',
  fdAktif:       'semua',
  flbAktif:      'semua',
  prevData:      [],
  prevFilter:    'semua',
  lookupSekolah: '',
  timers:        {},
  camStream:     null,
};

// ── localStorage helpers ──────────────────────────────────────
function saveLocal() {
  try {
    localStorage.setItem('md3_murid',  JSON.stringify(state.murid));
    localStorage.setItem('md3_rekod',  JSON.stringify(state.rekod));
    localStorage.setItem('md3_larian', JSON.stringify(state.larian));
    localStorage.setItem('md3_cL', state.cL);
    localStorage.setItem('md3_cP', state.cP);
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      alert('Storan penuh! Sila eksport dan reset data lama.');
    }
  }
}

// ── Array ↔ Object conversion for RTDB ───────────────────────
// RTDB does not support arrays. Arrays are stored as { <uuid>: item } objects.
function arrayToObj(arr) {
  const obj = {};
  arr.forEach(item => { obj[item.id || crypto.randomUUID()] = item; });
  return obj;
}
function objToArray(obj) {
  return obj ? Object.values(obj) : [];
}

// ── Firebase sync (fire-and-forget) ──────────────────────────
async function syncToFirebase() {
  try {
    await Promise.all([
      set(ref(db, 'murid'),    arrayToObj(state.murid)),
      set(ref(db, 'rekod'),    arrayToObj(state.rekod)),
      set(ref(db, 'larian'),   state.larian),
      set(ref(db, 'counters'), { cL: state.cL, cP: state.cP }),
    ]);
  } catch (e) {
    console.warn('Firebase sync failed (offline?):', e.message);
  }
}

// ── Public save — writes localStorage + Firebase ──────────────
export function save() {
  saveLocal();
  syncToFirebase();
}

// ── Series number generator ───────────────────────────────────
export function jana(kat) {
  if (kat === 'L12') {
    state.cL++;
    localStorage.setItem('md3_cL', state.cL);
    return 'L12' + String(state.cL).padStart(4, '0');
  } else {
    state.cP++;
    localStorage.setItem('md3_cP', state.cP);
    return 'P12' + String(state.cP).padStart(4, '0');
  }
}

// ── Firebase listeners (called once from main.js init) ────────
// Render callbacks are injected by main.js to avoid circular imports.
let _renderCallbacks = null;

export function initFirebaseListeners(callbacks) {
  _renderCallbacks = callbacks;

  // Load initial snapshot from Firebase, then subscribe to changes
  get(ref(db, '/')).then(snapshot => {
    const data = snapshot.val();
    if (!data) return; // empty DB — local state is authoritative
    _applySnapshot(data);
    _renderCallbacks.renderAll();
  }).catch(e => console.warn('Firebase initial load failed:', e.message));

  // Live listeners — fire whenever ANY device writes
  onValue(ref(db, 'murid'), snap => {
    state.murid = objToArray(snap.val());
    saveLocal();
    _renderCallbacks?.renderMurid();
    _renderCallbacks?.updateStats();
  });

  onValue(ref(db, 'rekod'), snap => {
    state.rekod = objToArray(snap.val());
    saveLocal();
    _renderCallbacks?.renderScan();
    _renderCallbacks?.renderLB();
    _renderCallbacks?.updateStats();
  });

  onValue(ref(db, 'larian'), snap => {
    if (!snap.val()) return;
    state.larian = snap.val();
    saveLocal();
    _renderCallbacks?.updateKUI('L12');
    _renderCallbacks?.updateKUI('P12');
  });

  onValue(ref(db, 'counters'), snap => {
    if (!snap.val()) return;
    state.cL = snap.val().cL ?? state.cL;
    state.cP = snap.val().cP ?? state.cP;
    localStorage.setItem('md3_cL', state.cL);
    localStorage.setItem('md3_cP', state.cP);
  });
}

function _applySnapshot(data) {
  if (data.murid)    state.murid   = objToArray(data.murid);
  if (data.rekod)    state.rekod   = objToArray(data.rekod);
  if (data.larian)   state.larian  = data.larian;
  if (data.counters) {
    state.cL = data.counters.cL ?? state.cL;
    state.cP = data.counters.cP ?? state.cP;
  }
  saveLocal();
}
