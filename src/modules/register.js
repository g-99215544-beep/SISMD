import { state, save, jana } from '../store.js';
import { esc, dl, toast }    from './utils.js';
import { updateStats }       from './leaderboard.js';
import { renderScan }        from './scanner.js';
import { renderLB }          from './leaderboard.js';
import { updateKUI }         from './timer.js';
import { isAdminLoggedIn }   from './admin.js';

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
  refreshDaftarPrivilegedUI();
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
  if (!isAdminLoggedIn()) { toast('Hanya admin boleh eksport senarai.', 'err'); return; }
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
export function tanyaReset() {
  if (!isAdminLoggedIn()) { toast('Hanya admin boleh reset data.', 'err'); return; }
  document.getElementById('modal-reset').classList.add('open');
}
export function tutupModal()  { document.getElementById('modal-reset').classList.remove('open'); }

export function doReset() {
  if (!isAdminLoggedIn()) { toast('Hanya admin boleh reset data.', 'err'); return; }
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

export function refreshDaftarPrivilegedUI() {
  const isAdmin = isAdminLoggedIn();
  const btnEksport = document.getElementById('btn-eksport-senarai');
  const btnReset = document.getElementById('btn-reset-data');
  const cariInp = document.getElementById('cari-inp');
  if (btnEksport) btnEksport.style.display = isAdmin ? '' : 'none';
  if (btnReset) btnReset.style.display = isAdmin ? '' : 'none';
  if (cariInp) {
    cariInp.style.display = isAdmin ? '' : 'none';
    if (!isAdmin) cariInp.value = '';
  }
}
