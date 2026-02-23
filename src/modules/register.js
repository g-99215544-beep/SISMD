import { state, save, jana } from '../store.js';
import { esc, dl, toast }    from './utils.js';

export function setStep(n) {
  [1, 2, 3].forEach(i => {
    const s   = document.getElementById('step' + i);
    const dot = s.querySelector('.step-dot');
    s.classList.remove('active');
    dot.classList.remove('active', 'done');
    if (i < n)        { dot.classList.add('done');   dot.textContent = '✓'; }
    else if (i === n) { dot.classList.add('active'); s.classList.add('active'); dot.textContent = i; }
    else              { dot.textContent = i; }
  });
}

export function dragOn(e)  { e.preventDefault(); document.getElementById('uz').classList.add('drag'); }
export function dragOff()  { document.getElementById('uz').classList.remove('drag'); }
export function dropFile(e) {
  e.preventDefault(); dragOff();
  const f = e.dataTransfer.files[0];
  if (f && f.name.endsWith('.csv')) prosesFile(f);
  else toast('Sila gunakan fail CSV sahaja.', 'err');
}
export function bacaCSV(e) { const f = e.target.files[0]; if (f) prosesFile(f); }

export function prosesFile(file) {
  const reader = new FileReader();
  reader.onload = ev => {
    const lines = ev.target.result.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    if (lines.length < 2) { toast('Fail CSV kosong atau format salah.', 'err'); return; }

    const header    = lines[0].toLowerCase();
    const hasHeader = header.includes('nama') || header.includes('ic') || header.includes('sekolah');
    const dataLines = hasHeader ? lines.slice(1) : lines;

    state.prevData = [];
    let invalidCount = 0;

    dataLines.forEach(line => {
      const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
      if (parts.length < 6 || !parts[0] || !parts[1]) return;

      const nama    = parts[0];
      // Handle IC: strip Excel formula wrapper ="..." if present, then handle
      // scientific notation (e.g. 1.20105101234E+11) that Excel auto-generates
      // when a 12-digit number is stored as a numeric cell.
      let _icRaw = parts[1];
      if (_icRaw.startsWith('=')) _icRaw = _icRaw.replace(/^="*|"*$/g, '');
      const ic = /[eE]/.test(_icRaw)
        ? Math.round(parseFloat(_icRaw)).toString()
        : _icRaw.replace(/[^0-9]/g, '');
      const sekolah = parts[2];
      const kodSkl  = parts[3].toUpperCase();
      const kat     = parts[4].toUpperCase().includes('L') ? 'L12' : 'P12';
      const jantina = parts[5].toLowerCase().includes('p') ? 'Perempuan' : 'Lelaki';

      if (ic.length !== 12) { invalidCount++; return; } // IC validation

      const dupIC    = state.murid.find(m => m.ic === ic);
      const dupBatch = state.prevData.find(p => p.ic === ic);
      let status = 'baru', dupMsg = '';
      if (dupIC)       { status = 'dup'; dupMsg = `IC ada dalam sistem (${dupIC.nombor})`; }
      else if (dupBatch) { status = 'dup'; dupMsg = 'IC duplikat dalam fail CSV ini'; }

      state.prevData.push({ nama, ic, sekolah, kodSkl, kat, jantina, status, dupMsg });
    });

    if (invalidCount > 0) toast(`${invalidCount} baris diabaikan (IC tidak sah — mesti 12 digit).`, 'err');
    renderPreview();
    document.getElementById('preview-card').style.display = 'block';
    document.getElementById('upload-info').style.display  = 'block';
    document.getElementById('upload-info').textContent    = `✓ "${file.name}" — ${state.prevData.length} rekod dijumpai.`;
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
    document.getElementById('dup-warn').style.display     = 'flex';
    document.getElementById('dup-warn-txt').textContent   = `${dup} rekod duplikat dijumpai.`;
    document.getElementById('btn-skip-dup').style.display = 'inline-flex';
    document.getElementById('btn-import-all').textContent = '⚠️ Import Semua (Termasuk Duplikat)';
  } else {
    document.getElementById('dup-warn').style.display     = 'none';
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

export function importSemua()       { doImport(state.prevData); }
export function importHanya(status) { doImport(state.prevData.filter(p => p.status === status)); }

export function doImport(rows) {
  let count = 0;
  rows.forEach(p => {
    if (state.murid.find(m => m.ic === p.ic)) return;
    const nombor = jana(p.kat);
    state.murid.push({
      id: crypto.randomUUID(), // FIX: was Date.now()+''+Math.random()
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
    csv += `"${m.nombor}","${m.nama}","${m.ic}","${m.sekolah}","${m.kodSkl||''}",${m.kat},${m.jantina},"${done?'Tamat':'Belum'}"\n`;
  });
  dl(csv, `senarai-peserta-${Date.now()}.csv`, 'text/csv');
  toast('Senarai dieksport!', 'ok');
}

export function turunTemplate() {
  // IC values are wrapped with ="..." so Excel treats them as Text cells,
  // preventing conversion to scientific notation (e.g. 1.20E+11).
  const csv = `Nama,IC,Sekolah,Kod_Sekolah,Kategori,Jantina
Ahmad Amirul bin Aiman,"=""120105101234""",SK Taman Maju,PBB1013,L12,Lelaki
Siti Aishah binti Ali,"=""120205201111""",SK Sri Aman,PBB1013,P12,Perempuan
Muhammad Hafiz,"=""120301301567""",SK Bukit Indah,PBB1014,L12,Lelaki`;
  dl(csv, 'template-merentas-desa.csv', 'text/csv');
  toast('Template dimuat turun!', 'ok');
}

// ── Manual entry modal ────────────────────────────────────────
export function bukaFormManual() {
  ['m-nama','m-ic','m-skl','m-kod'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('m-kat').value = 'L12';
  document.getElementById('modal-tambah').classList.add('open');
  setTimeout(() => document.getElementById('m-nama').focus(), 100);
}

export function tutupFormManual() {
  document.getElementById('modal-tambah').classList.remove('open');
}

export function simpanManual() {
  const nama    = document.getElementById('m-nama').value.trim();
  const ic      = document.getElementById('m-ic').value.replace(/[^0-9]/g, '');
  const sekolah = document.getElementById('m-skl').value.trim();
  const kodSkl  = document.getElementById('m-kod').value.trim().toUpperCase();
  const kat     = document.getElementById('m-kat').value;
  const jantina = kat === 'L12' ? 'Lelaki' : 'Perempuan';

  if (!nama)            { toast('Sila isi nama peserta.', 'err'); return; }
  if (ic.length !== 12) { toast('No. IC mesti 12 digit.', 'err'); return; }
  if (!sekolah)         { toast('Sila isi nama sekolah.', 'err'); return; }
  if (!kodSkl)          { toast('Sila isi kod sekolah.', 'err'); return; }

  const dupIC  = state.murid.find(m => m.ic === ic);
  const status = dupIC ? 'dup' : 'baru';
  const dupMsg = dupIC ? `IC ada dalam sistem (${dupIC.nombor})` : '';

  doImport([{ nama, ic, sekolah, kodSkl, kat, jantina, status, dupMsg }]);
  tutupFormManual();
}

// ── Tab switcher for Langkah 2 upload card ────────────────────
export function setUploadTab(tab, el) {
  document.querySelectorAll('#upload-tabs .ftab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  document.getElementById('upload-csv-zone').style.display = tab === 'csv'    ? '' : 'none';
  document.getElementById('upload-tsv-zone').style.display = tab === 'tampal' ? '' : 'none';
}

// ── Paste-from-Excel (TSV) parser ─────────────────────────────
export function bacaTSV() {
  const raw = document.getElementById('tsv-inp').value.trim();
  if (!raw) { toast('Tiada data untuk diproses.', 'err'); return; }

  const lines     = raw.split('\n').map(l => l.trim()).filter(l => l);
  // Auto-skip header row if it looks like a header (contains 'nama' or 'ic')
  const dataLines = (lines[0].toLowerCase().includes('nama') || lines[0].toLowerCase().includes('ic'))
    ? lines.slice(1) : lines;

  if (!dataLines.length) { toast('Tiada data peserta ditemui.', 'err'); return; }

  state.prevData = [];
  let invalidCount = 0;

  dataLines.forEach(line => {
    // Excel clipboard uses tab as delimiter; clipboard preserves full integer — no scientific notation
    const parts = line.split('\t').map(p => p.trim().replace(/^"|"$/g, ''));
    if (parts.length < 6 || !parts[0] || !parts[1]) { invalidCount++; return; }

    const nama    = parts[0];
    const ic      = parts[1].replace(/[^0-9]/g, '');
    const sekolah = parts[2];
    const kodSkl  = parts[3].toUpperCase();
    const kat     = parts[4].toUpperCase().includes('L') ? 'L12' : 'P12';
    const jantina = parts[5].toLowerCase().includes('p') ? 'Perempuan' : 'Lelaki';

    if (ic.length !== 12) { invalidCount++; return; }

    const dupIC    = state.murid.find(m => m.ic === ic);
    const dupBatch = state.prevData.find(p => p.ic === ic);
    let status = 'baru', dupMsg = '';
    if (dupIC)         { status = 'dup'; dupMsg = `IC ada dalam sistem (${dupIC.nombor})`; }
    else if (dupBatch) { status = 'dup'; dupMsg = 'IC duplikat dalam data tampal'; }

    state.prevData.push({ nama, ic, sekolah, kodSkl, kat, jantina, status, dupMsg });
  });

  if (invalidCount > 0) toast(`${invalidCount} baris diabaikan (format tidak sah).`, 'err');
  if (!state.prevData.length) { toast('Tiada rekod yang boleh diproses.', 'err'); return; }

  renderPreview();
  document.getElementById('preview-card').style.display = 'block';
  document.getElementById('upload-info').style.display  = 'block';
  document.getElementById('upload-info').textContent    = `✓ Data tampal — ${state.prevData.length} rekod dijumpai.`;
  setStep(2);
}

export function tanyaReset() { document.getElementById('modal-reset').classList.add('open'); }
export function tutupModal() { document.getElementById('modal-reset').classList.remove('open'); }

import { updateStats } from './leaderboard.js';
import { renderScan }  from './scanner.js';
import { renderLB }    from './leaderboard.js';
import { updateKUI }   from './timer.js';

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
  tutupModal(); clearPreview();
  toast('Semua data direset.', 'ok');
}
