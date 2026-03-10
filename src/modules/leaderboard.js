import { state }                from '../store.js';
import { esc, fDur, fW, dl, toast } from './utils.js';

export function flb(f, el) {
  state.flbAktif = f;
  document.querySelectorAll('#page-keputusan .ftab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  renderLB();
}

export function renderLB() {
  let data = state.flbAktif==='semua' ? [...state.rekod] : state.rekod.filter(r=>r.kat===state.flbAktif);
  data.sort((a,b) => a.tempoh-b.tempoh);
  const body = document.getElementById('lb-body');
  if (!data.length) {
    body.innerHTML=`<div style="text-align:center;padding:40px;color:var(--ink2);font-size:0.83rem;">Belum ada rekod${state.flbAktif!=='semua'?' untuk '+state.flbAktif:''}.</div>`;
    return;
  }
  body.innerHTML = data.map((r,i) => {
    const rank=i+1, rc=rank===1?'g':rank===2?'s':rank===3?'b':'';
    return `<div class="lbr">
      <div class="rn ${rc}">${rank}</div>
      <div><div class="lbn">${esc(r.nama)}</div><div style="display:flex;gap:4px;margin-top:3px;"><span class="badge ${r.kat==='L12'?'bg-b':'bg-p'}">${esc(r.kat)}</span></div></div>
      <div class="lbs">${esc(r.sekolah)}</div>
      <div class="lbd">${fDur(r.tempoh)}</div>
      <div class="mono" style="font-size:0.74rem;color:var(--ink2);">${esc(r.nombor)}</div>
    </div>`;
  }).join('');
}

export function updateStats() {
  document.getElementById('st-tot').textContent = state.rekod.length;
  document.getElementById('st-l').textContent   = state.rekod.filter(r=>r.kat==='L12').length;
  document.getElementById('st-p').textContent   = state.rekod.filter(r=>r.kat==='P12').length;
  document.getElementById('st-d').textContent   = state.murid.length;
}

function _rankMap() {
  const m = {};
  ['L12','P12'].forEach(kat => {
    state.rekod.filter(x=>x.kat===kat).sort((a,b)=>a.tempoh-b.tempoh).forEach((x,i)=>{ m[x.nombor]=i+1; });
  });
  return m;
}

export function semakSekolah() {
  const kod     = document.getElementById('kod-inp').value.trim().toUpperCase();
  if (!kod) { toast('Sila masukkan kod sekolah.', 'err'); return; }
  state.lookupSekolah = kod;
  const peserta = state.murid.filter(m=>(m.kodSkl||'').toUpperCase()===kod);
  const res     = document.getElementById('lookup-result');
  const card    = document.getElementById('lookup-table-card');

  if (!peserta.length) {
    res.style.display='block';
    res.innerHTML=`<div style="text-align:center;padding:20px;color:rgba(216,243,220,0.4);font-size:0.88rem;">Tiada peserta dijumpai untuk kod sekolah <strong style="color:#d8f3dc;">${esc(kod)}</strong>.</div>`;
    card.style.display='none'; return;
  }

  const namaSekolah = peserta[0].sekolah;
  const L12         = peserta.filter(p=>p.kat==='L12');
  const P12         = peserta.filter(p=>p.kat==='P12');
  const sudahTamat  = peserta.filter(p=>state.rekod.find(r=>r.nombor===p.nombor));
  const rm          = _rankMap();

  document.getElementById('lookup-card-title').textContent=`${namaSekolah} (${kod})`;
  res.style.display='block';
  res.innerHTML=`
    <div class="lookup-school-name">🏫 ${esc(namaSekolah)} · <span class="mono">${esc(kod)}</span></div>
    <div class="lookup-stats">
      <div class="ls"><div class="ls-val">${peserta.length}</div><div class="ls-lbl">Jumlah Peserta</div></div>
      <div class="ls"><div class="ls-val">${L12.length}</div><div class="ls-lbl">L12 Lelaki</div></div>
      <div class="ls"><div class="ls-val">${P12.length}</div><div class="ls-lbl">P12 Perempuan</div></div>
      <div class="ls"><div class="ls-val" style="color:#52b788;">${sudahTamat.length}</div><div class="ls-lbl">Sudah Tamat Larian</div></div>
      <div class="ls"><div class="ls-val" style="color:#d29922;">${peserta.length-sudahTamat.length}</div><div class="ls-lbl">Belum Berlari</div></div>
    </div>`;

  document.getElementById('tb-lookup').innerHTML = peserta.map(p => {
    const r = state.rekod.find(x=>x.nombor===p.nombor);
    return `<tr>
      <td class="mono" style="font-weight:600;">${esc(p.nombor)}</td>
      <td>${esc(p.nama)}</td>
      <td class="mono" style="font-size:0.72rem;color:var(--ink2);">${esc(p.ic)}</td>
      <td><span class="badge ${p.kat==='L12'?'bg-b':'bg-p'}">${esc(p.kat)}</span></td>
      <td>${r?'<span class="badge bg-g">✓ Tamat</span>':'<span class="badge bg-x">Belum</span>'}</td>
      <td>${r?`<strong>#${rm[p.nombor]}</strong> dalam ${esc(p.kat)}`:'-'}</td>
      <td class="mono" style="color:var(--accent);">${r?fDur(r.tempoh):'-'}</td>
    </tr>`;
  }).join('');
  card.style.display='block';
}

export function eksportSekolah() {
  const peserta = state.murid.filter(m=>(m.kodSkl||'').toUpperCase()===state.lookupSekolah);
  if (!peserta.length) return;
  const rm = _rankMap();
  let csv = 'No Series,Nama,IC,Kategori,Status,Ranking,Masa Larian\n';
  peserta.forEach(p => {
    const r = state.rekod.find(x=>x.nombor===p.nombor);
    csv += `"${p.nombor}","${p.nama}","${p.ic}",${p.kat},"${r?'Tamat':'Belum'}","${r?rm[p.nombor]:'-'}","${r?fDur(r.tempoh):'-'}"\n`;
  });
  dl(csv, `peserta-${state.lookupSekolah}-${Date.now()}.csv`, 'text/csv');
  toast('Eksport berjaya!', 'ok');
}

export function eksportCSV() {
  if (!state.rekod.length) { toast('Tiada data.','err'); return; }
  const rm = _rankMap();
  let csv = 'Ranking,No Series,Nama,Sekolah,Kod Sekolah,Kategori,Tempoh,Masa Tamat\n';
  [...state.rekod].sort((a,b)=>a.kat.localeCompare(b.kat)||a.tempoh-b.tempoh).forEach(r => {
    csv += `${rm[r.nombor]},"${r.nombor}","${r.nama}","${r.sekolah}","${r.kodSkl||''}",${r.kat},${fDur(r.tempoh)},${fW(new Date(r.tamatMs))}\n`;
  });
  dl(csv, `keputusan-md-${Date.now()}.csv`, 'text/csv');
  toast('CSV dimuat turun!', 'ok');
}
