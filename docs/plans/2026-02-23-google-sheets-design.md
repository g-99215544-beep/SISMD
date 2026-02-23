# SisMD Google Sheets Integration Design

**Date:** 2026-02-23
**Status:** Approved
**Approach:** Option A — POST on every scan, append rows via Google Apps Script

## Problem

Race results are stored in Firebase and localStorage, but school coordinators and officials cannot view live results without accessing the app directly. A Google Sheets integration would allow anyone with the sheet link to watch rankings update in real-time during the race.

## Goal

After every bib scan, append one row to the matching Google Sheet (`L12 Results` or `P12 Results`) inside the `SISMD` Drive folder. No login required for operators — they paste a single Apps Script URL once.

## Architecture

### Flow

```
Operator scans bib
       ↓
proses() in scanner.js
       ↓
save()  →  localStorage + Firebase (existing)
       ↓
postToSheets()  →  fetch() POST to Apps Script URL (fire-and-forget)
       ↓
Apps Script appends row to correct sheet (L12 or P12)
```

### Google Apps Script

Deployed once as a Web App with "Anyone" execute access. Receives a POST with JSON body, finds the correct sheet by `kat` field, appends one row.

```js
// Google Apps Script — deploy as Web App, Execute as: Me, Who has access: Anyone
function doPost(e) {
  const data   = JSON.parse(e.postData.contents);
  const ss     = SpreadsheetApp.getActiveSpreadsheet();
  const sheet  = ss.getSheetByName(data.kat + ' Results')
               || ss.insertSheet(data.kat + ' Results');

  // Write header row if sheet is empty
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

### Browser-side change (scanner.js)

New `postToSheets(rekodEntry, rank)` helper called from `proses()` after `save()`. Fire-and-forget — a fetch failure never blocks the scan.

```js
function postToSheets(r, rank) {
  const url = localStorage.getItem('md3_gs_url');
  if (!url) return;
  fetch(url, {
    method: 'POST',
    body: JSON.stringify({
      kat: r.kat, rank, nombor: r.nombor, nama: r.nama,
      sekolah: r.sekolah, kodSkl: r.kodSkl || '',
      tempoh: fDur(r.tempoh), masaTamat: fW(new Date(r.tamatMs)),
    }),
  })
  .then(() => setGsStatus('ok'))
  .catch(() => setGsStatus('err'));
}
```

### Configuration UI (Scan page)

A small bar added below the existing API key bar in `index.html`:

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

### Sheet structure

Each category gets its own sheet tab named `L12 Results` and `P12 Results` inside the same Google Spreadsheet (the one the Apps Script is bound to).

| Rank | No. Series | Nama | Sekolah | Kod Sekolah | Tempoh | Masa Tamat |
|------|-----------|------|---------|-------------|--------|-----------|
| 1 | L120001 | Ahmad Amirul | SK Taman Maju | PBB1013 | 00:22:14 | 09:45:32 |

### Error handling

- POST failure: `setGsStatus('err')` shows `✗ Gagal hantar` in the status line. Scan workflow is never blocked.
- No URL configured: `postToSheets()` returns immediately.
- Sheet not found: Apps Script creates it automatically.

## Scope

### Files changed

| File | Change |
|------|--------|
| `src/modules/scanner.js` | Add `postToSheets()`, `setGsStatus()`, `simpanGS()` helpers; call `postToSheets()` from `proses()` after `save()` |
| `index.html` | Add Google Sheets config bar to Scan page |
| `src/main.js` | Expose `simpanGS` on `window` |

### Out of scope

- Updating existing rows (append-only)
- Writing participant registrations to Sheets
- Reading from Sheets
- Multiple spreadsheet URLs per category
