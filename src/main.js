import './style.css';
import { state, initFirebaseListeners } from './store.js';
import { fDur }                         from './modules/utils.js';
import {
  turunTemplate, dragOn, dragOff, dropFile, bacaCSV,
  fprev, clearPreview, importSemua, importHanya,
  fd, renderMurid, hapus, eksportSenarai,
  tanyaReset, tutupModal, doReset,
} from './modules/register.js';
import { mula, tamat, updateKUI, startTimer } from './modules/timer.js';
import {
  proses, renderScan, updateScanBar,
  toggleCam, stopCam, tangkap, simpanAK, toggleAK, simpanGS,
} from './modules/scanner.js';
import {
  flb, renderLB, updateStats,
  semakSekolah, eksportSekolah, eksportCSV,
} from './modules/leaderboard.js';

function gp(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nb').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  el.classList.add('active');
  if (id === 'scan')      { updateScanBar(); setTimeout(() => document.getElementById('bib-inp').focus(), 100); }
  if (id === 'keputusan') { updateStats(); renderLB(); }
}

// Expose all functions called by inline onclick attributes
Object.assign(window, {
  gp,
  turunTemplate, dragOn, dragOff, dropFile, bacaCSV,
  fprev, clearPreview, importSemua, importHanya,
  fd, renderMurid, hapus, eksportSenarai,
  tanyaReset, tutupModal, doReset,
  mula, tamat,
  proses, toggleCam, stopCam, tangkap, simpanAK, toggleAK, simpanGS,
  flb, semakSekolah, eksportSekolah, eksportCSV,
});

function init() {
  if (state.apiKey) {
    document.getElementById('ak-inp').value = state.apiKey;
    document.getElementById('ak-st').innerHTML = '<span style="color:var(--accent);">✓ API key tersimpan.</span>';
  }
  const _gsUrl = localStorage.getItem('md3_gs_url');
  if (_gsUrl) {
    document.getElementById('gs-inp').value = _gsUrl;
    document.getElementById('gs-st').innerHTML = '<span style="color:var(--accent);">✓ URL tersimpan.</span>';
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

  // Start Firebase real-time listeners — inject render callbacks to avoid circular imports
  initFirebaseListeners({
    renderAll:  () => { renderMurid(); renderScan(); renderLB(); updateStats(); updateKUI('L12'); updateKUI('P12'); },
    renderMurid,
    renderScan,
    renderLB,
    updateStats,
    updateKUI,
  });

  // Stop camera on page unload
  window.addEventListener('beforeunload', () => {
    if (state.camStream) state.camStream.getTracks().forEach(t => t.stop());
  });
}

init();
