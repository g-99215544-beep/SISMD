# Google Sheets Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** After every bib scan, POST one row (rank, name, school, duration, finish time) to a Google Apps Script Web App that appends it to the matching sheet tab (`L12 Results` or `P12 Results`) inside the operator's Google Spreadsheet.

**Architecture:** Three additive changes on top of the completed file-structure plan. `postToSheets()` in `scanner.js` fires a fire-and-forget `fetch()` POST after `save()`. A config bar in `index.html` lets the operator paste the Apps Script URL once; it's stored in `localStorage` as `md3_gs_url`. `simpanGS` is exposed on `window` from `main.js`. The Apps Script (provided as copy-paste code, not deployed by Claude) receives the POST and appends a row.

**Tech Stack:** Vanilla JS `fetch()` (browser), Google Apps Script Web App (operator deploys once in Google Sheets)

---

> **Prerequisite:** Tasks 2–11 of `docs/plans/2026-02-23-file-structure-firebase.md` must be complete before starting. All three source files (`src/modules/scanner.js`, `index.html`, `src/main.js`) must already exist.

---

### Task GS-1: Add postToSheets + setGsStatus + simpanGS to scanner.js

**Files:**
- Modify: `src/modules/scanner.js`

**Step 1: Add the three helper functions at the bottom of scanner.js**

Open `src/modules/scanner.js`. Append these three functions after the last `export function` in the file (after `toggleAK`):

```js
function postToSheets(r, rank) {
  const url = localStorage.getItem('md3_gs_url');
  if (!url) return;
  fetch(url, {
    method: 'POST',
    body: JSON.stringify({
      kat:       r.kat,
      rank,
      nombor:    r.nombor,
      nama:      r.nama,
      sekolah:   r.sekolah,
      kodSkl:    r.kodSkl || '',
      tempoh:    fDur(r.tempoh),
      masaTamat: fW(new Date(r.tamatMs)),
    }),
  })
  .then(() => setGsStatus('ok'))
  .catch(() => setGsStatus('err'));
}

function setGsStatus(s) {
  const el = document.getElementById('gs-st');
  if (!el) return;
  el.innerHTML = s === 'ok'
    ? '<span style="color:var(--accent);">✓ Keputusan dihantar ke Sheets.</span>'
    : '<span style="color:var(--accent2);">✗ Gagal hantar ke Sheets.</span>';
}

export function simpanGS() {
  const v = document.getElementById('gs-inp').value.trim();
  if (!v) { toast('Sila masukkan URL Apps Script.', 'err'); return; }
  localStorage.setItem('md3_gs_url', v);
  const el = document.getElementById('gs-st');
  if (el) el.innerHTML = '<span style="color:var(--accent);">✓ URL disimpan.</span>';
  toast('URL Google Sheets disimpan!', 'ok');
}
```

**Step 2: Call postToSheets() from proses() after save()**

Inside `proses()`, find this line (near the end of the successful-scan block):

```js
  save(); renderScan(); renderLB(); updateStats(); renderMurid();
```

Replace it with:

```js
  const _entry = state.rekod[state.rekod.length - 1];
  save(); postToSheets(_entry, rankKat); renderScan(); renderLB(); updateStats(); renderMurid();
```

**Step 3: Verify the edit looks right**

The `proses()` function now has these two lines in its success path:
```js
  state.rekod.push({ ... });
  const _entry = state.rekod[state.rekod.length - 1];
  save(); postToSheets(_entry, rankKat); renderScan(); renderLB(); updateStats(); renderMurid();
```
`postToSheets` is defined below (not exported — internal to module). `simpanGS` is exported and will be exposed on `window` in Task GS-3.

**Step 4: Commit**

```bash
git add src/modules/scanner.js
git commit -m "feat: add postToSheets, setGsStatus, simpanGS to scanner.js"
```

---

### Task GS-2: Add Google Sheets config bar to index.html (Scan page)

**Files:**
- Modify: `index.html`

**Step 1: Find the insertion point in index.html**

Open `index.html`. In the `<!-- PAGE: SCAN -->` section, find the closing `</div>` of the Claude AI Vision `apibar`. It looks like:

```html
    <div id="ak-st" style="font-size:0.7rem; margin-top:5px; color:var(--ink2);"></div>
  </div>
```

**Step 2: Insert the Google Sheets config bar immediately after that closing `</div>`**

Insert the following block between the Claude AI apibar's closing `</div>` and the `<div id="scan-bar"` line:

```html
  <div class="apibar" style="margin-bottom:14px;">
    <div style="font-size:0.75rem; font-weight:700; color:var(--accent); text-transform:uppercase; letter-spacing:1px;">📊 Google Sheets</div>
    <div style="font-size:0.75rem; color:var(--ink2); margin-top:3px; margin-bottom:8px;">Tampal URL Apps Script untuk hantar keputusan ke Google Sheets secara langsung.</div>
    <div class="api-row">
      <input class="api-inp" id="gs-inp" type="text" placeholder="https://script.google.com/macros/s/...">
      <button class="btn btn-sm btn-ghost" onclick="simpanGS()">Simpan</button>
    </div>
    <div id="gs-st" style="font-size:0.7rem; margin-top:5px; color:var(--ink2);"></div>
  </div>
```

The section should now read (in order):
1. Claude AI Vision `apibar` div (existing)
2. Google Sheets `apibar` div (newly inserted)
3. `<div id="scan-bar" ...>` (existing)

**Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add Google Sheets URL config bar to Scan page"
```

---

### Task GS-3: Expose simpanGS on window + init stored URL in main.js

**Files:**
- Modify: `src/main.js`

**Step 1: Add simpanGS to the import from scanner.js**

Find the import line for scanner.js:

```js
import {
  proses, renderScan, updateScanBar,
  toggleCam, stopCam, tangkap, simpanAK, toggleAK,
} from './modules/scanner.js';
```

Replace it with:

```js
import {
  proses, renderScan, updateScanBar,
  toggleCam, stopCam, tangkap, simpanAK, toggleAK, simpanGS,
} from './modules/scanner.js';
```

**Step 2: Expose simpanGS in Object.assign(window, ...)**

Find the `Object.assign(window, {` block. Find the scanner section:

```js
  proses, toggleCam, stopCam, tangkap, simpanAK, toggleAK,
```

Replace it with:

```js
  proses, toggleCam, stopCam, tangkap, simpanAK, toggleAK, simpanGS,
```

**Step 3: Initialise the GS URL input from localStorage in init()**

In the `init()` function, find this block:

```js
  if (state.apiKey) {
    document.getElementById('ak-inp').value = state.apiKey;
    document.getElementById('ak-st').innerHTML = '<span style="color:var(--accent);">✓ API key tersimpan.</span>';
  }
```

Add immediately after it:

```js
  const _gsUrl = localStorage.getItem('md3_gs_url');
  if (_gsUrl) {
    document.getElementById('gs-inp').value = _gsUrl;
    document.getElementById('gs-st').innerHTML = '<span style="color:var(--accent);">✓ URL tersimpan.</span>';
  }
```

**Step 4: Run dev server and verify end-to-end**

Run: `npm run dev` — open `http://localhost:5173`, navigate to **Scan** page.

Check:
- Google Sheets config bar renders below the Claude AI apibar
- Paste any URL into the input and click Simpan — toast says "URL Google Sheets disimpan!" and status line updates
- Refresh the page — the pasted URL reappears in the input (loaded from localStorage)
- Start a race in Kawalan, scan a bib in Scan — if a valid Apps Script URL is configured the `gs-st` status line updates (✓ or ✗); if no URL is configured, scan works normally without any error

Stop server with Ctrl+C.

**Step 5: Commit**

```bash
git add src/main.js
git commit -m "feat: expose simpanGS on window, restore GS URL on init"
```

---

### Reference: Google Apps Script to deploy manually

The operator deploys this once. It is **not** deployed by Claude — paste it into the Google Spreadsheet bound to the SISMD Drive spreadsheet.

**How to deploy:**
1. Open the Google Spreadsheet in the `SISMD` Drive folder
2. Extensions → Apps Script
3. Replace the default `Code.gs` content with the code below
4. Click **Deploy** → **New deployment** → Type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Click **Deploy**, copy the Web App URL
6. Paste that URL into the Google Sheets config bar in the SisMD app

```js
// Google Apps Script — Code.gs
// Deploy as Web App: Execute as Me, Who has access: Anyone
function doPost(e) {
  const data  = JSON.parse(e.postData.contents);
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(data.kat + ' Results')
              || ss.insertSheet(data.kat + ' Results');

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Rank', 'No. Series', 'Nama', 'Sekolah', 'Kod Sekolah', 'Tempoh', 'Masa Tamat']);
    sheet.getRange(1, 1, 1, 7).setFontWeight('bold');
  }

  sheet.appendRow([
    data.rank,
    data.nombor,
    data.nama,
    data.sekolah,
    data.kodSkl,
    data.tempoh,
    data.masaTamat,
  ]);

  return ContentService.createTextOutput('ok');
}
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/modules/scanner.js` | Add `postToSheets()` (private), `setGsStatus()` (private), `simpanGS()` (export); call `postToSheets()` from `proses()` after `save()` |
| `index.html` | Add Google Sheets apibar (URL input + Simpan button + status line) to Scan page, between Claude AI apibar and scan-bar |
| `src/main.js` | Import + expose `simpanGS` on `window`; restore saved GS URL into input on init |

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| No URL configured | `postToSheets()` returns immediately, scan unaffected |
| POST succeeds | `gs-st` shows ✓ Keputusan dihantar ke Sheets |
| POST fails (network, CORS, wrong URL) | `gs-st` shows ✗ Gagal hantar ke Sheets. Scan is never blocked |
| Sheet not found in spreadsheet | Apps Script creates it automatically |
