# Daftar School-Lookup + Admin Registration Control Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Merge Semak tab into Daftar tab with school-code lookup, restrict participant view to own school only, add registration open/close toggle for admin, and add full participant management in admin panel.

**Architecture:** Refactor `register.js` (school-lookup flow, regOpen guard), extend `admin.js` (reg toggle + full participant list), update `store.js` (regOpen state + onConfigChange callback), update `main.js` (new imports + onConfigChange), rewrite `index.html` (remove Semak tab, new Daftar layout, new admin accordions), minor `style.css` additions. Keep `firebase.js`, `utils.js`, `leaderboard.js`, `timer.js`, `scanner.js` unchanged.

**Tech Stack:** Vite 5, vite-plugin-singlefile, Firebase RTDB, vanilla JS ES modules.

---

## Task 1: Update `src/store.js` — add `regOpen` state + `onConfigChange` callback

**Files:**
- Modify: `src/store.js`

**Step 1: Add `regOpen` to state object (after `gsUrl` line)**

```js
  regOpen:       true,  // loaded from Firebase /config/regOpen
```

**Step 2: Update the `/config` onValue listener to load `regOpen` and fire `onConfigChange`**

Replace existing config listener block:

```js
  onValue(ref(db, 'config'), snap => {
    if (!snap.val()) return;
    state.geminiKey = snap.val().geminiKey || '';
    state.gsUrl     = snap.val().gsUrl     || '';
    state.regOpen   = snap.val().regOpen !== false; // default true if not set
    _renderCallbacks?.onConfigChange?.();
  });
```

**Step 3: Verify**

Run: `npm run build` — should complete with `✓ 21 modules transformed`.

**Step 4: Commit**

```bash
git add src/store.js
git commit -m "feat(store): add regOpen state, onConfigChange callback"
```

---

## Task 2: Rewrite `src/modules/register.js` — school-lookup flow + registration lock

**Files:**
- Modify: `src/modules/register.js` (full replacement)

**Step 1: Write the new file**

Replace entire file content with:

```js
import { state, save, jana } from '../store.js';
import { esc, dl, toast }    from './utils.js';
import { updateStats }       from './leaderboard.js';
import { renderScan }        from './scanner.js';
import { renderLB }          from './leaderboard.js';
import { updateKUI }         from './timer.js';

// ── Module-level session state ────────────────────────────────
let _kodSkl  = '';
let _namaSkl = '';

// ── Step 0: School code lookup ────────────────────────────────
export function semakSekolahDaftar() {
  const kod = document.getElementById('d-lookup-kod').value.trim().toUpperCase();
  if (!kod) { toast('Sila masukkan Kod Sekolah.', 'err'); return; }
  const match = state.murid.find(m => (m.kodSkl || '').toUpperCase() === kod);
  if (match) {
    _kodSkl  = kod;
    _namaSkl = match.sekolah;
    _showStudentForm();
    toast(`Sekolah ${_namaSkl} ditemui.`, 'ok');
  } else {
    // New school — show name registration form
    document.getElementById('d-lookup-form').style.display   = 'none';
    document.getElementById('daftar-skl-form').style.display = '';
    document.getElementById('d-kod').value = kod; // pre-fill code
    setTimeout(() => document.getElementById('d-nama').focus(), 100);
  }
}

// ── Step 1: Register new school name ─────────────────────────
export function simpanSekolah() {
  const kod  = document.getElementById('d-kod').value.trim().toUpperCase();
  const nama = document.getElementById('d-nama').value.trim().toUpperCase();
  if (!kod)  { toast('Sila masukkan Kod Sekolah.', 'err'); return; }
  if (!nama) { toast('Sila masukkan Nama Sekolah.', 'err'); return; }
  _kodSkl  = kod;
  _namaSkl = nama;
  _showStudentForm();
}

export function tukarSekolah() {
  _kodSkl = ''; _namaSkl = '';
  document.getElementById('d-lookup-form').style.display    = '';
  document.getElementById('daftar-skl-form').style.display  = 'none';
  document.getElementById('daftar-murid-form').style.display = 'none';
  document.getElementById('d-lookup-kod').value = '';
  renderMurid();
}

function _showStudentForm() {
  document.getElementById('d-lookup-form').style.display    = 'none';
  document.getElementById('daftar-skl-form').style.display  = 'none';
  document.getElementById('daftar-murid-form').style.display = '';
  document.getElementById('d-skl-badge').textContent = `${_kodSkl} · ${_namaSkl}`;
  _applyRegState();
  renderMurid();
}

export function applyRegState() {
  if (document.getElementById('daftar-murid-form')?.style.display === 'none') return;
  _applyRegState();
  renderMurid();
}

function _applyRegState() {
  if (state.regOpen) {
    document.getElementById('daftar-add-form').style.display = '';
    document.getElementById('reg-closed-msg').style.display  = 'none';
    setTimeout(() => document.getElementById('d-mnama')?.focus(), 100);
  } else {
    document.getElementById('daftar-add-form').style.display = 'none';
    document.getElementById('reg-closed-msg').style.display  = '';
  }
}

// ── Step 2: Register student ──────────────────────────────────
export function daftarPeserta() {
  if (!state.regOpen) { toast('Pendaftaran ditutup oleh admin.', 'err'); return; }
  const nama = document.getElementById('d-mnama').value.trim();
  const ic   = document.getElementById('d-mic').value.replace(/[^0-9]/g, '');
  const kat  = document.querySelector('input[name="d-kat"]:checked')?.value || 'L12';

  if (!nama)            { toast('Sila masukkan nama peserta.', 'err'); return; }
  if (ic.length !== 12) { toast('No. IC mesti tepat 12 digit.', 'err'); return; }

  const lastDigit = parseInt(ic[11]);
  const icGender  = lastDigit % 2 !== 0 ? 'L12' : 'P12';
  const jantina   = icGender === 'L12' ? 'Lelaki' : 'Perempuan';
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
  document.getElementById('d-mnama').value = '';
  document.getElementById('d-mic').value   = '';
  document.getElementById('d-mnama').focus();
  toast(`✅ ${nama} — ${nombor}`, 'ok');
}

// ── BIB print ─────────────────────────────────────────────────
export function cetakBIB() {
  const data = _kodSkl
    ? state.murid.filter(m => (m.kodSkl || '').toUpperCase() === _kodSkl)
    : state.murid;
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

// ── Participant list (filtered to current school) ─────────────
export function fd(f, el) {
  state.fdAktif = f;
  document.querySelectorAll('#murid-ftabs .ftab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  renderMurid();
}

export function renderMurid() {
  const cari = (document.getElementById('cari-inp')?.value || '').toLowerCase();
  let data = _kodSkl
    ? state.murid.filter(m => (m.kodSkl || '').toUpperCase() === _kodSkl)
    : [];
  if (state.fdAktif !== 'semua') data = data.filter(m => m.kat === state.fdAktif);
  if (cari) data = data.filter(m =>
    m.nama.toLowerCase().includes(cari) ||
    m.ic.includes(cari)
  );
  const schoolTotal = _kodSkl
    ? state.murid.filter(m => (m.kodSkl || '').toUpperCase() === _kodSkl).length
    : 0;
  document.getElementById('jml').textContent = schoolTotal + ' peserta';
  const tb = document.getElementById('tb-murid');
  if (!data.length) {
    tb.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--ink2);padding:28px;font-size:0.83rem;">${_kodSkl ? 'Tiada peserta dijumpai.' : 'Masukkan kod sekolah untuk lihat senarai.'}</td></tr>`;
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
        ${state.regOpen ? `<button class="btn btn-sm btn-ghost" style="color:var(--accent2);" onclick="hapus('${esc(m.id)}')">✕</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

export function hapus(id) {
  if (!state.regOpen) { toast('Pendaftaran ditutup. Hubungi admin untuk padam.', 'err'); return; }
  state.murid = state.murid.filter(m => String(m.id) !== String(id));
  save(); renderMurid(); updateStats();
  toast('Peserta dipadam.', 'ok');
}

export function eksportSenarai() {
  const data = _kodSkl
    ? state.murid.filter(m => (m.kodSkl || '').toUpperCase() === _kodSkl)
    : state.murid;
  if (!data.length) { toast('Tiada data.', 'err'); return; }
  let csv = 'No Series,Nama,IC,Sekolah,Kod Sekolah,Kategori,Jantina,Status Larian\n';
  data.forEach(m => {
    const done = state.rekod.find(r => r.nombor === m.nombor);
    csv += `"${m.nombor}","${m.nama}","${m.ic}","${m.sekolah}","${m.kodSkl||''}",${m.kat},${m.jantina},"${done?'Tamat':'Belum'}"\n`;
  });
  dl(csv, `senarai-${_kodSkl || 'semua'}-${Date.now()}.csv`, 'text/csv');
  toast('Senarai dieksport!', 'ok');
}

// ── Reset ─────────────────────────────────────────────────────
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
  document.getElementById('d-lookup-form').style.display    = '';
  document.getElementById('daftar-skl-form').style.display  = 'none';
  document.getElementById('daftar-murid-form').style.display = 'none';
  document.getElementById('d-lookup-kod').value = '';
  toast('Semua data direset.', 'ok');
}
```

**Step 2: Commit**

```bash
git add src/modules/register.js
git commit -m "refactor(register): school-lookup flow, regOpen guard, school-filtered list"
```

---

## Task 3: Update `src/modules/admin.js` — reg toggle + full participant list

**Files:**
- Modify: `src/modules/admin.js` (full replacement)

**Step 1: Write the new file**

```js
import { state, save } from '../store.js';
import { ref, set }    from 'firebase/database';
import { db }          from '../firebase.js';
import { esc, dl, toast } from './utils.js';

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
  document.getElementById('adm-login').style.display = '';
  document.getElementById('adm-panel').style.display = 'none';
}

function _showPanel() {
  document.getElementById('adm-login').style.display = 'none';
  document.getElementById('adm-panel').style.display = '';
  if (state.geminiKey) document.getElementById('adm-gemini').value = state.geminiKey;
  if (state.gsUrl)     document.getElementById('adm-gs').value     = state.gsUrl;
  _updateRegBtn();
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
  const body   = document.getElementById(id);
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : '';
  if (id === 'acc-peserta' && !isOpen) renderAdminPeserta();
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

// ── Registration toggle ───────────────────────────────────────
export async function toggleReg() {
  const next = !state.regOpen;
  try {
    await set(ref(db, 'config/regOpen'), next);
    state.regOpen = next;
    _updateRegBtn();
    toast(next ? '🔓 Pendaftaran DIBUKA.' : '🔒 Pendaftaran DITUTUP.', 'ok');
  } catch (e) { toast('Gagal: ' + e.message, 'err'); }
}

function _updateRegBtn() {
  const btn = document.getElementById('btn-toggle-reg');
  const st  = document.getElementById('adm-reg-status');
  if (!btn || !st) return;
  if (state.regOpen) {
    btn.textContent = '🔒 Tutup Pendaftaran';
    btn.className   = 'btn btn-red btn-sm';
    st.innerHTML    = '<span style="color:#52b788;font-weight:700;">● Pendaftaran BUKA</span>';
  } else {
    btn.textContent = '🔓 Buka Pendaftaran';
    btn.className   = 'btn btn-green btn-sm';
    st.innerHTML    = '<span style="color:var(--accent2);font-weight:700;">● Pendaftaran DITUTUP</span>';
  }
}

// ── Full participant list (admin override — ignores regOpen) ──
export function renderAdminPeserta() {
  const tb = document.getElementById('tb-adm-peserta');
  if (!tb) return;
  document.getElementById('adm-jml').textContent = state.murid.length + ' peserta';
  if (!state.murid.length) {
    tb.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--ink2);padding:20px;">Tiada peserta berdaftar.</td></tr>`;
    return;
  }
  tb.innerHTML = state.murid.map(m => {
    const done = state.rekod.find(r => r.nombor === m.nombor);
    return `<tr>
      <td class="mono" style="font-weight:600;">${esc(m.nombor)}</td>
      <td>${esc(m.nama)}</td>
      <td class="mono" style="font-size:0.72rem;color:var(--ink2);">${esc(m.ic)}</td>
      <td>${esc(m.sekolah)} <span style="font-size:0.7rem;color:var(--ink2);">(${esc(m.kodSkl||'')})</span></td>
      <td><span class="badge ${m.kat==='L12'?'bg-b':'bg-p'}">${esc(m.kat)}</span></td>
      <td>${done ? '<span class="badge bg-g">✓ Tamat</span>' : '<span class="badge bg-x">Belum</span>'}</td>
      <td><button class="btn btn-sm btn-ghost" style="color:var(--accent2);" onclick="hapusAdmin('${esc(m.id)}')">✕</button></td>
    </tr>`;
  }).join('');
}

export function hapusAdmin(id) {
  state.murid = state.murid.filter(m => String(m.id) !== String(id));
  save();
  renderAdminPeserta();
  window.renderMurid?.();
  window.updateStats?.();
  toast('Peserta dipadam (admin).', 'ok');
}

export function eksportAdminCSV() {
  if (!state.murid.length) { toast('Tiada data.', 'err'); return; }
  let csv = 'No Series,Nama,IC,Sekolah,Kod Sekolah,Kategori,Jantina,Status Larian\n';
  state.murid.forEach(m => {
    const done = state.rekod.find(r => r.nombor === m.nombor);
    csv += `"${m.nombor}","${m.nama}","${m.ic}","${m.sekolah}","${m.kodSkl||''}",${m.kat},${m.jantina},"${done?'Tamat':'Belum'}"\n`;
  });
  dl(csv, `semua-peserta-${Date.now()}.csv`, 'text/csv');
  toast('CSV dieksport!', 'ok');
}
```

**Step 2: Commit**

```bash
git add src/modules/admin.js
git commit -m "feat(admin): reg toggle, full participant list with admin delete + export"
```

---

## Task 4: Update `src/main.js` — new imports + `onConfigChange` callback

**Files:**
- Modify: `src/main.js` (full replacement)

**Step 1: Write the new file**

```js
import './style.css';
import { state, initFirebaseListeners } from './store.js';
import { fDur }                         from './modules/utils.js';
import {
  semakSekolahDaftar, simpanSekolah, tukarSekolah, daftarPeserta,
  fd, renderMurid, hapus, eksportSenarai,
  tanyaReset, tutupModal, doReset,
  cetakBIB, cetakBIBSatu, applyRegState,
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
  toggleReg, renderAdminPeserta, hapusAdmin, eksportAdminCSV,
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
  semakSekolahDaftar, simpanSekolah, tukarSekolah, daftarPeserta,
  fd, renderMurid, hapus, eksportSenarai,
  tanyaReset, tutupModal, doReset,
  cetakBIB, cetakBIBSatu,
  mula, tamat,
  proses, toggleCam, stopCam, tangkap,
  sahkan, batalPending,
  flb, semakSekolah, eksportSekolah, eksportCSV,
  bukaAdmin, tutupAdmin, loginAdmin, logoutAdmin,
  toggleAcc, simpanGeminiKey, simpanGSUrl,
  toggleReg, renderAdminPeserta, hapusAdmin, eksportAdminCSV,
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
    onConfigChange: applyRegState,
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
git commit -m "refactor(main): add semakSekolahDaftar, toggleReg, admin peserta imports"
```

---

## Task 5: Rewrite `index.html` — remove Semak tab, new Daftar layout, new admin accordions

**Files:**
- Modify: `index.html` (full replacement)

**Step 1: Write the new file**

Key changes from current:
1. Nav: remove `🏫 Semak` button; Daftar is now first
2. Remove `page-semak` entirely
3. Daftar page: add `d-lookup-form` (Step 0), keep `daftar-skl-form` (Step 1 — new school only), update `daftar-murid-form` to include `daftar-add-form` wrapper + `reg-closed-msg`
4. Admin modal: add `🔒 Status Pendaftaran` accordion + `📋 Senarai Peserta Berdaftar` accordion

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
    <button class="nb active" onclick="gp('daftar',this)">📝 <span>Daftar</span></button>
    <button class="nb" onclick="gp('kawalan',this)">🏁 <span>Kawalan</span></button>
    <button class="nb" onclick="gp('scan',this)">📷 <span>Scan</span></button>
    <button class="nb" onclick="gp('keputusan',this)">🏆 <span>Keputusan</span></button>
  </div>
</div>
<div id="toast"></div>

<!-- ================================================================ -->
<!-- PAGE: DAFTAR (DEFAULT) -->
<!-- ================================================================ -->
<div class="page active" id="page-daftar">
  <div class="ph">Pendaftaran Peserta</div>
  <div class="ps">Masukkan kod sekolah untuk semak atau daftar peserta.</div>

  <!-- Step 0: School code lookup -->
  <div class="card" id="d-lookup-form" style="margin-bottom:16px; max-width:520px;">
    <div class="cl">🏫 Kod Sekolah</div>
    <div class="fl">
      <div>
        <label class="lbl">Masukkan Kod Sekolah</label>
        <input class="inp" id="d-lookup-kod" placeholder="PBB1013" maxlength="20"
          oninput="this.value=this.value.toUpperCase()"
          onkeydown="if(event.key==='Enter')semakSekolahDaftar()">
      </div>
      <button class="btn btn-green btn-full" onclick="semakSekolahDaftar()">Semak &amp; Teruskan →</button>
    </div>
  </div>

  <!-- Step 1: New school name (hidden until lookup finds no match) -->
  <div class="card" id="daftar-skl-form" style="display:none; margin-bottom:16px; max-width:520px;">
    <div class="cl">🏫 Daftar Sekolah Baru</div>
    <div style="font-size:0.78rem; color:var(--ink2); margin-bottom:12px;">Kod sekolah ini belum wujud dalam sistem. Sila masukkan nama sekolah untuk mendaftar.</div>
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
      <div style="display:flex;gap:8px;">
        <button class="btn btn-ghost" onclick="tukarSekolah()">← Semak Semula</button>
        <button class="btn btn-green" style="flex:1;" onclick="simpanSekolah()">Teruskan → Daftar Peserta</button>
      </div>
    </div>
  </div>

  <!-- Step 2: Student form (hidden until school confirmed) -->
  <div id="daftar-murid-form" style="display:none;">
    <div class="card" style="margin-bottom:16px; max-width:520px;">
      <div class="cl" style="justify-content:space-between; flex-wrap:wrap; gap:6px;">
        <span>➕ Daftar Peserta</span>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span id="d-skl-badge" class="badge bg-x" style="font-size:0.72rem;"></span>
          <button class="btn btn-sm btn-ghost" onclick="tukarSekolah()">✏️ Tukar Sekolah</button>
        </div>
      </div>

      <!-- Registration closed message -->
      <div id="reg-closed-msg" style="display:none;" class="alert al-a" style="margin-bottom:12px;">
        🔒 Pendaftaran ditutup oleh admin. Tiada penambahan atau pemadaman dibenarkan.
      </div>

      <!-- Add form (hidden when registration closed) -->
      <div id="daftar-add-form">
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
    <input class="inp" id="cari-inp" placeholder="🔍 Cari nama atau IC..." oninput="renderMurid()" style="margin-bottom:12px;">
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
        <input class="bib-inp" id="bib-inp" placeholder="L0045" maxlength="10"
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

<!-- BIB PRINT AREA -->
<div id="bib-print-area" class="bib-print-area"></div>

<!-- ================================================================ -->
<!-- MODAL: ADMIN -->
<!-- ================================================================ -->
<div class="modal-bg" id="modal-admin">
  <div class="modal" style="max-width:520px;">
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

      <!-- Accordion: Registration Status -->
      <div class="acc-section">
        <button class="acc-hdr" onclick="toggleAcc('acc-reg')">🔒 Status Pendaftaran</button>
        <div class="acc-body" id="acc-reg" style="display:none;">
          <div id="adm-reg-status" style="margin-bottom:10px; font-size:0.82rem;"></div>
          <button id="btn-toggle-reg" class="btn btn-red btn-sm" onclick="toggleReg()">🔒 Tutup Pendaftaran</button>
        </div>
      </div>

      <!-- Accordion: Full Participant List -->
      <div class="acc-section">
        <button class="acc-hdr" onclick="toggleAcc('acc-peserta')">📋 Senarai Peserta Berdaftar</button>
        <div class="acc-body" id="acc-peserta" style="display:none;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:6px;">
            <span id="adm-jml" class="badge bg-x">0 peserta</span>
            <button class="btn btn-sm btn-ghost" onclick="eksportAdminCSV()">📥 Eksport CSV</button>
          </div>
          <div class="tw">
            <table>
              <thead><tr><th>No. Series</th><th>Nama</th><th>IC</th><th>Sekolah</th><th>Kat.</th><th>Status</th><th></th></tr></thead>
              <tbody id="tb-adm-peserta"></tbody>
            </table>
          </div>
        </div>
      </div>

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

<!-- MODAL RESET -->
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
git commit -m "refactor(html): merge Semak into Daftar, school lookup, reg-closed msg, admin reg+peserta"
```

---

## Task 6: Add CSS to `src/style.css` — reg-closed alert

**Files:**
- Modify: `src/style.css` (append)

**Step 1: Append to end of file**

The existing `.alert.al-a` class (amber warning) already covers `#reg-closed-msg`. No new CSS needed — the `al-a` class is already defined.

However, add a bottom margin fix for the reg-closed msg inside the card:

```css
/* ── Registration closed notice ─────────────────────────────── */
#reg-closed-msg {
  margin-bottom: 0;
}
```

**Step 2: Commit**

```bash
git add src/style.css
git commit -m "fix(css): reg-closed-msg margin"
```

---

## Task 7: Build & Verify

**Step 1: Build**

```bash
cd C:/Users/yuuta/Documents/GitHub/SISMD && npm run build
```

Expected: `✓ 21 modules transformed` (or 22 if new module added), zero errors.

**Step 2: Smoke test checklist**

1. App opens on **Daftar** tab (not Semak — tab removed)
2. Enter existing school code → school's participants shown, add form visible
3. Enter unknown code → school name form shown
4. Admin → 🔒 Status Pendaftaran → Tutup → add form hides, delete buttons hide
5. Admin → 📋 Senarai Peserta → all schools listed, delete works (bypasses lock)
6. Admin → eksport CSV downloads all participants

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: school-lookup daftar, admin reg toggle, admin full participant list"
git push origin main
```
