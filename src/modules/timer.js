import { state, save } from '../store.js';
import { fDur, fW, toast } from './utils.js';

export function mula(kat) {
  if (state.larian[kat].s === 'running') { toast(`Larian ${kat} sudah bermula!`, 'err'); return; }
  state.larian[kat] = { s:'running', mula:Date.now(), tamat:null };
  save(); updateKUI(kat); startTimer(kat);
  addLog(`🏁 Larian ${kat} DIMULAKAN — ${fW(new Date())}`);
  toast(`Larian ${kat} dimulakan!`, 'ok');
}

export function tamat(kat) {
  if (state.larian[kat].s !== 'running') return;
  state.larian[kat].s     = 'done';
  state.larian[kat].tamat = Date.now();
  clearInterval(state.timers[kat]);
  save(); updateKUI(kat);
  addLog(`⏹ Larian ${kat} DITAMATKAN — ${fW(new Date())}`);
  toast(`Larian ${kat} ditamatkan.`, 'ok');
}

export function startTimer(kat) {
  clearInterval(state.timers[kat]);
  state.timers[kat] = setInterval(() => {
    if (state.larian[kat].s !== 'running') { clearInterval(state.timers[kat]); return; }
    document.getElementById(`ct-${kat}`).textContent = fDur(Date.now() - state.larian[kat].mula);
  }, 1000);
}

export function updateKUI(kat) {
  const s  = state.larian[kat].s;
  const cc = document.getElementById(`cc-${kat}`);
  const cs = document.getElementById(`cs-${kat}`);
  const ct = document.getElementById(`ct-${kat}`);
  const bm = document.getElementById(`bm-${kat}`);
  const bt = document.getElementById(`bt-${kat}`);
  const cm = document.getElementById(`cm-${kat}`);
  cc.className = `cat-card ${s==='running'?'running':s==='done'?'done':''}`;
  ct.className = `cat-tm ${s==='running'?'running':''}`;
  if (s === 'idle') {
    cs.textContent='Belum bermula'; bm.disabled=false; bt.disabled=true;
    cm.textContent=''; ct.textContent='--:--:--';
  } else if (s === 'running') {
    cs.textContent='🟢 SEDANG BERLARI'; bm.disabled=true; bt.disabled=false;
    cm.textContent=`Mula: ${fW(new Date(state.larian[kat].mula))}`;
  } else {
    cs.textContent='🔴 Larian tamat'; bm.disabled=true; bt.disabled=true;
    const dur = state.larian[kat].tamat - state.larian[kat].mula;
    ct.textContent=fDur(dur);
    cm.textContent=`Mula: ${fW(new Date(state.larian[kat].mula))} · Selesai: ${fW(new Date(state.larian[kat].tamat))}`;
  }
}

function addLog(msg) {
  const log = document.getElementById('log');
  log.innerHTML = `<span style="color:var(--accent);">[${fW(new Date())}]</span> ${msg}\n` + log.innerHTML;
}
