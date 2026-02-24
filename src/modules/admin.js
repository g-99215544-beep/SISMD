import { state, save } from '../store.js';
import { ref, set }    from 'firebase/database';
import { db }          from '../firebase.js';
import { esc, dl, toast } from './utils.js';

const ADMIN_PASS    = 'admin123';
const ADMIN_EXP_KEY = 'md3_admin_exp';
const SESSION_MS    = 24 * 60 * 60 * 1000;

export function isAdminLoggedIn() {
  const exp = parseInt(localStorage.getItem(ADMIN_EXP_KEY) || '0', 10);
  return Date.now() < exp;
}

export function bukaAdmin() {
  if (isAdminLoggedIn()) {
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
  window.refreshDaftarPrivilegedUI?.();
  toast('Log masuk berjaya!', 'ok');
}

export function logoutAdmin() {
  localStorage.removeItem(ADMIN_EXP_KEY);
  window.refreshDaftarPrivilegedUI?.();
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
