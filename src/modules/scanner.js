import { state, save }          from '../store.js';
import { esc, fDur, fW, toast } from './utils.js';
import { renderMurid }          from './register.js';
import { renderLB, updateStats } from './leaderboard.js';

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
  const now     = Date.now();
  const tempoh  = now - state.larian[m.kat].mula;
  const rankKat = state.rekod.filter(r => r.kat === m.kat).length + 1;
  state.rekod.push({
    id: crypto.randomUUID(),
    nombor:val, nama:m.nama, sekolah:m.sekolah, kodSkl:m.kodSkl,
    kat:m.kat, mula:state.larian[m.kat].mula, tamatMs:now, tempoh, rankKat,
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

export async function toggleCam() {
  if (state.camStream) { stopCam(); return; }
  if (!state.apiKey)   { toast('Masukkan API key Claude dahulu!', 'err'); return; }
  try {
    state.camStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment', width:{ideal:1280} } });
    document.getElementById('camv').srcObject           = state.camStream;
    document.getElementById('cam-wrap').classList.add('on');
    document.getElementById('btn-cam').textContent      = '📷 Kamera Aktif';
    document.getElementById('btn-cap').style.display    = 'inline-flex';
    document.getElementById('btn-stopc').style.display  = 'inline-flex';
    setAI('ready', 'Kamera aktif. Tekan Tangkap untuk scan.');
  } catch(e) { toast('Tidak dapat akses kamera: ' + e.message, 'err'); }
}

export function stopCam() {
  if (state.camStream) { state.camStream.getTracks().forEach(t => t.stop()); state.camStream = null; }
  document.getElementById('camv').srcObject           = null;
  document.getElementById('cam-wrap').classList.remove('on');
  document.getElementById('btn-cam').textContent      = '📷 Buka Kamera AI';
  document.getElementById('btn-cap').style.display    = 'none';
  document.getElementById('btn-stopc').style.display  = 'none';
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
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'x-api-key':state.apiKey, 'anthropic-version':'2023-06-01' },
      body: JSON.stringify({
        model:'claude-opus-4-6', max_tokens:60,
        messages:[{ role:'user', content:[
          { type:'image', source:{ type:'base64', media_type:'image/jpeg', data:b64 } },
          { type:'text', text:'Gambar ini adalah bib (nombor dada) peserta merentas desa. Cari nombor series pada bib. Format: L12xxxx atau P12xxxx (contoh: L120045 atau P120012). Balas dengan nombor series SAHAJA, tiada teks lain. Jika tidak nampak, balas: TIDAK NAMPAK' },
        ]}],
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const txt = data.content[0].text.trim().toUpperCase().replace(/\s/g,'');
    if (txt === 'TIDAK NAMPAK' || txt.length < 5) {
      setAI('err', 'AI tidak dapat baca nombor. Cuba tangkap semula atau taip manual.');
      toast('AI tidak dapat detect nombor.', 'err');
    } else {
      setAI('ok', `✓ AI detect: ${txt}`);
      document.getElementById('bib-inp').value = txt;
      toast(`AI detect: ${txt}`, 'ok');
      setTimeout(() => proses(txt), 400);
    }
  } catch(e) { setAI('err','Ralat: '+e.message); toast('Ralat API: '+e.message,'err'); }
}

function setAI(s, msg) {
  document.getElementById('ait').textContent = msg;
  const dot = document.getElementById('aid');
  dot.className = 'ai-dot'+(s==='think'?' think':s==='ok'?' ok':s==='err'?' err':'');
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
