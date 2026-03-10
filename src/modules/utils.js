/** HTML-escape a value before inserting into innerHTML. Prevents XSS. */
export function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Format milliseconds as HH:MM:SS */
export function fDur(ms) {
  const s  = Math.floor(ms / 1000);
  const h  = Math.floor(s / 3600);
  const m  = Math.floor((s % 3600) / 60);
  const sc = s % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}`;
}

/** Format a Date as localised HH:MM:SS */
export function fW(d) {
  return d.toLocaleTimeString('ms-MY', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}

/** Download content as a file. Revokes object URL to prevent memory leak. */
export function dl(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Show a temporary toast. t = 'ok' | 'err' | 'info' */
export function toast(msg, t = 'info') {
  const c  = document.getElementById('toast');
  const el = document.createElement('div');
  el.className  = `ti ${t === 'ok' ? 'tok' : t === 'err' ? 'terr' : 'tinf'}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}
