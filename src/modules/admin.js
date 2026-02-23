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
