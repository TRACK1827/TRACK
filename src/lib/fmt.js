// Fecha desde la que se puede navegar el histórico del dashboard
export const PT_START = new Date(2025, 0, 1);

export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const D3 = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const M3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const DIA_VISITA = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export const pad = (n) => (n < 10 ? '0' : '') + n;
export const cap = (x) => (x ? x.charAt(0).toUpperCase() + x.slice(1) : '');
export const larga = (d) => DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MES[d.getMonth()];
export const corta = (d) => D3[d.getDay()] + ' ' + d.getDate() + ' ' + M3[d.getMonth()];
export const hora = (d) => pad(d.getHours()) + ':' + pad(d.getMinutes());
export const fechaHora = (d) => pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' · ' + hora(d);
export const dmy = (d) => pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
export const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const parseIso = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
export const corteTxt = (s) => { if (!s) return '—'; const d = parseIso(s); return d.getDate() + ' ' + M3[d.getMonth()]; };
export const isoDow = (d) => (d.getDay() === 0 ? 7 : d.getDay());
export const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
export const fmtN = (n) => Math.round(Number(n) || 0).toLocaleString('es-PE');
export const telFmt = (t) => (t && t.length === 9 ? t.slice(0, 3) + ' ' + t.slice(3, 6) + ' ' + t.slice(6) : t || '—');
export const signed = (n) => (n > 0 ? '+' + n : n < 0 ? '−' + Math.abs(n) : '0');
export const dist = (m) => (m == null ? '—' : m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km');
export const plural = (n, s, p) => n + ' ' + (n === 1 ? s : p);
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// Periodos del dashboard
export function period(tipo, k, now = new Date()) {
  let f, t, label;
  if (tipo === 'dia') { f = new Date(now.getFullYear(), now.getMonth(), now.getDate() - k); t = f; label = (k === 0 ? 'Hoy · ' : '') + D3[f.getDay()] + ' ' + f.getDate() + ' ' + M3[f.getMonth()] + ' ' + f.getFullYear(); }
  else if (tipo === 'semana') {
    const dw = (now.getDay() + 6) % 7;
    f = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dw - 7 * k); t = new Date(f.getFullYear(), f.getMonth(), f.getDate() + 6);
    label = 'Semana ' + f.getDate() + (f.getMonth() !== t.getMonth() ? ' ' + M3[f.getMonth()] : '') + ' al ' + t.getDate() + ' ' + M3[t.getMonth()] + ' ' + t.getFullYear();
  }
  else if (tipo === 'mes') { f = new Date(now.getFullYear(), now.getMonth() - k, 1); t = new Date(f.getFullYear(), f.getMonth() + 1, 0); label = cap(MES[f.getMonth()]) + ' ' + f.getFullYear(); }
  else { f = new Date(now.getFullYear() - k, 0, 1); t = new Date(now.getFullYear() - k, 11, 31); label = 'Año ' + f.getFullYear(); }
  return { from: f, to: t, label };
}

// Genera una contraseña fácil de dictar: Track + 5 caracteres sin letras confusas
export function genPw() {
  const c = 'abcdefghjkmnpqrstuvwxyz23456789';
  let o = 'Track';
  const r = new Uint32Array(5); crypto.getRandomValues(r);
  for (let i = 0; i < 5; i++) o += c.charAt(r[i] % c.length);
  return o;
}

export function sinTildes(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, ''); }
