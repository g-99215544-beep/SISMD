import './style.css';
import { state, initFirebaseListeners } from './store.js';
import { fDur }                         from './modules/utils.js';
import {
  semakSekolahDaftar, simpanSekolah, tukarSekolah, daftarPeserta,
  fd, renderMurid, hapus, eksportSenarai,
  tanyaReset, tutupModal, doReset,
  cetakBIB, cetakBIBSatu, applyRegState, refreshDaftarPrivilegedUI,
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
  refreshDaftarPrivilegedUI,
  mula, tamat,
  proses, toggleCam, stopCam, tangkap,
  sahkan, batalPending,
  flb, semakSekolah, eksportSekolah, eksportCSV,
  bukaAdmin, tutupAdmin, loginAdmin, logoutAdmin,
  toggleAcc, simpanGeminiKey, simpanGSUrl,
  toggleReg, renderAdminPeserta, hapusAdmin, eksportAdminCSV,
});

function init() {
  refreshDaftarPrivilegedUI();
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
