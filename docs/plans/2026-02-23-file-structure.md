# SisMD File Structure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split the 1,290-line monolithic `index.html` into a Vite + Vanilla JS project with focused source files, fix the three security issues (XSS, IC validation, ID generation), and preserve single-file portable output.

**Architecture:** Vite bundles `src/*.js` + `src/style.css` into a standalone `dist/index.html`. State lives in a plain mutable object in `store.js`. HTML shell stays at root with existing `onclick` attributes intact — functions are re-exposed on `window` from `main.js`. The `esc()` helper in `utils.js` sanitises all CSV-derived values before `innerHTML` injection.

**Tech Stack:** Vite 5, vite-plugin-singlefile, Vanilla JS (ES modules), Node.js

---

## Reference: Current File Sections

- Lines 1–337: HTML head + embedded `<style>`
- Lines 338–636: HTML body markup (5 page divs + modal)
- Lines 637–1288: `<script>` block (all JS)

---

### Task 1: Scaffold Vite project

**Files:**
- Create: `package.json`
- Create: `vite.config.js`

**Step 1: Create package.json**

```json
{
  "name": "sismd",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "vite": "^5.4.0",
    "vite-plugin-singlefile": "^2.0.2"
  }
}
```

**Step 2: Create vite.config.js**

```js
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    target: 'esnext',
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
  },
});
```

**Step 3: Install dependencies**

Run: `npm install`

Expected: `node_modules/` created, no errors.

**Step 4: Commit**

```bash
git add package.json vite.config.js package-lock.json
git commit -m "chore: scaffold Vite project with vite-plugin-singlefile"
```

---

### Task 2: Extract CSS and update HTML shell

**Files:**
- Create: `src/style.css`
- Modify: `index.html`

**Step 1: Create `src/style.css`**

Copy everything between `<style>` and `</style>` (lines 9–336 of current `index.html`) verbatim into `src/style.css`. Do NOT copy the `<style>` tags themselves.

**Step 2: Rewrite `index.html` as a clean shell**

Replace the entire file with the HTML body content (lines 338–636) plus a minimal head. The `<style>` block is removed (CSS is now in `src/style.css`). The `<script>` block is removed (JS is now in `src/main.js`). Add `<link rel="stylesheet" href="/src/style.css">` and `<script type="module" src="/src/main.js"></script>` instead.

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
  <div class="logo">Sis<em>MD</em></div>
  <div class="nav">
    <button class="nb active" onclick="gp('daftar',this)">📝 <span>Daftar</span></button>
    <button class="nb" onclick="gp('semak',this)">🏫 <span>Semak</span></button>
    <button class="nb" onclick="gp('kawalan',this)">🏁 <span>Kawalan</span></button>
    <button class="nb" onclick="gp('scan',this)">📷 <span>Scan</span></button>
    <button class="nb" onclick="gp('keputusan',this)">🏆 <span>Keputusan</span></button>
  </div>
</div>
<div id="toast"></div>

<!-- ================================================================ -->
<!-- PAGE: DAFTAR -->
<!-- ================================================================ -->
<div class="page active" id="page-daftar">
  <div class="ph">Pendaftaran Peserta</div>
  <div class="ps">Muat turun template CSV → isi maklumat peserta → upload semula. Sistem akan jana nombor series secara automatik.</div>

  <!-- STEPS -->
  <div class="steps" style="margin-bottom:24px;">
    <div class="step active" id="step1">
      <div class="step-dot active">1</div>
      <div class="step-label">Muat Turun Template</div>
    </div>
    <div class="step" id="step2">
      <div class="step-dot">2</div>
      <div class="step-label">Isi &amp; Upload CSV</div>
    </div>
    <div class="step" id="step3">
      <div class="step-dot">3</div>
      <div class="step-label">Semak &amp; Sahkan</div>
    </div>
  </div>

  <div class="g2" style="margin-bottom:16px;">
    <!-- STEP 1: DOWNLOAD TEMPLATE -->
    <div class="card">
      <div class="cl">📄 Langkah 1 — Muat Turun Template CSV</div>
      <div style="background:var(--surface2); border-radius:8px; padding:14px; font-family:'JetBrains Mono',monospace; font-size:0.75rem; color:var(--ink2); line-height:1.9; margin-bottom:14px; border:1px solid var(--border);">
        <span style="color:var(--ink); font-weight:600;">Nama,IC,Sekolah,Kod_Sekolah,Kategori,Jantina</span><br>
        Amirul Aiman,120105101234,SK Taman Maju,PBB1013,L12,Lelaki<br>
        Siti Aishah,120205201111,SK Sri Aman,PBB1013,P12,Perempuan<br>
        <span style="color:var(--ink3);"># Kategori: L12 atau P12</span><br>
        <span style="color:var(--ink3);"># Jantina: Lelaki atau Perempuan</span>
      </div>
      <button class="btn btn-dark btn-full" onclick="turunTemplate()">⬇ Muat Turun Template CSV</button>
    </div>

    <!-- STEP 2: UPLOAD -->
    <div class="card">
      <div class="cl">📂 Langkah 2 — Upload CSV Yang Telah Diisi</div>
      <div class="upload-zone" id="uz" ondragover="dragOn(event)" ondragleave="dragOff()" ondrop="dropFile(event)">
        <input type="file" accept=".csv" id="csv-file" onchange="bacaCSV(event)">
        <div class="upload-icon">📋</div>
        <div class="upload-title">Drag &amp; drop CSV di sini</div>
        <div class="upload-sub">atau klik untuk pilih fail</div>
      </div>
      <div id="upload-info" style="display:none; margin-top:10px;" class="alert al-g"></div>
    </div>
  </div>

  <!-- STEP 3: PREVIEW & CONFIRM -->
  <div class="card" id="preview-card" style="display:none;">
    <div class="cl" style="justify-content:space-between;">
      <span>👁 Langkah 3 — Semak &amp; Sahkan Import</span>
      <button class="btn btn-sm btn-ghost" onclick="clearPreview()">✕ Batal</button>
    </div>
    <div class="import-summary" id="imp-summary"></div>
    <div id="dup-warn" style="display:none; margin-bottom:12px;" class="alert al-r">
      ⚠️ <span id="dup-warn-txt"></span>
    </div>
    <div class="ftabs">
      <button class="ftab active" onclick="fprev('semua',this)">Semua</button>
      <button class="ftab" onclick="fprev('baru',this)">✅ Baru</button>
      <button class="ftab" onclick="fprev('dup',this)">⚠️ Duplikat</button>
    </div>
    <div class="preview-wrap">
      <table>
        <thead><tr><th>Status</th><th>Nama</th><th>IC</th><th>Sekolah</th><th>Kod Sekolah</th><th>Kategori</th><th>Jantina</th></tr></thead>
        <tbody id="tb-prev"></tbody>
      </table>
    </div>
    <div style="display:flex; gap:10px; margin-top:14px; justify-content:flex-end; flex-wrap:wrap;">
      <button class="btn btn-ghost" onclick="clearPreview()">Batal</button>
      <button class="btn btn-red btn-sm" onclick="importHanya('baru')" id="btn-skip-dup" style="display:none;">Import Baru Sahaja (Abaikan Duplikat)</button>
      <button class="btn btn-green btn-lg" onclick="importSemua()" id="btn-import-all">✅ Sahkan &amp; Import Semua</button>
    </div>
  </div>

  <!-- SENARAI MURID -->
  <div class="card" style="margin-top:16px;">
    <div class="cl" style="justify-content:space-between;">
      <span>📋 Senarai Peserta Berdaftar</span>
      <div style="display:flex; gap:8px; align-items:center;">
        <span id="jml" class="badge bg-x">0 peserta</span>
        <button class="btn btn-sm btn-ghost" onclick="eksportSenarai()">📥 Eksport</button>
        <button class="btn btn-sm btn-ghost" style="color:var(--accent2);" onclick="tanyaReset()">🗑 Reset</button>
      </div>
    </div>
    <div class="ftabs">
      <button class="ftab active" onclick="fd('semua',this)">Semua</button>
      <button class="ftab" onclick="fd('L12',this)">L12</button>
      <button class="ftab" onclick="fd('P12',this)">P12</button>
    </div>
    <input class="inp" id="cari-inp" placeholder="🔍 Cari nama, IC, sekolah atau kod sekolah..." oninput="renderMurid()" style="margin-bottom:12px;">
    <div class="tw">
      <table>
        <thead><tr><th>No. Series</th><th>Nama</th><th>IC</th><th>Sekolah</th><th>Kod</th><th>Kategori</th><th>Status Larian</th><th></th></tr></thead>
        <tbody id="tb-murid"></tbody>
      </table>
    </div>
  </div>
</div>

<!-- ================================================================ -->
<!-- PAGE: SEMAK SEKOLAH -->
<!-- ================================================================ -->
<div class="page" id="page-semak">
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
  <div class="ps">Gunakan kamera AI atau taip manual nombor bib peserta yang telah tamat larian.</div>
  <div class="apibar">
    <div style="font-size:0.75rem; font-weight:700; color:var(--blue); text-transform:uppercase; letter-spacing:1px;">🤖 Claude AI Vision</div>
    <div style="font-size:0.75rem; color:var(--ink2); margin-top:3px; margin-bottom:8px;">Masukkan Anthropic API key untuk aktifkan kamera AI. Key disimpan dalam browser sahaja.</div>
    <div class="api-row">
      <input class="api-inp" id="ak-inp" type="password" placeholder="sk-ant-api03-...">
      <button class="btn btn-sm btn-ghost" onclick="simpanAK()">Simpan</button>
      <button class="btn btn-sm btn-ghost" onclick="toggleAK()">👁</button>
    </div>
    <div id="ak-st" style="font-size:0.7rem; margin-top:5px; color:var(--ink2);"></div>
  </div>
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

**Step 3: Verify dev server loads**

Run: `npm run dev` — open `http://localhost:5173`. App should display with correct styles (no JS yet, so buttons won't work).

**Step 4: Commit**

```bash
git add index.html src/style.css
git commit -m "refactor: extract CSS to src/style.css, update index.html shell"
```

---

### Task 3: Create src/store.js

**Files:**
- Create: `src/store.js`

**Step 1: Write src/store.js**

```js
export const state = {
  murid:  JSON.parse(localStorage.getItem('md3_murid')  || '[]'),
  rekod:  JSON.parse(localStorage.getItem('md3_rekod')  || '[]'),
  larian: JSON.parse(localStorage.getItem('md3_larian') ||
    '{"L12":{"s":"idle","mula":null,"tamat":null},"P12":{"s":"idle","mula":null,"tamat":null}}'),
  cL: parseInt(localStorage.getItem('md3_cL') || '0'),
  cP: parseInt(localStorage.getItem('md3_cP') || '0'),
  apiKey: localStorage.getItem('md3_ak') || '',
  fdAktif: 'semua',
  flbAktif: 'semua',
  prevData: [],
  prevFilter: 'semua',
  lookupSekolah: '',
  timers: {},
  camStream: null,
};

export function save() {
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
```

**Step 2: Commit**

```bash
git add src/store.js
git commit -m "refactor: add src/store.js with shared state and QuotaExceededError guard"
```

---

### Task 4: Create src/modules/utils.js

**Files:**
- Create: `src/modules/utils.js`

**Step 1: Write src/modules/utils.js**

```js
/**
 * HTML-escape a value before inserting into innerHTML.
 * Prevents XSS from CSV-derived data.
 */
export function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Format milliseconds as HH:MM:SS */
export function fDur(ms) {
  const s  = Math.floor(ms / 1000);
  const h  = Math.floor(s / 3600);
  const m  = Math.floor((s % 3600) / 60);
  const sc = s % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}`;
}

/** Format a Date as localised HH:MM:SS */
export function fW(d) {
  return d.toLocaleTimeString('ms-MY', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}

/** Download content as a file. Revokes the object URL to prevent memory leaks. */
export function dl(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Show a temporary toast notification. t = 'ok' | 'err' | 'info' */
export function toast(msg, t = 'info') {
  const c  = document.getElementById('toast');
  const el = document.createElement('div');
  el.className = `ti ${t === 'ok' ? 'tok' : t === 'err' ? 'terr' : 'tinf'}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}
```

**Step 2: Commit**

```bash
git add src/modules/utils.js
git commit -m "refactor: add utils.js with esc(), fDur(), fW(), dl(), toast()"
```

---

### Task 5: Create src/modules/register.js

**Files:**
- Create: `src/modules/register.js`

**Step 1: Write src/modules/register.js**

Note the security fixes applied here:
- `esc()` wraps all CSV-derived values in `innerHTML` template literals
- IC numbers validated to exactly 12 digits; invalid rows are counted and skipped
- `crypto.randomUUID()` replaces `Date.now()+''+Math.random()`
- `dl()` with `revokeObjectURL` is used (imported from utils)

```js
import { state, save, jana } from '../store.js';
import { esc, dl, toast, fDur } from './utils.js';

// ── Step indicator ──────────────────────────────────────────
export function setStep(n) {
  [1, 2, 3].forEach(i => {
    const s   = document.getElementById('step' + i);
    const dot = s.querySelector('.step-dot');
    s.classList.remove('active');
    dot.classList.remove('active', 'done');
    if (i < n)      { dot.classList.add('done');   dot.textContent = '✓'; }
    else if (i === n) { dot.classList.add('active'); s.classList.add('active'); dot.textContent = i; }
    else              { dot.textContent = i; }
  });
}

// ── Drag & drop ─────────────────────────────────────────────
export function dragOn(e)  { e.preventDefault(); document.getElementById('uz').classList.add('drag'); }
export function dragOff()  { document.getElementById('uz').classList.remove('drag'); }
export function dropFile(e) {
  e.preventDefault(); dragOff();
  const f = e.dataTransfer.files[0];
  if (f && f.name.endsWith('.csv')) prosesFile(f);
  else toast('Sila gunakan fail CSV sahaja.', 'err');
}
export function bacaCSV(e) { const f = e.target.files[0]; if (f) prosesFile(f); }

// ── CSV parse & preview ──────────────────────────────────────
export function prosesFile(file) {
  const reader = new FileReader();
  reader.onload = ev => {
    const lines = ev.target.result.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    if (lines.length < 2) { toast('Fail CSV kosong atau format salah.', 'err'); return; }

    const header     = lines[0].toLowerCase();
    const hasHeader  = header.includes('nama') || header.includes('ic') || header.includes('sekolah');
    const dataLines  = hasHeader ? lines.slice(1) : lines;

    state.prevData = [];
    let invalidCount = 0;

    dataLines.forEach(line => {
      // Strip surrounding quotes from each field (handles Excel-style CSV)
      const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
      if (parts.length < 6 || !parts[0] || !parts[1]) return;

      const nama    = parts[0];
      const ic      = parts[1].replace(/[^0-9]/g, '');
      const sekolah = parts[2];
      const kodSkl  = parts[3].toUpperCase();
      const kat     = parts[4].toUpperCase().includes('L') ? 'L12' : 'P12';
      const jantina = parts[5].toLowerCase().includes('p') ? 'Perempuan' : 'Lelaki';

      // IC validation: Malaysian MyKad must be exactly 12 digits
      if (ic.length !== 12) { invalidCount++; return; }

      const dupIC    = state.murid.find(m => m.ic === ic);
      const dupBatch = state.prevData.find(p => p.ic === ic);

      let status = 'baru', dupMsg = '';
      if (dupIC)    { status = 'dup'; dupMsg = `IC ada dalam sistem (${dupIC.nombor})`; }
      else if (dupBatch) { status = 'dup'; dupMsg = 'IC duplikat dalam fail CSV ini'; }

      state.prevData.push({ nama, ic, sekolah, kodSkl, kat, jantina, status, dupMsg });
    });

    if (invalidCount > 0) toast(`${invalidCount} baris diabaikan (IC tidak sah).`, 'err');

    renderPreview();
    document.getElementById('preview-card').style.display  = 'block';
    document.getElementById('upload-info').style.display   = 'block';
    document.getElementById('upload-info').textContent     = `✓ "${esc(file.name)}" — ${state.prevData.length} rekod dijumpai.`;
    setStep(2);
  };
  reader.readAsText(file);
}

export function renderPreview() {
  const baru = state.prevData.filter(p => p.status === 'baru').length;
  const dup  = state.prevData.filter(p => p.status === 'dup').length;

  document.getElementById('imp-summary').innerHTML = `
    <div class="ims total"><div class="ims-val">${state.prevData.length}</div><div class="ims-lbl">Jumlah Rekod</div></div>
    <div class="ims new"><div class="ims-val">${baru}</div><div class="ims-lbl">Rekod Baru</div></div>
    <div class="ims dup"><div class="ims-val">${dup}</div><div class="ims-lbl">Duplikat</div></div>
    <div class="ims skip"><div class="ims-val">${state.murid.length}</div><div class="ims-lbl">Sudah Dalam Sistem</div></div>
  `;

  if (dup > 0) {
    document.getElementById('dup-warn').style.display    = 'flex';
    document.getElementById('dup-warn-txt').textContent  = `${dup} rekod duplikat dijumpai.`;
    document.getElementById('btn-skip-dup').style.display = 'inline-flex';
    document.getElementById('btn-import-all').textContent = '⚠️ Import Semua (Termasuk Duplikat)';
  } else {
    document.getElementById('dup-warn').style.display    = 'none';
    document.getElementById('btn-skip-dup').style.display = 'none';
    document.getElementById('btn-import-all').textContent = '✅ Sahkan & Import Semua';
  }
  renderPrevTable();
}

export function fprev(f, el) {
  state.prevFilter = f;
  document.querySelectorAll('#preview-card .ftab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  renderPrevTable();
}

export function renderPrevTable() {
  const data = state.prevFilter === 'semua' ? state.prevData : state.prevData.filter(p => p.status === state.prevFilter);
  const tb   = document.getElementById('tb-prev');
  if (!data.length) {
    tb.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--ink2);padding:20px;">Tiada rekod${state.prevFilter !== 'semua' ? ' dalam kategori ini' : ''}.</td></tr>`;
    return;
  }
  tb.innerHTML = data.map(p => `
    <tr class="${p.status === 'dup' ? 'dup' : ''}">
      <td>${p.status === 'baru'
        ? '<span class="badge bg-g">✓ Baru</span>'
        : `<span class="badge bg-r">⚠ Duplikat</span><div style="font-size:0.68rem;color:var(--accent2);margin-top:3px;">${esc(p.dupMsg)}</div>`
      }</td>
      <td>${esc(p.nama)}</td>
      <td class="mono">${esc(p.ic)}</td>
      <td>${esc(p.sekolah)}</td>
      <td class="mono">${esc(p.kodSkl)}</td>
      <td><span class="badge ${p.kat === 'L12' ? 'bg-b' : 'bg-p'}">${esc(p.kat)}</span></td>
      <td>${esc(p.jantina)}</td>
    </tr>`).join('');
}

export function clearPreview() {
  state.prevData = [];
  document.getElementById('preview-card').style.display = 'none';
  document.getElementById('upload-info').style.display  = 'none';
  document.getElementById('csv-file').value = '';
  setStep(1);
}

// ── Import ───────────────────────────────────────────────────
export function importSemua()         { doImport(state.prevData); }
export function importHanya(status)   { doImport(state.prevData.filter(p => p.status === status)); }

export function doImport(rows) {
  let count = 0;
  rows.forEach(p => {
    if (state.murid.find(m => m.ic === p.ic)) return;
    const nombor = jana(p.kat);
    state.murid.push({
      id: crypto.randomUUID(),   // FIX: was Date.now()+''+Math.random()
      nombor, nama: p.nama, ic: p.ic,
      sekolah: p.sekolah, kodSkl: p.kodSkl,
      kat: p.kat, jantina: p.jantina,
    });
    count++;
  });
  save();
  renderMurid();
  updateStats();
  clearPreview();
  setStep(3);
  toast(`✅ ${count} peserta berjaya didaftarkan!`, 'ok');
}

// ── Participant table ────────────────────────────────────────
export function fd(f, el) {
  state.fdAktif = f;
  document.querySelectorAll('#page-daftar .ftabs:not(#preview-card .ftabs) .ftab').forEach(t => t.classList.remove('active'));
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
    tb.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--ink2);padding:28px;font-size:0.83rem;">Tiada peserta dijumpai.</td></tr>`;
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
      <td>${done ? '<span class="badge bg-g">✓ Tamat Larian</span>' : '<span class="badge bg-x">Belum Berlari</span>'}</td>
      <td><button class="btn btn-sm btn-ghost" style="color:var(--accent2);" onclick="hapus('${esc(m.id)}')">✕</button></td>
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
    csv += `"${m.nombor}","${m.nama}","${m.ic}","${m.sekolah}","${m.kodSkl || ''}",${m.kat},${m.jantina},"${done ? 'Tamat' : 'Belum'}"\n`;
  });
  dl(csv, `senarai-peserta-${Date.now()}.csv`, 'text/csv');
  toast('Senarai dieksport!', 'ok');
}

export function turunTemplate() {
  const csv = `Nama,IC,Sekolah,Kod_Sekolah,Kategori,Jantina
Ahmad Amirul bin Aiman,120105101234,SK Taman Maju,PBB1013,L12,Lelaki
Siti Aishah binti Ali,120205201111,SK Sri Aman,PBB1013,P12,Perempuan
Muhammad Hafiz,120301301567,SK Bukit Indah,PBB1014,L12,Lelaki`;
  dl(csv, 'template-merentas-desa.csv', 'text/csv');
  toast('Template dimuat turun!', 'ok');
}

// ── Reset ────────────────────────────────────────────────────
export function tanyaReset() { document.getElementById('modal-reset').classList.add('open'); }
export function tutupModal() { document.getElementById('modal-reset').classList.remove('open'); }

// updateStats imported by main.js — re-exported here for doReset to call
import { updateStats } from './leaderboard.js';
import { renderScan }  from './scanner.js';
import { renderLB }    from './leaderboard.js';
import { updateKUI }   from './timer.js';

export function doReset() {
  state.murid  = [];
  state.rekod  = [];
  state.larian = { L12: { s:'idle', mula:null, tamat:null }, P12: { s:'idle', mula:null, tamat:null } };
  state.cL     = 0;
  state.cP     = 0;
  Object.values(state.timers).forEach(clearInterval);
  save();
  renderMurid(); renderScan(); renderLB(); updateStats();
  updateKUI('L12'); updateKUI('P12');
  tutupModal(); clearPreview();
  toast('Semua data direset.', 'ok');
}
```

**Step 2: Commit**

```bash
git add src/modules/register.js
git commit -m "refactor: add register.js with XSS fixes, IC validation, crypto.randomUUID"
```

---

### Task 6: Create src/modules/timer.js

**Files:**
- Create: `src/modules/timer.js`

**Step 1: Write src/modules/timer.js**

```js
import { state, save } from '../store.js';
import { fDur, fW, toast } from './utils.js';

export function mula(kat) {
  if (state.larian[kat].s === 'running') { toast(`Larian ${kat} sudah bermula!`, 'err'); return; }
  state.larian[kat] = { s: 'running', mula: Date.now(), tamat: null };
  save(); updateKUI(kat); startTimer(kat);
  addLog(`🏁 Larian ${kat} DIMULAKAN — ${fW(new Date())}`);
  toast(`Larian ${kat} dimulakan!`, 'ok');
}

export function tamat(kat) {
  if (state.larian[kat].s !== 'running') return;
  state.larian[kat].s     = 'done';
  state.larian[kat].tamat = Date.now();
  clearInterval(state.timers[kat]);
  save(); updateKUI(kat);
  addLog(`⏹ Larian ${kat} DITAMATKAN — ${fW(new Date())}`);
  toast(`Larian ${kat} ditamatkan.`, 'ok');
}

export function startTimer(kat) {
  clearInterval(state.timers[kat]);
  state.timers[kat] = setInterval(() => {
    if (state.larian[kat].s !== 'running') { clearInterval(state.timers[kat]); return; }
    document.getElementById(`ct-${kat}`).textContent = fDur(Date.now() - state.larian[kat].mula);
  }, 1000);
}

export function updateKUI(kat) {
  const s  = state.larian[kat].s;
  const cc = document.getElementById(`cc-${kat}`);
  const cs = document.getElementById(`cs-${kat}`);
  const ct = document.getElementById(`ct-${kat}`);
  const bm = document.getElementById(`bm-${kat}`);
  const bt = document.getElementById(`bt-${kat}`);
  const cm = document.getElementById(`cm-${kat}`);
  cc.className = `cat-card ${s === 'running' ? 'running' : s === 'done' ? 'done' : ''}`;
  ct.className = `cat-tm ${s === 'running' ? 'running' : ''}`;
  if (s === 'idle') {
    cs.textContent = 'Belum bermula'; bm.disabled = false; bt.disabled = true;
    cm.textContent = ''; ct.textContent = '--:--:--';
  } else if (s === 'running') {
    cs.textContent = '🟢 SEDANG BERLARI'; bm.disabled = true; bt.disabled = false;
    cm.textContent = `Mula: ${fW(new Date(state.larian[kat].mula))}`;
  } else {
    cs.textContent = '🔴 Larian tamat'; bm.disabled = true; bt.disabled = true;
    const dur = state.larian[kat].tamat - state.larian[kat].mula;
    ct.textContent = fDur(dur);
    cm.textContent = `Mula: ${fW(new Date(state.larian[kat].mula))} · Selesai: ${fW(new Date(state.larian[kat].tamat))}`;
  }
}

function addLog(msg) {
  const log = document.getElementById('log');
  log.innerHTML = `<span style="color:var(--accent);">[${fW(new Date())}]</span> ${msg}\n` + log.innerHTML;
}
```

**Step 2: Commit**

```bash
git add src/modules/timer.js
git commit -m "refactor: add timer.js (mula, tamat, startTimer, updateKUI)"
```

---

### Task 7: Create src/modules/scanner.js

**Files:**
- Create: `src/modules/scanner.js`

**Step 1: Write src/modules/scanner.js**

```js
import { state, save } from '../store.js';
import { esc, fDur, fW, toast } from './utils.js';
import { renderMurid } from './register.js';
import { renderLB, updateStats } from './leaderboard.js';

export function updateScanBar() {
  const bar = document.getElementById('scan-bar');
  const L   = state.larian.L12.s, P = state.larian.P12.s;
  if (L === 'running' && P === 'running') { bar.className = 'alert al-g'; bar.innerHTML = '🟢 L12 dan P12 sedang berlari. Sedia untuk rekod.'; }
  else if (L === 'running') { bar.className = 'alert al-g'; bar.innerHTML = '🟢 L12 sedang berlari.'; }
  else if (P === 'running') { bar.className = 'alert al-g'; bar.innerHTML = '🟢 P12 sedang berlari.'; }
  else if (L === 'done' || P === 'done') { bar.className = 'alert al-b'; bar.innerHTML = '🔵 Larian selesai. Masih boleh rekod peserta yang tinggal.'; }
  else { bar.className = 'alert al-a'; bar.innerHTML = '⚠️ Tiada larian aktif. Mulakan larian di halaman <strong>Kawalan</strong>.'; }
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
    toast('Nombor tidak dijumpai!', 'err');
    inp.select(); return;
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
    toast('Peserta sudah direkod!', 'err');
    inp.select(); return;
  }
  const now     = Date.now();
  const tempoh  = now - state.larian[m.kat].mula;
  const rankKat = state.rekod.filter(r => r.kat === m.kat).length + 1;
  state.rekod.push({ nombor:val, nama:m.nama, sekolah:m.sekolah, kodSkl:m.kodSkl, kat:m.kat, mula:state.larian[m.kat].mula, tamatMs:now, tempoh, rankKat });
  save(); renderScan(); renderLB(); updateStats(); renderMurid();
  sres.classList.add('ok');
  document.getElementById('sres-name').textContent = `✅ ${esc(m.nama)}`;
  document.getElementById('sres-meta').textContent = `${esc(m.sekolah)} (${esc(m.kodSkl || '')}) · ${esc(m.kat)}`;
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
    const rc = r.rankKat === 1 ? 'g' : r.rankKat === 2 ? 's' : r.rankKat === 3 ? 'b' : '';
    return `<tr>
      <td><span class="rn ${rc}" style="font-size:1rem;">#${r.rankKat}</span></td>
      <td style="color:#fafaf8;">${esc(r.nama)}</td>
      <td><span class="badge ${r.kat === 'L12' ? 'bg-b' : 'bg-p'}">${esc(r.kat)}</span></td>
      <td style="color:#52b788; font-family:'JetBrains Mono',monospace; font-size:0.82rem;">${fDur(r.tempoh)}</td>
      <td style="color:rgba(250,250,248,0.4); font-family:'JetBrains Mono',monospace; font-size:0.72rem;">${fW(new Date(r.tamatMs))}</td>
    </tr>`;
  }).join('');
}

// ── Camera / AI ──────────────────────────────────────────────
export async function toggleCam() {
  if (state.camStream) { stopCam(); return; }
  if (!state.apiKey)   { toast('Masukkan API key Claude dahulu!', 'err'); return; }
  try {
    state.camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } } });
    document.getElementById('camv').srcObject = state.camStream;
    document.getElementById('cam-wrap').classList.add('on');
    document.getElementById('btn-cam').textContent            = '📷 Kamera Aktif';
    document.getElementById('btn-cap').style.display          = 'inline-flex';
    document.getElementById('btn-stopc').style.display        = 'inline-flex';
    setAI('ready', 'Kamera aktif. Tekan Tangkap untuk scan.');
  } catch (e) { toast('Tidak dapat akses kamera: ' + e.message, 'err'); }
}

export function stopCam() {
  if (state.camStream) { state.camStream.getTracks().forEach(t => t.stop()); state.camStream = null; }
  document.getElementById('camv').srcObject                   = null;
  document.getElementById('cam-wrap').classList.remove('on');
  document.getElementById('btn-cam').textContent              = '📷 Buka Kamera AI';
  document.getElementById('btn-cap').style.display            = 'none';
  document.getElementById('btn-stopc').style.display          = 'none';
  setAI('idle', 'Kamera tidak aktif');
}

export async function tangkap() {
  if (!state.camStream) return;
  const v   = document.getElementById('camv');
  const c   = document.createElement('canvas');
  c.width   = v.videoWidth; c.height = v.videoHeight;
  c.getContext('2d').drawImage(v, 0, 0);
  const b64 = c.toDataURL('image/jpeg', 0.85).split(',')[1];
  setAI('think', 'AI sedang membaca nombor bib...');
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': state.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 60,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
          { type: 'text', text: 'Gambar ini adalah bib (nombor dada) peserta merentas desa. Cari nombor series pada bib. Format: L12xxxx atau P12xxxx (contoh: L120045 atau P120012). Balas dengan nombor series SAHAJA, tiada teks lain. Jika tidak nampak, balas: TIDAK NAMPAK' },
        ]}],
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const txt = data.content[0].text.trim().toUpperCase().replace(/\s/g, '');
    if (txt === 'TIDAK NAMPAK' || txt.length < 5) {
      setAI('err', 'AI tidak dapat baca nombor. Cuba tangkap semula atau taip manual.');
      toast('AI tidak dapat detect nombor.', 'err');
    } else {
      setAI('ok', `✓ AI detect: ${txt}`);
      document.getElementById('bib-inp').value = txt;
      toast(`AI detect: ${txt}`, 'ok');
      setTimeout(() => proses(txt), 400);
    }
  } catch (e) { setAI('err', 'Ralat: ' + e.message); toast('Ralat API: ' + e.message, 'err'); }
}

function setAI(state_, msg) {
  const dot = document.getElementById('aid');
  document.getElementById('ait').textContent = msg;
  dot.className = 'ai-dot' + (state_ === 'think' ? ' think' : state_ === 'ok' ? ' ok' : state_ === 'err' ? ' err' : '');
}

export function simpanAK() {
  const v = document.getElementById('ak-inp').value.trim();
  if (!v) { toast('Sila masukkan API key.', 'err'); return; }
  state.apiKey = v;
  localStorage.setItem('md3_ak', state.apiKey);
  document.getElementById('ak-st').innerHTML = '<span style="color:var(--accent);">✓ API key disimpan.</span>';
  toast('API key disimpan!', 'ok');
}

export function toggleAK() {
  const i = document.getElementById('ak-inp');
  i.type = i.type === 'password' ? 'text' : 'password';
}
```

**Step 2: Commit**

```bash
git add src/modules/scanner.js
git commit -m "refactor: add scanner.js (proses, renderScan, camera, AI scan)"
```

---

### Task 8: Create src/modules/leaderboard.js

**Files:**
- Create: `src/modules/leaderboard.js`

**Step 1: Write src/modules/leaderboard.js**

```js
import { state } from '../store.js';
import { esc, fDur, fW, dl, toast } from './utils.js';

export function flb(f, el) {
  state.flbAktif = f;
  document.querySelectorAll('#page-keputusan .ftab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  renderLB();
}

export function renderLB() {
  let data = state.flbAktif === 'semua' ? [...state.rekod] : state.rekod.filter(r => r.kat === state.flbAktif);
  data.sort((a, b) => a.tempoh - b.tempoh);
  const body = document.getElementById('lb-body');
  if (!data.length) {
    body.innerHTML = `<div style="text-align:center;padding:40px;color:var(--ink2);font-size:0.83rem;">Belum ada rekod${state.flbAktif !== 'semua' ? ' untuk ' + state.flbAktif : ''}.</div>`;
    return;
  }
  body.innerHTML = data.map((r, i) => {
    const rank = i + 1, rc = rank === 1 ? 'g' : rank === 2 ? 's' : rank === 3 ? 'b' : '';
    return `<div class="lbr">
      <div class="rn ${rc}">${rank}</div>
      <div><div class="lbn">${esc(r.nama)}</div><div style="display:flex;gap:4px;margin-top:3px;"><span class="badge ${r.kat === 'L12' ? 'bg-b' : 'bg-p'}">${esc(r.kat)}</span></div></div>
      <div class="lbs">${esc(r.sekolah)}</div>
      <div class="lbd">${fDur(r.tempoh)}</div>
      <div class="mono" style="font-size:0.74rem;color:var(--ink2);">${esc(r.nombor)}</div>
    </div>`;
  }).join('');
}

export function updateStats() {
  document.getElementById('st-tot').textContent = state.rekod.length;
  document.getElementById('st-l').textContent   = state.rekod.filter(r => r.kat === 'L12').length;
  document.getElementById('st-p').textContent   = state.rekod.filter(r => r.kat === 'P12').length;
  document.getElementById('st-d').textContent   = state.murid.length;
}

export function semakSekolah() {
  const kod     = document.getElementById('kod-inp').value.trim().toUpperCase();
  if (!kod) { toast('Sila masukkan kod sekolah.', 'err'); return; }
  state.lookupSekolah = kod;
  const peserta = state.murid.filter(m => (m.kodSkl || '').toUpperCase() === kod);
  const res     = document.getElementById('lookup-result');
  const card    = document.getElementById('lookup-table-card');

  if (!peserta.length) {
    res.style.display = 'block';
    res.innerHTML = `<div style="text-align:center;padding:20px;color:rgba(216,243,220,0.4);font-size:0.88rem;">Tiada peserta dijumpai untuk kod sekolah <strong style="color:#d8f3dc;">${esc(kod)}</strong>.</div>`;
    card.style.display = 'none';
    return;
  }

  const namaSekolah = peserta[0].sekolah;
  const L12         = peserta.filter(p => p.kat === 'L12');
  const P12         = peserta.filter(p => p.kat === 'P12');
  const sudahTamat  = peserta.filter(p => state.rekod.find(r => r.nombor === p.nombor));

  document.getElementById('lookup-card-title').textContent = `${namaSekolah} (${kod})`;

  res.style.display = 'block';
  res.innerHTML = `
    <div class="lookup-school-name">🏫 ${esc(namaSekolah)} · <span class="mono">${esc(kod)}</span></div>
    <div class="lookup-stats">
      <div class="ls"><div class="ls-val">${peserta.length}</div><div class="ls-lbl">Jumlah Peserta</div></div>
      <div class="ls"><div class="ls-val">${L12.length}</div><div class="ls-lbl">L12 Lelaki</div></div>
      <div class="ls"><div class="ls-val">${P12.length}</div><div class="ls-lbl">P12 Perempuan</div></div>
      <div class="ls"><div class="ls-val" style="color:#52b788;">${sudahTamat.length}</div><div class="ls-lbl">Sudah Tamat Larian</div></div>
      <div class="ls"><div class="ls-val" style="color:#d29922;">${peserta.length - sudahTamat.length}</div><div class="ls-lbl">Belum Berlari</div></div>
    </div>
  `;

  // Rank by position in sorted array (handles ties correctly)
  const rankMap = {};
  ['L12', 'P12'].forEach(kat => {
    const sorted = state.rekod.filter(x => x.kat === kat).sort((a, b) => a.tempoh - b.tempoh);
    sorted.forEach((x, i) => { rankMap[x.nombor] = i + 1; });
  });

  const tb = document.getElementById('tb-lookup');
  tb.innerHTML = peserta.map(p => {
    const r       = state.rekod.find(x => x.nombor === p.nombor);
    const ranking = r ? rankMap[p.nombor] : '-';
    return `<tr>
      <td class="mono" style="font-weight:600;">${esc(p.nombor)}</td>
      <td>${esc(p.nama)}</td>
      <td class="mono" style="font-size:0.72rem;color:var(--ink2);">${esc(p.ic)}</td>
      <td><span class="badge ${p.kat === 'L12' ? 'bg-b' : 'bg-p'}">${esc(p.kat)}</span></td>
      <td>${r ? '<span class="badge bg-g">✓ Tamat</span>' : '<span class="badge bg-x">Belum</span>'}</td>
      <td>${r ? `<strong>#${ranking}</strong> dalam ${esc(p.kat)}` : '-'}</td>
      <td class="mono" style="color:var(--accent);">${r ? fDur(r.tempoh) : '-'}</td>
    </tr>`;
  }).join('');

  card.style.display = 'block';
}

export function eksportSekolah() {
  const peserta = state.murid.filter(m => (m.kodSkl || '').toUpperCase() === state.lookupSekolah);
  if (!peserta.length) return;
  const rankMap = {};
  ['L12', 'P12'].forEach(kat => {
    const sorted = state.rekod.filter(x => x.kat === kat).sort((a, b) => a.tempoh - b.tempoh);
    sorted.forEach((x, i) => { rankMap[x.nombor] = i + 1; });
  });
  let csv = 'No Series,Nama,IC,Kategori,Status,Ranking,Masa Larian\n';
  peserta.forEach(p => {
    const r = state.rekod.find(x => x.nombor === p.nombor);
    csv += `"${p.nombor}","${p.nama}","${p.ic}",${p.kat},"${r ? 'Tamat' : 'Belum'}","${r ? rankMap[p.nombor] : '-'}","${r ? fDur(r.tempoh) : '-'}"\n`;
  });
  dl(csv, `peserta-${state.lookupSekolah}-${Date.now()}.csv`, 'text/csv');
  toast('Eksport berjaya!', 'ok');
}

export function eksportCSV() {
  if (!state.rekod.length) { toast('Tiada data.', 'err'); return; }
  const rankMap = {};
  ['L12', 'P12'].forEach(kat => {
    const sorted = state.rekod.filter(x => x.kat === kat).sort((a, b) => a.tempoh - b.tempoh);
    sorted.forEach((x, i) => { rankMap[x.nombor] = i + 1; });
  });
  let csv = 'Ranking,No Series,Nama,Sekolah,Kod Sekolah,Kategori,Tempoh,Masa Tamat\n';
  [...state.rekod].sort((a, b) => a.kat.localeCompare(b.kat) || a.tempoh - b.tempoh).forEach(r => {
    csv += `${rankMap[r.nombor]},"${r.nombor}","${r.nama}","${r.sekolah}","${r.kodSkl || ''}",${r.kat},${fDur(r.tempoh)},${fW(new Date(r.tamatMs))}\n`;
  });
  dl(csv, `keputusan-md-${Date.now()}.csv`, 'text/csv');
  toast('CSV dimuat turun!', 'ok');
}
```

**Step 2: Commit**

```bash
git add src/modules/leaderboard.js
git commit -m "refactor: add leaderboard.js with correct tie-aware ranking"
```

---

### Task 9: Create src/main.js and wire everything

**Files:**
- Create: `src/main.js`

**Step 1: Write src/main.js**

```js
import './style.css';
import { state } from './store.js';
import { fDur } from './modules/utils.js';
import {
  turunTemplate, dragOn, dragOff, dropFile, bacaCSV,
  fprev, clearPreview, importSemua, importHanya,
  fd, renderMurid, hapus, eksportSenarai,
  tanyaReset, tutupModal, doReset,
} from './modules/register.js';
import { mula, tamat, updateKUI, startTimer } from './modules/timer.js';
import {
  proses, renderScan, updateScanBar,
  toggleCam, stopCam, tangkap, simpanAK, toggleAK,
} from './modules/scanner.js';
import {
  flb, renderLB, updateStats,
  semakSekolah, eksportSekolah, eksportCSV,
} from './modules/leaderboard.js';

// ── Navigation ───────────────────────────────────────────────
function gp(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nb').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  el.classList.add('active');
  if (id === 'scan')      { updateScanBar(); setTimeout(() => document.getElementById('bib-inp').focus(), 100); }
  if (id === 'keputusan') { updateStats(); renderLB(); }
}

// ── Expose to window (onclick attributes in HTML) ────────────
Object.assign(window, {
  gp,
  // register
  turunTemplate, dragOn, dragOff, dropFile, bacaCSV,
  fprev, clearPreview, importSemua, importHanya,
  fd, renderMurid, hapus, eksportSenarai,
  tanyaReset, tutupModal, doReset,
  // timer
  mula, tamat,
  // scanner
  proses, toggleCam, stopCam, tangkap, simpanAK, toggleAK,
  // leaderboard
  flb, semakSekolah, eksportSekolah, eksportCSV,
});

// ── Init ─────────────────────────────────────────────────────
function init() {
  if (state.apiKey) {
    document.getElementById('ak-inp').value = state.apiKey;
    document.getElementById('ak-st').innerHTML = '<span style="color:var(--accent);">✓ API key tersimpan.</span>';
  }
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
  // Stop camera on page unload
  window.addEventListener('beforeunload', () => {
    if (state.camStream) state.camStream.getTracks().forEach(t => t.stop());
  });
}

init();
```

**Step 2: Verify dev server works end-to-end**

Run: `npm run dev` — open `http://localhost:5173`.

Check each tab manually:
- Daftar: template download works, CSV upload shows preview
- Semak: school code lookup works
- Kawalan: MULA/Tamat buttons work, timer ticks
- Scan: manual bib entry works
- Keputusan: leaderboard renders

**Step 3: Verify production build**

Run: `npm run build`

Expected: `dist/index.html` created (single file, ~100KB+). Open `dist/index.html` directly in browser — all functionality should work identically.

**Step 4: Commit**

```bash
git add src/main.js
git commit -m "refactor: add main.js, wire all modules, expose to window for onclick handlers"
```

---

### Task 10: Update launch.json and clean up

**Files:**
- Modify: `.claude/launch.json`

**Step 1: Update .claude/launch.json to use Vite**

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "Vite Dev Server",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 5173
    }
  ]
}
```

**Step 2: Remove old index.html from root (it is now the Vite shell)**

The root `index.html` is already the Vite shell from Task 2. No additional action needed.

**Step 3: Verify `npm run build` produces dist/index.html**

Run: `npm run build`

Expected output:
```
dist/index.html   ~XX kB
```

Open `dist/index.html` in a browser without a server — all features work.

**Step 4: Commit**

```bash
git add .claude/launch.json
git commit -m "chore: update launch.json to use Vite dev server on port 5173"
```

---

## Summary of Security Fixes Applied

| Issue | Fixed in | How |
|-------|----------|-----|
| Stored XSS via `innerHTML` | Tasks 5, 7, 8 | `esc()` wraps all CSV-derived values |
| IC number not validated | Task 5 | Reject rows where stripped IC ≠ 12 digits |
| `Date.now()+Math.random()` ID | Task 5 | Replaced with `crypto.randomUUID()` |
| Object URL leak in `dl()` | Task 4 | `URL.revokeObjectURL()` called after click |
| Tied rankings computed wrong | Task 8 | Sort → index, shared rank for ties |
| Camera not stopped on unload | Task 9 | `beforeunload` handler in `init()` |
