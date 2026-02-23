import { state, save }         from '../store.js';
import { esc, fDur, fW, toast } from './utils.js';
import { renderMurid }          from './register.js';
import { renderLB, updateStats } from './leaderboard.js';

const GEMINI_URL = key =>
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;

// Module-level pending confirmation state
let _pending = null; // { nombor, nama } | null

export function updateScanBar() {
  const bar = document.getElementById('scan-bar');
  const L = state.larian.L12.s, P = state.larian.P12.s;
  if (L==='running'&&P==='running') { bar.className='alert al-g'; bar.innerHTML='🟢 L12 dan P12 sedang berlari. Sedia untuk rekod.'; }
  else if (L==='running') { bar.className='alert al-g'; bar.innerHTML='🟢 L12 sedang berlari.'; }
  else if (P==='running') { bar.className='alert al-g'; bar.innerHTML='🟢 P12 sedang berlari.'; }
  else if (L==='done'||P==='done') { bar.className='alert al-b'; bar.innerHTML='🔵 Larian selesai. Masih boleh rekod peserta yang tinggal.'; }
  else { bar.className='alert al-a'; bar.innerHTML='⚠️ Tiada larian aktif. Mulakan larian di halaman <strong>Kawalan</strong>.'; }
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
    toast('Nombor tidak dijumpai!', 'err'); inp.select(); return;
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
    toast('Peserta sudah direkod!', 'err'); inp.select(); return;
  }
  const now    = Date.now();
  const tempoh = now - state.larian[m.kat].mula;
  const rankKat = state.rekod.filter(r => r.kat === m.kat).length + 1;
  state.rekod.push({
    id: crypto.randomUUID(),
    nombor: val, nama: m.nama, sekolah: m.sekolah, kodSkl: m.kodSkl,
    kat: m.kat, mula: state.larian[m.kat].mula, tamatMs: now, tempoh, rankKat,
  });
  const _entry = state.rekod[state.rekod.length - 1];
  save(); postToSheets(_entry, rankKat); renderScan(); renderLB(); updateStats(); renderMurid();
  sres.classList.add('ok');
  document.getElementById('sres-name').textContent = `✅ ${esc(m.nama)}`;
  document.getElementById('sres-meta').textContent = `${esc(m.sekolah)} (${esc(m.kodSkl||'')}) · ${esc(m.kat)}`;
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
    const rc = r.rankKat===1?'g':r.rankKat===2?'s':r.rankKat===3?'b':'';
    return `<tr>
      <td><span class="rn ${rc}" style="font-size:1rem;">#${r.rankKat}</span></td>
      <td style="color:#fafaf8;">${esc(r.nama)}</td>
      <td><span class="badge ${r.kat==='L12'?'bg-b':'bg-p'}">${esc(r.kat)}</span></td>
      <td style="color:#52b788;font-family:'JetBrains Mono',monospace;font-size:0.82rem;">${fDur(r.tempoh)}</td>
      <td style="color:rgba(250,250,248,0.4);font-family:'JetBrains Mono',monospace;font-size:0.72rem;">${fW(new Date(r.tamatMs))}</td>
    </tr>`;
  }).join('');
}

// ── Camera ────────────────────────────────────────────────────
export async function toggleCam() {
  if (state.camStream) { stopCam(); return; }
  if (!state.geminiKey) { toast('Admin perlu set API key Gemini dahulu.', 'err'); return; }
  try {
    state.camStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment', width:{ideal:1280} } });
    document.getElementById('camv').srcObject          = state.camStream;
    document.getElementById('cam-wrap').classList.add('on');
    document.getElementById('btn-cam').textContent     = '📷 Kamera Aktif';
    document.getElementById('btn-cap').style.display   = 'inline-flex';
    document.getElementById('btn-stopc').style.display = 'inline-flex';
    setAI('ready', 'Kamera aktif. Tekan Tangkap untuk scan.');
  } catch(e) { toast('Tidak dapat akses kamera: ' + e.message, 'err'); }
}

export function stopCam() {
  if (state.camStream) { state.camStream.getTracks().forEach(t => t.stop()); state.camStream = null; }
  document.getElementById('camv').srcObject          = null;
  document.getElementById('cam-wrap').classList.remove('on');
  document.getElementById('btn-cam').textContent     = '📷 Buka Kamera AI';
  document.getElementById('btn-cap').style.display   = 'none';
  document.getElementById('btn-stopc').style.display = 'none';
  setAI('idle', 'Kamera tidak aktif');
}

export async function tangkap() {
  if (!state.camStream) return;
  const v = document.getElementById('camv');
  const c = document.createElement('canvas');
  c.width = v.videoWidth; c.height = v.videoHeight;
  c.getContext('2d').drawImage(v, 0, 0);
  const b64 = c.toDataURL('image/jpeg', 0.85).split(',')[1];
  setAI('think', 'AI sedang membaca nombor bib...');
  try {
    const res = await fetch(GEMINI_URL(state.geminiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { inline_data: { mime_type: 'image/jpeg', data: b64 } },
          { text: 'Gambar ini adalah bib (nombor dada) peserta merentas desa. Cari nombor series pada bib. Format: huruf diikuti nombor, contoh: L120045 atau P120012. Balas dengan nombor series SAHAJA, tiada teks lain. Jika tidak nampak, balas: TIDAK NAMPAK' },
        ]}],
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const txt = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim().toUpperCase().replace(/\s/g, '');
    if (txt === 'TIDAK NAMPAK' || txt.length < 4) {
      setAI('err', 'AI tidak dapat baca nombor. Cuba tangkap semula atau taip manual.');
      toast('AI tidak dapat detect nombor.', 'err');
      return;
    }
    const m = state.murid.find(x => x.nombor === txt);
    _pending = { nombor: txt, nama: m ? m.nama : '???' };
    _showConfirm();
    setAI('ok', `AI detect: ${txt}`);
  } catch(e) { setAI('err', 'Ralat: ' + e.message); toast('Ralat API Gemini: ' + e.message, 'err'); }
}

// ── Two-step confirm ──────────────────────────────────────────
function _showConfirm() {
  const el = document.getElementById('confirm-panel');
  document.getElementById('confirm-nombor').value          = _pending.nombor;
  document.getElementById('confirm-nama-disp').textContent = _pending.nama;
  el.style.display = '';
}

export function sahkan() {
  // Allow manual correction of BIB number
  const corrected = document.getElementById('confirm-nombor').value.trim().toUpperCase();
  _pending = null;
  document.getElementById('confirm-panel').style.display = 'none';
  proses(corrected);
}

export function batalPending() {
  _pending = null;
  document.getElementById('confirm-panel').style.display = 'none';
  setAI('idle', 'Dibatalkan. Tangkap semula atau taip manual.');
}

function setAI(s, msg) {
  document.getElementById('ait').textContent = msg;
  const dot = document.getElementById('aid');
  dot.className = 'ai-dot' + (s==='think'?' think':s==='ok'?' ok':s==='err'?' err':'');
}

// ── Google Sheets ─────────────────────────────────────────────
function postToSheets(r, rank) {
  if (!state.gsUrl) return;
  fetch(state.gsUrl, {
    method: 'POST',
    body: JSON.stringify({
      kat: r.kat, rank, nombor: r.nombor, nama: r.nama,
      sekolah: r.sekolah, kodSkl: r.kodSkl || '',
      tempoh: fDur(r.tempoh), masaTamat: fW(new Date(r.tamatMs)),
    }),
  }).catch(() => {}); // silent fail — GS is secondary
}
