# SisMD Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor SisMD to use a school-first Daftar flow, Gemini Flash 3 two-step scan, a hidden admin panel, Firebase-only storage for participants/results, and printable BIB cards.

**Architecture:** Refactor (not rewrite) — keep `firebase.js`, `utils.js`, `leaderboard.js`, `timer.js` unchanged. Rewrite `register.js` and `scanner.js`. Add new `admin.js`. Update `store.js`, `main.js`, `index.html`, and `style.css`.

**Tech Stack:** Vite 5, vite-plugin-singlefile, Firebase RTDB, Gemini 2.0 Flash API (`generativelanguage.googleapis.com`), vanilla JS ES modules.

---

## Pre-flight checks

- Run: `cd C:/Users/yuuta/Documents/GitHub/SISMD && npm run dev`
- Open `http://localhost:5173` — confirm current app works before making changes.

---

## Task 1: Update `src/store.js` — Firebase-only storage + config state

**Files:**
- Modify: `src/store.js`

**Step 1: Read the current file (already done — lines 1-138)**

**Step 2: Apply these three changes**

Change the initial state block (lines 5-20). Remove localStorage loads for `murid` and `rekod`; add `geminiKey` and `gsUrl`:

```js
export const state = {
  murid:  [],   // populated from Firebase on init
  rekod:  [],   // populated from Firebase on init
  larian: JSON.parse(localStorage.getItem('md3_larian') ||
    '{"L12":{"s":"idle","mula":null,"tamat":null},"P12":{"s":"idle","mula":null,"tamat":null}}'),
  cL: parseInt(localStorage.getItem('md3_cL') || '0'),
  cP: parseInt(localStorage.getItem('md3_cP') || '0'),
  geminiKey:     '',   // loaded from Firebase /config
  gsUrl:         '',   // loaded from Firebase /config
  fdAktif:       'semua',
  flbAktif:      'semua',
  prevData:      [],
  prevFilter:    'semua',
  lookupSekolah: '',
  timers:        {},
  camStream:     null,
};
```

Change `saveLocal()` (lines 23-35). Remove murid/rekod from localStorage saves:

```js
function saveLocal() {
  try {
    localStorage.setItem('md3_larian', JSON.stringify(state.larian));
    localStorage.setItem('md3_cL', state.cL);
    localStorage.setItem('md3_cP', state.cP);
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      alert('Storan penuh! Sila eksport dan reset data lama.');
    }
  }
}
```

Add a `/config` listener inside `initFirebaseListeners()` (after the `counters` listener block, before the closing `}`):

```js
  onValue(ref(db, 'config'), snap => {
    if (!snap.val()) return;
    state.geminiKey = snap.val().geminiKey || '';
    state.gsUrl     = snap.val().gsUrl     || '';
  });
```

**Step 3: Verify**

Run: `npm run dev` — no console errors on load.

**Step 4: Commit**

```bash
git add src/store.js
git commit -m "refactor(store): remove localStorage murid/rekod, add config state"
```

---

## Task 2: Create `src/modules/admin.js` — Admin panel logic

**Files:**
- Create: `src/modules/admin.js`

**Step 1: Write the file**

```js
import { state }        from '../store.js';
import { ref, set }     from 'firebase/database';
import { db }           from '../firebase.js';
import { toast }        from './utils.js';

const ADMIN_PASS    = 'admin123';
const ADMIN_EXP_KEY = 'md3_admin_exp';
const SESSION_MS    = 24 * 60 * 60 * 1000;

export function bukaAdmin() {
  const exp = parseInt(localStorage.getItem(ADMIN_EXP_KEY) || '0');
  if (Date.now() < exp) {
    _showPanel();
  } else {
    _showLogin();
  }
  document.getElementById('modal-admin').classList.add('open');
}

export function tutupAdmin() {
  document.getElementById('modal-admin').classList.remove('open');
}

function _showLogin() {
  document.getElementById('adm-login').style.display  = '';
  document.getElementById('adm-panel').style.display  = 'none';
}

function _showPanel() {
  document.getElementById('adm-login').style.display  = 'none';
  document.getElementById('adm-panel').style.display  = '';
  // Pre-fill current values
  if (state.geminiKey) document.getElementById('adm-gemini').value = state.geminiKey;
  if (state.gsUrl)     document.getElementById('adm-gs').value     = state.gsUrl;
}

export function loginAdmin() {
  const pass = document.getElementById('adm-pass').value;
  if (pass !== ADMIN_PASS) { toast('Kata laluan salah.', 'err'); return; }
  localStorage.setItem(ADMIN_EXP_KEY, Date.now() + SESSION_MS);
  document.getElementById('adm-pass').value = '';
  _showPanel();
  toast('Log masuk berjaya!', 'ok');
}

export function logoutAdmin() {
  localStorage.removeItem(ADMIN_EXP_KEY);
  tutupAdmin();
  toast('Log keluar admin.', 'ok');
}

export function toggleAcc(id) {
  const body = document.getElementById(id);
  body.style.display = body.style.display === 'none' ? '' : 'none';
}

export async function simpanGeminiKey() {
  const v = document.getElementById('adm-gemini').value.trim();
  if (!v) { toast('Sila masukkan API key.', 'err'); return; }
  try {
    await set(ref(db, 'config/geminiKey'), v);
    state.geminiKey = v;
    toast('Kunci Gemini disimpan!', 'ok');
  } catch (e) { toast('Gagal simpan: ' + e.message, 'err'); }
}

export async function simpanGSUrl() {
  const v = document.getElementById('adm-gs').value.trim();
  if (!v) { toast('Sila masukkan URL Apps Script.', 'err'); return; }
  try {
    await set(ref(db, 'config/gsUrl'), v);
    state.gsUrl = v;
    toast('URL Google Sheets disimpan!', 'ok');
  } catch (e) { toast('Gagal simpan: ' + e.message, 'err'); }
}
```

**Step 2: Commit**

```bash
git add src/modules/admin.js
git commit -m "feat(admin): add admin login, session, Firebase config save"
```

---

## Task 3: Rewrite `src/modules/register.js` — School-first registration + BIB print

**Files:**
- Modify: `src/modules/register.js` (full replacement)

**Step 1: Write the new file**

Replace the entire file content with:

```js
import { state, save, jana } from '../store.js';
import { esc, dl, toast }    from './utils.js';
import { updateStats }       from './leaderboard.js';
import { renderScan }        from './scanner.js';
import { renderLB }          from './leaderboard.js';
import { updateKUI }         from './timer.js';

// ── Module-level session state (not persisted) ────────────────
let _kodSkl  = '';
let _namaSkl = '';

// ── School form ───────────────────────────────────────────────
export function simpanSekolah() {
  const kod  = document.getElementById('d-kod').value.trim().toUpperCase();
  const nama = document.getElementById('d-nama').value.trim().toUpperCase();
  if (!kod)  { toast('Sila masukkan Kod Sekolah.', 'err'); return; }
  if (!nama) { toast('Sila masukkan Nama Sekolah.', 'err'); return; }
  _kodSkl  = kod;
  _namaSkl = nama;
  document.getElementById('daftar-skl-form').style.display  = 'none';
  document.getElementById('daftar-murid-form').style.display = '';
  document.getElementById('d-skl-badge').textContent = `${_kodSkl} · ${_namaSkl}`;
  setTimeout(() => document.getElementById('d-mnama').focus(), 100);
}

export function tukarSekolah() {
  document.getElementById('daftar-skl-form').style.display   = '';
  document.getElementById('daftar-murid-form').style.display = 'none';
}

// ── Per-student registration ──────────────────────────────────
export function daftarPeserta() {
  const nama = document.getElementById('d-mnama').value.trim();
  const ic   = document.getElementById('d-mic').value.replace(/[^0-9]/g, '');
  const kat  = document.querySelector('input[name="d-kat"]:checked')?.value || 'L12';

  if (!nama)            { toast('Sila masukkan nama peserta.', 'err'); return; }
  if (ic.length !== 12) { toast('No. IC mesti tepat 12 digit.', 'err'); return; }

  // IC gender parity check: last digit odd = Lelaki (L12), even = Perempuan (P12)
  const lastDigit   = parseInt(ic[11]);
  const icGender    = lastDigit % 2 !== 0 ? 'L12' : 'P12';
  const jantina     = icGender === 'L12' ? 'Lelaki' : 'Perempuan';
  if (icGender !== kat) {
    toast(`⚠️ Digit akhir IC (${lastDigit}) tidak sepadan dengan kategori ${kat}. Semak semula.`, 'err');
    return;
  }

  if (state.murid.find(m => m.ic === ic)) {
    toast(`IC ${ic} sudah wujud dalam sistem.`, 'err');
    return;
  }

  const nombor = jana(kat);
  state.murid.push({
    id: crypto.randomUUID(),
    nombor, nama, ic,
    sekolah: _namaSkl, kodSkl: _kodSkl,
    kat, jantina,
  });
  save();
  renderMurid();
  updateStats();

  // Reset only name + IC; school and category stay
  document.getElementById('d-mnama').value = '';
  document.getElementById('d-mic').value   = '';
  document.getElementById('d-mnama').focus();
  toast(`✅ ${nama} — ${nombor}`, 'ok');
}

// ── BIB print ─────────────────────────────────────────────────
export function cetakBIB() {
  const data = state.murid;
  if (!data.length) { toast('Tiada peserta untuk dicetak.', 'err'); return; }
  _renderBIBPrint(data);
  window.print();
}

export function cetakBIBSatu(id) {
  const m = state.murid.find(x => x.id === id);
  if (!m) return;
  _renderBIBPrint([m]);
  window.print();
}

function _renderBIBPrint(list) {
  document.getElementById('bib-print-area').innerHTML = list.map(m => `
    <div class="bib-card">
      <div class="bib-num">${esc(m.nombor)}</div>
      <div class="bib-name">${esc(m.nama)}</div>
    </div>`).join('');
}

// ── Participant list ──────────────────────────────────────────
export function fd(f, el) {
  state.fdAktif = f;
  document.querySelectorAll('#murid-ftabs .ftab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  renderMurid();
}

export function renderMurid() {
  const cari = (document.getElementById('cari-inp')?.value || '').toLowerCase();
  let data = state.fdAktif === 'semua' ? state.murid : state.murid.filter(m => m.kat === state.fdAktif);
  if (cari) data = data.filter(m =>
    m.nama.toLowerCase().includes(cari) ||
    m.ic.includes(cari) ||
    m.sekolah.toLowerCase().includes(cari) ||
    (m.kodSkl || '').toLowerCase().includes(cari)
  );
  document.getElementById('jml').textContent = state.murid.length + ' peserta';
  const tb = document.getElementById('tb-murid');
  if (!data.length) {
    tb.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--ink2);padding:28px;font-size:0.83rem;">Tiada peserta dijumpai.</td></tr>`;
    return;
  }
  tb.innerHTML = data.map(m => {
    const done = state.rekod.find(r => r.nombor === m.nombor);
    return `<tr>
      <td class="mono" style="font-weight:600;">${esc(m.nombor)}</td>
      <td>${esc(m.nama)}</td>
      <td class="mono" style="color:var(--ink2);font-size:0.72rem;">${esc(m.ic)}</td>
      <td>${esc(m.sekolah)}</td>
      <td class="mono" style="font-size:0.75rem;">${esc(m.kodSkl || '-')}</td>
      <td><span class="badge ${m.kat === 'L12' ? 'bg-b' : 'bg-p'}">${esc(m.kat)}</span></td>
      <td>${done ? '<span class="badge bg-g">✓ Tamat</span>' : '<span class="badge bg-x">Belum</span>'}</td>
      <td style="display:flex;gap:4px;">
        <button class="btn btn-sm btn-ghost" title="Cetak BIB" onclick="cetakBIBSatu('${esc(m.id)}')">🖨</button>
        <button class="btn btn-sm btn-ghost" style="color:var(--accent2);" onclick="hapus('${esc(m.id)}')">✕</button>
      </td>
    </tr>`;
  }).join('');
}

export function hapus(id) {
  state.murid = state.murid.filter(m => String(m.id) !== String(id));
  save(); renderMurid(); updateStats();
  toast('Peserta dipadam.', 'ok');
}

export function eksportSenarai() {
  if (!state.murid.length) { toast('Tiada data.', 'err'); return; }
  let csv = 'No Series,Nama,IC,Sekolah,Kod Sekolah,Kategori,Jantina,Status Larian\n';
  state.murid.forEach(m => {
    const done = state.rekod.find(r => r.nombor === m.nombor);
    csv += `"${m.nombor}","${m.nama}","${m.ic}","${m.sekolah}","${m.kodSkl||''}",${m.kat},${m.jantina},"${done?'Tamat':'Belum'}"\n`;
  });
  dl(csv, `senarai-peserta-${Date.now()}.csv`, 'text/csv');
  toast('Senarai dieksport!', 'ok');
}

// ── Reset (called by admin panel via global window.doReset) ───
export function tanyaReset() { document.getElementById('modal-reset').classList.add('open'); }
export function tutupModal()  { document.getElementById('modal-reset').classList.remove('open'); }

export function doReset() {
  state.murid  = [];
  state.rekod  = [];
  state.larian = { L12:{s:'idle',mula:null,tamat:null}, P12:{s:'idle',mula:null,tamat:null} };
  state.cL     = 0;
  state.cP     = 0;
  Object.values(state.timers).forEach(clearInterval);
  save();
  renderMurid(); renderScan(); renderLB(); updateStats();
  updateKUI('L12'); updateKUI('P12');
  tutupModal();
  _kodSkl = ''; _namaSkl = '';
  document.getElementById('daftar-skl-form').style.display   = '';
  document.getElementById('daftar-murid-form').style.display = 'none';
  toast('Semua data direset.', 'ok');
}
```

**Step 3: Verify — run dev server, check no import errors**

Run: `npm run dev` and check browser console.

**Step 4: Commit**

```bash
git add src/modules/register.js
git commit -m "refactor(register): school-first flow, IC gender check, BIB print"
```

---

## Task 4: Update `src/modules/scanner.js` — Gemini Flash 3 + two-step confirm

**Files:**
- Modify: `src/modules/scanner.js` (full replacement)

**Step 1: Write the new file**

Replace entire file content:

```js
import { state, save }         from '../store.js';
import { esc, fDur, fW, toast } from './utils.js';
import { renderMurid }          from './register.js';
import { renderLB, updateStats } from './leaderboard.js';

const GEMINI_URL = key =>
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;

// Module-level pending confirmation state
let _pending = null; // { nombor, nama } | null

export function updateScanBar() {
  const bar = document.getElementById('scan-bar');
  const L = state.larian.L12.s, P = state.larian.P12.s;
  if (L==='running'&&P==='running') { bar.className='alert al-g'; bar.innerHTML='🟢 L12 dan P12 sedang berlari. Sedia untuk rekod.'; }
  else if (L==='running') { bar.className='alert al-g'; bar.innerHTML='🟢 L12 sedang berlari.'; }
  else if (P==='running') { bar.className='alert al-g'; bar.innerHTML='🟢 P12 sedang berlari.'; }
  else if (L==='done'||P==='done') { bar.className='alert al-b'; bar.innerHTML='🔵 Larian selesai. Masih boleh rekod peserta yang tinggal.'; }
  else { bar.className='alert al-a'; bar.innerHTML='⚠️ Tiada larian aktif. Mulakan larian di halaman <strong>Kawalan</strong>.'; }
}

export function proses(val) {
  val = (val || '').trim().toUpperCase();
  const inp  = document.getElementById('bib-inp');
  const sres = document.getElementById('sres');
  sres.className = 'sres show';
  if (!val) return;

  const m = state.murid.find(x => x.nombor === val);
  if (!m) {
    sres.classList.add('err');
    document.getElementById('sres-name').textContent = '❌ Nombor tidak dijumpai';
    document.getElementById('sres-meta').textContent = `"${val}" tidak wujud dalam senarai peserta.`;
    document.getElementById('sres-tm').textContent   = '';
    toast('Nombor tidak dijumpai!', 'err'); inp.select(); return;
  }
  if (state.larian[m.kat].s === 'idle') {
    sres.classList.add('err');
    document.getElementById('sres-name').textContent = `⚠️ Larian ${m.kat} belum dimulakan`;
    document.getElementById('sres-meta').textContent = `Sila mulakan larian ${m.kat} di halaman Kawalan.`;
    document.getElementById('sres-tm').textContent   = '';
    inp.select(); return;
  }
  if (state.rekod.find(r => r.nombor === val)) {
    sres.classList.add('err');
    document.getElementById('sres-name').textContent = '⚠️ Sudah direkod!';
    document.getElementById('sres-meta').textContent = `${m.nama} sudah discan sebelum ini.`;
    document.getElementById('sres-tm').textContent   = '';
    toast('Peserta sudah direkod!', 'err'); inp.select(); return;
  }
  const now    = Date.now();
  const tempoh = now - state.larian[m.kat].mula;
  const rankKat = state.rekod.filter(r => r.kat === m.kat).length + 1;
  state.rekod.push({
    id: crypto.randomUUID(),
    nombor: val, nama: m.nama, sekolah: m.sekolah, kodSkl: m.kodSkl,
    kat: m.kat, mula: state.larian[m.kat].mula, tamatMs: now, tempoh, rankKat,
  });
  const _entry = state.rekod[state.rekod.length - 1];
  save(); postToSheets(_entry, rankKat); renderScan(); renderLB(); updateStats(); renderMurid();
  sres.classList.add('ok');
  document.getElementById('sres-name').textContent = `✅ ${esc(m.nama)}`;
  document.getElementById('sres-meta').textContent = `${esc(m.sekolah)} (${esc(m.kodSkl||'')}) · ${esc(m.kat)}`;
  document.getElementById('sres-tm').textContent   = `🏆 #${rankKat} dalam ${m.kat}  ·  Tempoh: ${fDur(tempoh)}`;
  toast(`#${rankKat} ${m.nama} — ${fDur(tempoh)}`, 'ok');
  inp.value = ''; inp.focus();
}

export function renderScan() {
  document.getElementById('scnt').textContent = state.rekod.length;
  const data = [...state.rekod].reverse().slice(0, 20);
  if (!data.length) {
    document.getElementById('tb-scan').innerHTML = '<tr><td colspan="5" style="text-align:center;color:rgba(250,250,248,0.25);padding:16px;font-size:0.78rem;">Belum ada rekod.</td></tr>';
    return;
  }
  document.getElementById('tb-scan').innerHTML = data.map(r => {
    const rc = r.rankKat===1?'g':r.rankKat===2?'s':r.rankKat===3?'b':'';
    return `<tr>
      <td><span class="rn ${rc}" style="font-size:1rem;">#${r.rankKat}</span></td>
      <td style="color:#fafaf8;">${esc(r.nama)}</td>
      <td><span class="badge ${r.kat==='L12'?'bg-b':'bg-p'}">${esc(r.kat)}</span></td>
      <td style="color:#52b788;font-family:'JetBrains Mono',monospace;font-size:0.82rem;">${fDur(r.tempoh)}</td>
      <td style="color:rgba(250,250,248,0.4);font-family:'JetBrains Mono',monospace;font-size:0.72rem;">${fW(new Date(r.tamatMs))}</td>
    </tr>`;
  }).join('');
}

// ── Camera ────────────────────────────────────────────────────
export async function toggleCam() {
  if (state.camStream) { stopCam(); return; }
  if (!state.geminiKey) { toast('Admin perlu set API key Gemini dahulu.', 'err'); return; }
  try {
    state.camStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment', width:{ideal:1280} } });
    document.getElementById('camv').srcObject          = state.camStream;
    document.getElementById('cam-wrap').classList.add('on');
    document.getElementById('btn-cam').textContent     = '📷 Kamera Aktif';
    document.getElementById('btn-cap').style.display   = 'inline-flex';
    document.getElementById('btn-stopc').style.display = 'inline-flex';
    setAI('ready', 'Kamera aktif. Tekan Tangkap untuk scan.');
  } catch(e) { toast('Tidak dapat akses kamera: ' + e.message, 'err'); }
}

export function stopCam() {
  if (state.camStream) { state.camStream.getTracks().forEach(t => t.stop()); state.camStream = null; }
  document.getElementById('camv').srcObject          = null;
  document.getElementById('cam-wrap').classList.remove('on');
  document.getElementById('btn-cam').textContent     = '📷 Buka Kamera AI';
  document.getElementById('btn-cap').style.display   = 'none';
  document.getElementById('btn-stopc').style.display = 'none';
  setAI('idle', 'Kamera tidak aktif');
}

export async function tangkap() {
  if (!state.camStream) return;
  const v = document.getElementById('camv');
  const c = document.createElement('canvas');
  c.width = v.videoWidth; c.height = v.videoHeight;
  c.getContext('2d').drawImage(v, 0, 0);
  const b64 = c.toDataURL('image/jpeg', 0.85).split(',')[1];
  setAI('think', 'AI sedang membaca nombor bib...');
  try {
    const res = await fetch(GEMINI_URL(state.geminiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { inline_data: { mime_type: 'image/jpeg', data: b64 } },
          { text: 'Gambar ini adalah bib (nombor dada) peserta merentas desa. Cari nombor series pada bib. Format: huruf diikuti nombor, contoh: L120045 atau P120012. Balas dengan nombor series SAHAJA, tiada teks lain. Jika tidak nampak, balas: TIDAK NAMPAK' },
        ]}],
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const txt = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim().toUpperCase().replace(/\s/g, '');
    if (txt === 'TIDAK NAMPAK' || txt.length < 4) {
      setAI('err', 'AI tidak dapat baca nombor. Cuba tangkap semula atau taip manual.');
      toast('AI tidak dapat detect nombor.', 'err');
      return;
    }
    const m = state.murid.find(x => x.nombor === txt);
    _pending = { nombor: txt, nama: m ? m.nama : '???' };
    _showConfirm();
    setAI('ok', `AI detect: ${txt}`);
  } catch(e) { setAI('err', 'Ralat: ' + e.message); toast('Ralat API Gemini: ' + e.message, 'err'); }
}

// ── Two-step confirm ──────────────────────────────────────────
function _showConfirm() {
  const el = document.getElementById('confirm-panel');
  document.getElementById('confirm-nombor').value       = _pending.nombor;
  document.getElementById('confirm-nama-disp').textContent = _pending.nama;
  el.style.display = '';
}

export function sahkan() {
  // Allow manual correction of BIB number
  const corrected = document.getElementById('confirm-nombor').value.trim().toUpperCase();
  _pending = null;
  document.getElementById('confirm-panel').style.display = 'none';
  proses(corrected);
}

export function batalPending() {
  _pending = null;
  document.getElementById('confirm-panel').style.display = 'none';
  setAI('idle', 'Dibatalkan. Tangkap semula atau taip manual.');
}

function setAI(s, msg) {
  document.getElementById('ait').textContent = msg;
  const dot = document.getElementById('aid');
  dot.className = 'ai-dot' + (s==='think'?' think':s==='ok'?' ok':s==='err'?' err':'');
}

// ── Google Sheets ─────────────────────────────────────────────
function postToSheets(r, rank) {
  if (!state.gsUrl) return;
  fetch(state.gsUrl, {
    method: 'POST',
    body: JSON.stringify({
      kat: r.kat, rank, nombor: r.nombor, nama: r.nama,
      sekolah: r.sekolah, kodSkl: r.kodSkl || '',
      tempoh: fDur(r.tempoh), masaTamat: fW(new Date(r.tamatMs)),
    }),
  }).catch(() => {}); // silent fail — GS is secondary
}
```

**Step 2: Verify — run dev server, check no console errors**

**Step 3: Commit**

```bash
git add src/modules/scanner.js
git commit -m "refactor(scanner): Gemini Flash 3 + two-step confirm, remove API bars"
```

---

## Task 5: Update `src/main.js` — new imports + window assignments

**Files:**
- Modify: `src/main.js`

**Step 1: Replace the file**

```js
import './style.css';
import { state, initFirebaseListeners } from './store.js';
import { fDur }                         from './modules/utils.js';
import {
  simpanSekolah, tukarSekolah, daftarPeserta,
  fd, renderMurid, hapus, eksportSenarai,
  tanyaReset, tutupModal, doReset,
  cetakBIB, cetakBIBSatu,
} from './modules/register.js';
import { mula, tamat, updateKUI, startTimer } from './modules/timer.js';
import {
  proses, renderScan, updateScanBar,
  toggleCam, stopCam, tangkap,
  sahkan, batalPending,
} from './modules/scanner.js';
import {
  flb, renderLB, updateStats,
  semakSekolah, eksportSekolah, eksportCSV,
} from './modules/leaderboard.js';
import {
  bukaAdmin, tutupAdmin, loginAdmin, logoutAdmin,
  toggleAcc, simpanGeminiKey, simpanGSUrl,
} from './modules/admin.js';

function gp(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nb').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  el.classList.add('active');
  if (id === 'scan')      { updateScanBar(); setTimeout(() => document.getElementById('bib-inp').focus(), 100); }
  if (id === 'keputusan') { updateStats(); renderLB(); }
}

Object.assign(window, {
  gp,
  simpanSekolah, tukarSekolah, daftarPeserta,
  fd, renderMurid, hapus, eksportSenarai,
  tanyaReset, tutupModal, doReset,
  cetakBIB, cetakBIBSatu,
  mula, tamat,
  proses, toggleCam, stopCam, tangkap,
  sahkan, batalPending,
  flb, semakSekolah, eksportSekolah, eksportCSV,
  bukaAdmin, tutupAdmin, loginAdmin, logoutAdmin,
  toggleAcc, simpanGeminiKey, simpanGSUrl,
});

function init() {
  renderMurid(); renderScan(); renderLB(); updateStats();
  updateKUI('L12'); updateKUI('P12');
  ['L12', 'P12'].forEach(kat => {
    if (state.larian[kat].s === 'running') {
      startTimer(kat);
      document.getElementById(`ct-${kat}`).textContent = fDur(Date.now() - state.larian[kat].mula);
    } else if (state.larian[kat].s === 'done' && state.larian[kat].tamat) {
      document.getElementById(`ct-${kat}`).textContent = fDur(state.larian[kat].tamat - state.larian[kat].mula);
    }
  });

  initFirebaseListeners({
    renderAll:  () => { renderMurid(); renderScan(); renderLB(); updateStats(); updateKUI('L12'); updateKUI('P12'); },
    renderMurid,
    renderScan,
    renderLB,
    updateStats,
    updateKUI,
  });

  window.addEventListener('beforeunload', () => {
    if (state.camStream) state.camStream.getTracks().forEach(t => t.stop());
  });
}

init();
```

**Step 2: Commit**

```bash
git add src/main.js
git commit -m "refactor(main): update imports for new admin, register, scanner modules"
```

---

## Task 6: Rewrite `index.html` — new layout, admin modal, BIB print area

**Files:**
- Modify: `index.html`

**Step 1: Replace the entire file**

```html
<!DOCTYPE html>
<html lang="ms">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<title>SisMD — Sistem Merentas Desa</title>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/src/style.css">
</head>
<body>

<!-- TOPBAR -->
<div class="topbar">
  <div class="logo" onclick="bukaAdmin()" style="cursor:pointer;" title="Admin">Sis<em>MD</em></div>
  <div class="nav">
    <button class="nb active" onclick="gp('semak',this)">🏫 <span>Semak</span></button>
    <button class="nb" onclick="gp('daftar',this)">📝 <span>Daftar</span></button>
    <button class="nb" onclick="gp('kawalan',this)">🏁 <span>Kawalan</span></button>
    <button class="nb" onclick="gp('scan',this)">📷 <span>Scan</span></button>
    <button class="nb" onclick="gp('keputusan',this)">🏆 <span>Keputusan</span></button>
  </div>
</div>
<div id="toast"></div>

<!-- ================================================================ -->
<!-- PAGE: SEMAK (DEFAULT) -->
<!-- ================================================================ -->
<div class="page active" id="page-semak">
  <div class="ph">Semak Penyertaan Sekolah</div>
  <div class="ps">Guru boleh masukkan kod sekolah untuk semak senarai peserta dan status larian mereka.</div>
  <div class="lookup-box">
    <div class="lookup-title">MASUKKAN KOD SEKOLAH</div>
    <div style="font-size:0.78rem; color:rgba(216,243,220,0.35); margin-bottom:16px;">cth: PBB1013</div>
    <div class="lookup-row">
      <input class="lookup-inp" id="kod-inp" placeholder="PBB1013" maxlength="12"
        oninput="this.value=this.value.toUpperCase()"
        onkeydown="if(event.key==='Enter')semakSekolah()">
      <button class="btn btn-green btn-lg" onclick="semakSekolah()">Semak →</button>
    </div>
    <div id="lookup-result" class="lookup-result" style="display:none;"></div>
  </div>
  <div class="card" id="lookup-table-card" style="display:none; margin-top:16px;">
    <div class="cl" style="justify-content:space-between;">
      <span id="lookup-card-title">Senarai Peserta</span>
      <button class="btn btn-sm btn-ghost" onclick="eksportSekolah()">📥 Eksport CSV</button>
    </div>
    <div class="tw">
      <table>
        <thead><tr><th>No. Series</th><th>Nama</th><th>IC</th><th>Kategori</th><th>Status Larian</th><th>Ranking</th><th>Masa</th></tr></thead>
        <tbody id="tb-lookup"></tbody>
      </table>
    </div>
  </div>
</div>

<!-- ================================================================ -->
<!-- PAGE: DAFTAR -->
<!-- ================================================================ -->
<div class="page" id="page-daftar">
  <div class="ph">Pendaftaran Peserta</div>
  <div class="ps">Masukkan maklumat sekolah, kemudian daftar peserta satu per satu mengikut kategori.</div>

  <!-- Step 1: School info -->
  <div class="card" id="daftar-skl-form" style="margin-bottom:16px; max-width:520px;">
    <div class="cl">🏫 Maklumat Sekolah</div>
    <div class="fl">
      <div>
        <label class="lbl">Kod Sekolah</label>
        <input class="inp" id="d-kod" placeholder="PBB1013" maxlength="20"
          oninput="this.value=this.value.toUpperCase()"
          onkeydown="if(event.key==='Enter')document.getElementById('d-nama').focus()">
      </div>
      <div>
        <label class="lbl">Nama Sekolah</label>
        <input class="inp" id="d-nama" placeholder="SK TAMAN MAJU" maxlength="80"
          oninput="this.value=this.value.toUpperCase()"
          onkeydown="if(event.key==='Enter')simpanSekolah()">
      </div>
      <button class="btn btn-green btn-full" onclick="simpanSekolah()">Teruskan → Daftar Peserta</button>
    </div>
  </div>

  <!-- Step 2: Per-student form (hidden until school confirmed) -->
  <div id="daftar-murid-form" style="display:none;">
    <div class="card" style="margin-bottom:16px; max-width:520px;">
      <div class="cl" style="justify-content:space-between; flex-wrap:wrap; gap:6px;">
        <span>➕ Daftar Peserta</span>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span id="d-skl-badge" class="badge bg-x" style="font-size:0.72rem;"></span>
          <button class="btn btn-sm btn-ghost" onclick="tukarSekolah()">✏️ Tukar Sekolah</button>
        </div>
      </div>

      <!-- Category selector -->
      <div style="display:flex; gap:10px; margin-bottom:14px;">
        <label class="kat-btn" style="flex:1;">
          <input type="radio" name="d-kat" value="L12" checked style="display:none;">
          <span class="kat-lbl" data-kat="L12">🔵 L12 — Lelaki</span>
        </label>
        <label class="kat-btn" style="flex:1;">
          <input type="radio" name="d-kat" value="P12" style="display:none;">
          <span class="kat-lbl" data-kat="P12">🟣 P12 — Perempuan</span>
        </label>
      </div>

      <div class="fl">
        <div>
          <label class="lbl">Nama Penuh</label>
          <input class="inp" id="d-mnama" placeholder="Nama peserta" autocomplete="off"
            onkeydown="if(event.key==='Enter')document.getElementById('d-mic').focus()">
        </div>
        <div>
          <label class="lbl">No. IC (12 digit, tanpa sempang)</label>
          <input class="inp" id="d-mic" placeholder="120105101234" maxlength="12"
            inputmode="numeric" autocomplete="off"
            onkeydown="if(event.key==='Enter')daftarPeserta()">
          <div style="font-size:0.71rem; color:var(--ink3); margin-top:4px;">Digit terakhir ganjil = Lelaki · Genap = Perempuan</div>
        </div>
        <button class="btn btn-green btn-full" onclick="daftarPeserta()">✅ Daftar Peserta Ini</button>
      </div>
    </div>
  </div>

  <!-- Participant list -->
  <div class="card">
    <div class="cl" style="justify-content:space-between;">
      <span>📋 Senarai Peserta Berdaftar</span>
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        <span id="jml" class="badge bg-x">0 peserta</span>
        <button class="btn btn-sm btn-ghost" onclick="cetakBIB()">🖨 Cetak BIB</button>
        <button class="btn btn-sm btn-ghost" onclick="eksportSenarai()">📥 Eksport</button>
        <button class="btn btn-sm btn-ghost" style="color:var(--accent2);" onclick="tanyaReset()">🗑 Reset</button>
      </div>
    </div>
    <div class="ftabs" id="murid-ftabs">
      <button class="ftab active" onclick="fd('semua',this)">Semua</button>
      <button class="ftab" onclick="fd('L12',this)">L12</button>
      <button class="ftab" onclick="fd('P12',this)">P12</button>
    </div>
    <input class="inp" id="cari-inp" placeholder="🔍 Cari nama, IC, sekolah atau kod sekolah..." oninput="renderMurid()" style="margin-bottom:12px;">
    <div class="tw">
      <table>
        <thead><tr><th>No. Series</th><th>Nama</th><th>IC</th><th>Sekolah</th><th>Kod</th><th>Kat.</th><th>Status</th><th></th></tr></thead>
        <tbody id="tb-murid"></tbody>
      </table>
    </div>
  </div>
</div>

<!-- ================================================================ -->
<!-- PAGE: KAWALAN -->
<!-- ================================================================ -->
<div class="page" id="page-kawalan">
  <div class="ph">Kawalan Larian</div>
  <div class="ps">Operator garisan mula tekan butang MULA untuk setiap kategori. Masa dikira dari saat butang ditekan (Gun Time).</div>
  <div class="alert al-a">⚠️ Pastikan semua peserta sudah bersedia di garisan mula sebelum tekan MULA. Masa tidak boleh diundur.</div>
  <div class="g2">
    <div class="cat-card" id="cc-L12">
      <div class="cat-big L12">L12</div>
      <div class="cat-st" id="cs-L12">Belum bermula</div>
      <div class="cat-tm" id="ct-L12">--:--:--</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <button class="btn btn-blue btn-full btn-lg" id="bm-L12" onclick="mula('L12')">🏁 MULA L12</button>
        <button class="btn btn-red btn-full" id="bt-L12" onclick="tamat('L12')" disabled>⏹ Tamat Larian L12</button>
      </div>
      <div class="cat-mi" id="cm-L12"></div>
    </div>
    <div class="cat-card" id="cc-P12">
      <div class="cat-big P12">P12</div>
      <div class="cat-st" id="cs-P12">Belum bermula</div>
      <div class="cat-tm" id="ct-P12">--:--:--</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <button class="btn btn-full btn-lg" id="bm-P12" onclick="mula('P12')" style="background:var(--purple);color:#fff;">🏁 MULA P12</button>
        <button class="btn btn-red btn-full" id="bt-P12" onclick="tamat('P12')" disabled>⏹ Tamat Larian P12</button>
      </div>
      <div class="cat-mi" id="cm-P12"></div>
    </div>
  </div>
  <div class="card" style="margin-top:14px;">
    <div class="cl">📋 Log Aktiviti</div>
    <div class="log-box" id="log">Sistem sedia. Menunggu arahan...</div>
  </div>
</div>

<!-- ================================================================ -->
<!-- PAGE: SCAN -->
<!-- ================================================================ -->
<div class="page" id="page-scan">
  <div class="ph">Scan Garisan Penamat</div>
  <div class="ps">Gunakan kamera AI (Gemini) atau taip manual nombor bib peserta yang telah tamat larian.</div>
  <div id="scan-bar" class="alert al-a">⚠️ Tiada larian aktif. Mulakan larian di halaman Kawalan dahulu.</div>
  <div class="scan-shell">
    <div class="scan-head">
      <div class="scan-ht">IMBAS NOMBOR BIB</div>
      <div class="cam-wrap" id="cam-wrap">
        <video id="camv" autoplay playsinline muted></video>
        <div class="cam-ov"><div class="cam-fr"><div class="sl"></div></div></div>
      </div>
      <div class="ai-st"><div class="ai-dot" id="aid"></div><span id="ait">Kamera tidak aktif</span></div>
      <div class="cam-btns">
        <button class="btn btn-blue" id="btn-cam" onclick="toggleCam()">📷 Buka Kamera AI</button>
        <button class="btn btn-green" id="btn-cap" onclick="tangkap()" style="display:none;">⚡ Tangkap &amp; Scan AI</button>
        <button class="btn btn-ghost btn-sm" id="btn-stopc" onclick="stopCam()" style="display:none; color:#fafaf8; border-color:rgba(255,255,255,0.2);">✕ Tutup</button>
      </div>

      <!-- Two-step confirm panel (hidden until AI detects a number) -->
      <div id="confirm-panel" style="display:none; background:rgba(82,183,136,0.12); border:1.5px solid #52b788; border-radius:10px; padding:14px; margin:12px 0; text-align:center;">
        <div style="font-size:0.72rem; color:rgba(250,250,248,0.5); margin-bottom:6px; text-transform:uppercase; letter-spacing:1px;">AI detect — sahkan sebelum rekod</div>
        <div style="font-size:0.82rem; color:rgba(250,250,248,0.7); margin-bottom:8px;">Nama: <strong id="confirm-nama-disp" style="color:#fafaf8;"></strong></div>
        <input class="bib-inp" id="confirm-nombor" maxlength="10" oninput="this.value=this.value.toUpperCase()" style="text-align:center; margin-bottom:10px; font-size:1.4rem; letter-spacing:4px;">
        <div style="display:flex; gap:8px; justify-content:center;">
          <button class="btn btn-ghost btn-sm" onclick="batalPending()" style="color:#fafaf8; border-color:rgba(255,255,255,0.2);">✕ Batal</button>
          <button class="btn btn-green" onclick="sahkan()">✅ Sahkan &amp; Rekod</button>
        </div>
      </div>

      <div style="font-size:0.7rem; color:rgba(250,250,248,0.25); letter-spacing:1px; margin-bottom:10px;">— ATAU TAIP MANUAL —</div>
      <div class="bib-row">
        <input class="bib-inp" id="bib-inp" placeholder="L120045" maxlength="10"
          oninput="this.value=this.value.toUpperCase()"
          onkeydown="if(event.key==='Enter')proses(this.value)">
        <button class="btn btn-green" onclick="proses(document.getElementById('bib-inp').value)" style="padding:12px 16px;font-size:1.1rem;">→</button>
      </div>
      <div class="scan-res-wrap">
        <div class="sres" id="sres">
          <div class="sres-name" id="sres-name"></div>
          <div class="sres-meta" id="sres-meta"></div>
          <div class="sres-tm" id="sres-tm"></div>
        </div>
      </div>
    </div>
    <div class="scan-foot">
      <div class="cl" style="justify-content:space-between; margin-bottom:10px;">
        <span>🕐 Baru Direkod</span>
        <span id="scnt" class="badge bg-g">0</span>
      </div>
      <div class="tw">
        <table>
          <thead><tr><th>#</th><th>Nama</th><th>Kat</th><th>Tempoh</th><th>Masa Tamat</th></tr></thead>
          <tbody id="tb-scan"></tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<!-- ================================================================ -->
<!-- PAGE: KEPUTUSAN -->
<!-- ================================================================ -->
<div class="page" id="page-keputusan">
  <div class="ph">Keputusan &amp; Ranking</div>
  <div class="ps">Papan pendahulu dikemaskini setiap kali peserta direkod.</div>
  <div class="chips">
    <div class="chip"><div class="cv" id="st-tot">0</div><div class="ck">Jumlah Tamat</div></div>
    <div class="chip"><div class="cv" id="st-l">0</div><div class="ck">L12 Tamat</div></div>
    <div class="chip"><div class="cv" id="st-p">0</div><div class="ck">P12 Tamat</div></div>
    <div class="chip"><div class="cv" id="st-d">0</div><div class="ck">Berdaftar</div></div>
  </div>
  <div class="ftabs">
    <button class="ftab active" onclick="flb('semua',this)">Semua</button>
    <button class="ftab" onclick="flb('L12',this)">🔵 L12</button>
    <button class="ftab" onclick="flb('P12',this)">🟣 P12</button>
  </div>
  <div class="card" style="padding:0; overflow:hidden;">
    <div class="lbh"><div>#</div><div>Peserta</div><div>Sekolah</div><div>Tempoh</div><div>No. Series</div></div>
    <div id="lb-body"></div>
  </div>
  <div style="display:flex; gap:10px; margin-top:14px; flex-wrap:wrap;">
    <button class="btn btn-ghost" onclick="eksportCSV()">📥 Eksport CSV</button>
    <button class="btn btn-ghost" onclick="window.print()">🖨 Cetak / PDF</button>
  </div>
</div>

<!-- ================================================================ -->
<!-- BIB PRINT AREA (hidden; shown only during window.print()) -->
<!-- ================================================================ -->
<div id="bib-print-area" class="bib-print-area"></div>

<!-- ================================================================ -->
<!-- MODAL: ADMIN -->
<!-- ================================================================ -->
<div class="modal-bg" id="modal-admin">
  <div class="modal" style="max-width:480px;">
    <h3>🔐 Admin SisMD</h3>

    <!-- Login form -->
    <div id="adm-login">
      <p style="margin:0 0 14px; font-size:0.82rem; color:var(--ink2);">Masukkan kata laluan untuk akses panel admin.</p>
      <input class="inp" id="adm-pass" type="password" placeholder="Kata laluan admin"
        onkeydown="if(event.key==='Enter')loginAdmin()" style="margin-bottom:12px;">
      <div class="ma">
        <button class="btn btn-ghost" onclick="tutupAdmin()">Batal</button>
        <button class="btn btn-green" onclick="loginAdmin()">Log Masuk</button>
      </div>
    </div>

    <!-- Admin panel -->
    <div id="adm-panel" style="display:none;">
      <!-- Accordion: Gemini API Key -->
      <div class="acc-section">
        <button class="acc-hdr" onclick="toggleAcc('acc-gemini')">🔑 Kunci API Gemini</button>
        <div class="acc-body" id="acc-gemini" style="display:none;">
          <p style="font-size:0.78rem; color:var(--ink2); margin-bottom:8px;">Digunakan untuk scan BIB dengan kamera AI. Disimpan di Firebase.</p>
          <input class="inp" id="adm-gemini" type="password" placeholder="AIza..." style="margin-bottom:8px;">
          <button class="btn btn-green btn-sm" onclick="simpanGeminiKey()">Simpan Kunci Gemini</button>
        </div>
      </div>

      <!-- Accordion: Google Sheets URL -->
      <div class="acc-section">
        <button class="acc-hdr" onclick="toggleAcc('acc-gs')">📊 URL Google Sheets</button>
        <div class="acc-body" id="acc-gs" style="display:none;">
          <p style="font-size:0.78rem; color:var(--ink2); margin-bottom:8px;">URL Apps Script untuk hantar keputusan ke Google Sheets. Disimpan di Firebase.</p>
          <input class="inp" id="adm-gs" type="text" placeholder="https://script.google.com/macros/s/..." style="margin-bottom:8px;">
          <button class="btn btn-green btn-sm" onclick="simpanGSUrl()">Simpan URL Sheets</button>
        </div>
      </div>

      <!-- Accordion: Reset Data -->
      <div class="acc-section">
        <button class="acc-hdr" style="color:var(--accent2);" onclick="toggleAcc('acc-reset')">🗑️ Reset Data Firebase</button>
        <div class="acc-body" id="acc-reset" style="display:none;">
          <p style="font-size:0.78rem; color:var(--accent2); margin-bottom:10px;">⚠️ Ini akan memadam SEMUA peserta, rekod larian dan keputusan dari Firebase. Tidak boleh dibatalkan.</p>
          <button class="btn btn-red btn-sm" onclick="doReset(); tutupAdmin();">Ya, Reset Semua Data</button>
        </div>
      </div>

      <div class="ma" style="margin-top:16px; padding-top:14px; border-top:1px solid var(--border);">
        <button class="btn btn-ghost btn-sm" style="color:var(--ink2); font-size:0.75rem;" onclick="logoutAdmin()">Log Keluar Admin</button>
        <button class="btn btn-ghost" onclick="tutupAdmin()">Tutup</button>
      </div>
    </div>
  </div>
</div>

<!-- MODAL RESET (standalone — kept for tanyaReset() call from delete button) -->
<div class="modal-bg" id="modal-reset">
  <div class="modal">
    <h3>⚠️ Reset Semua Data?</h3>
    <p>Ini akan memadam SEMUA peserta, rekod larian dan keputusan. Tidak boleh dibatalkan.</p>
    <div class="ma">
      <button class="btn btn-ghost" onclick="tutupModal()">Batal</button>
      <button class="btn btn-red" onclick="doReset()">Ya, Reset</button>
    </div>
  </div>
</div>

<script type="module" src="/src/main.js"></script>
</body>
</html>
```

**Step 2: Commit**

```bash
git add index.html
git commit -m "refactor(html): school-first daftar, admin modal, scan two-step, Semak default tab"
```

---

## Task 7: Add CSS to `src/style.css` — accordion, BIB print, category selector

**Files:**
- Modify: `src/style.css` (append to end of file)

**Step 1: Append the following CSS to the end of `src/style.css`**

```css
/* ── Category radio buttons (Daftar page) ──────────────────── */
.kat-btn { cursor:pointer; }
.kat-lbl {
  display: block;
  text-align: center;
  padding: 10px 8px;
  border-radius: 8px;
  border: 2px solid var(--border);
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--ink2);
  transition: all 0.15s;
  cursor: pointer;
}
input[name="d-kat"]:checked + .kat-lbl[data-kat="L12"] {
  border-color: var(--blue);
  background: var(--blue-light);
  color: var(--blue);
}
input[name="d-kat"]:checked + .kat-lbl[data-kat="P12"] {
  border-color: var(--purple);
  background: var(--purple-light);
  color: var(--purple);
}

/* ── Admin panel accordion ───────────────────────────────────── */
.acc-section {
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 10px;
  overflow: hidden;
}
.acc-hdr {
  width: 100%;
  text-align: left;
  padding: 11px 14px;
  background: var(--surface2);
  border: none;
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--ink);
  font-family: 'Outfit', sans-serif;
  transition: background 0.15s;
}
.acc-hdr:hover { background: var(--surface3); }
.acc-body {
  padding: 14px;
  border-top: 1px solid var(--border);
  background: var(--surface);
}

/* ── BIB print area ──────────────────────────────────────────── */
.bib-print-area {
  display: none;
}

@media print {
  body > *:not(.bib-print-area) { display: none !important; }
  .bib-print-area {
    display: grid !important;
    grid-template-columns: repeat(2, 1fr);
    gap: 0;
    width: 210mm;
    padding: 10mm;
    box-sizing: border-box;
  }
  .bib-card {
    border: 2px solid #000;
    width: 90mm;
    height: 120mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    page-break-inside: avoid;
    box-sizing: border-box;
    padding: 8mm;
    margin: 2mm;
  }
  .bib-num {
    font-family: 'Bebas Neue', 'Arial Black', sans-serif;
    font-size: 52pt;
    font-weight: 900;
    letter-spacing: 4px;
    color: #000;
    line-height: 1;
    text-align: center;
  }
  .bib-name {
    font-size: 11pt;
    font-weight: 600;
    color: #000;
    text-align: center;
    margin-top: 8mm;
    letter-spacing: 1px;
    text-transform: uppercase;
    line-height: 1.3;
    max-width: 80mm;
  }
}
```

**Step 2: Verify print CSS**

1. Register a test participant in Daftar tab
2. Click "🖨 Cetak BIB" — browser print dialog should open
3. In preview, see 4 BIB cards per A4 (2×2 grid), large number + small name

**Step 3: Commit**

```bash
git add src/style.css
git commit -m "feat(css): accordion, BIB print layout, category radio buttons"
```

---

## Task 8: Smoke test all features

Run: `npm run dev`

**Test checklist:**

1. **Default tab**: App opens on Semak (school lookup) tab — not Daftar
2. **Admin panel**: Click "SisMD" logo → modal opens with login form → type `admin123` → Enter → panel shows with 3 accordion sections (all collapsed)
3. **Gemini key**: Expand "Kunci API Gemini" → paste a key → Save → check Firebase console `/config/geminiKey` has value
4. **GS URL**: Expand "URL Google Sheets" → paste URL → Save → check Firebase `/config/gsUrl`
5. **Daftar flow**:
   - Enter `PBB1013` + `SK TAMAN MAJU` → "Teruskan" → student form appears
   - Enter NAMA + IC `120105101234` with L12 selected (digit `4` is even → should reject for L12) → toast error
   - Enter IC `120105101233` (digit `3` is odd → L12 OK) → "Daftar" → appears in list
   - Verify form clears but school badge stays
6. **BIB print**:
   - Click "🖨 Cetak BIB" → print dialog opens → preview shows big number + small name
   - Click 🖨 icon on individual row → prints just that one BIB
7. **Scan (manual)**: Go to Kawalan → Start L12 → Go to Scan → Type the BIB number from step 5 → Enter → time recorded instantly (no confirm panel for manual entry — this is correct, confirm panel only for AI path)
8. **Scan (camera/AI)**: Open camera → Tangkap → AI reads BIB → confirm panel appears with number pre-filled and name shown → click ✅ Sahkan → time recorded
9. **Admin reset**: Open admin → expand Reset → click reset → all data cleared from Firebase
10. **Admin session**: Refresh page → click SisMD logo → panel should open directly (session valid for 24h)

---

## Task 9: Build and verify output

**Step 1: Build**

```bash
cd C:/Users/yuuta/Documents/GitHub/SISMD && npm run build
```

Expected output: `dist/index.html` as a single self-contained HTML file.

**Step 2: Commit all remaining changes + push**

```bash
git add -A
git commit -m "feat: complete SisMD redesign — Gemini scan, school-first daftar, admin panel"
git push
```
