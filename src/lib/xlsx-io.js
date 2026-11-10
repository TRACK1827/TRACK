// Lectura y escritura de Excel (la librería se carga solo cuando se usa)
const lib = () => import('xlsx');

export async function readBook(file) {
  const XLSX = await lib();
  const buf = await file.arrayBuffer();
  return { XLSX, wb: XLSX.read(buf, { cellDates: true }) };
}

// Devuelve las filas de la hoja como objetos { encabezado: valor }
export async function readSheet(file, sheetName) {
  const { XLSX, wb } = await readBook(file);
  const name = wb.SheetNames.find((n) => n.toLowerCase() === sheetName.toLowerCase()) || (wb.SheetNames.length === 1 ? wb.SheetNames[0] : null);
  if (!name) throw new Error('El archivo no tiene la hoja «' + sheetName + '». Usa la plantilla sin cambiar el nombre de las hojas.');
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '', raw: true });
  return rows.map((r) => {
    const o = {};
    Object.keys(r).forEach((k) => { o[k.trim().toLowerCase()] = r[k]; });
    return o;
  });
}

export async function writeBook(filename, sheets) {
  const XLSX = await lib();
  const wb = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([name, rows]) => {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'Sin datos': '' }]);
    const keys = Object.keys(rows[0] || { 'Sin datos': '' });
    ws['!cols'] = keys.map((k) => ({ wch: Math.min(40, Math.max(k.length + 2, ...rows.slice(0, 200).map((r) => String(r[k] ?? '').length + 1))) }));
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  });
  XLSX.writeFile(wb, filename);
}

// ---------- Conversión de celdas
export const txt = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
};
export const code = (v) => txt(v).replace(/\.0+$/, '').replace(/\s+/g, '');
export const num = (v) => { if (v === '' || v === null || v === undefined) return null; const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.')); return isNaN(n) ? NaN : n; };
export const yes = (v) => { const s = txt(v).toLowerCase(); return s === '' ? true : ['sí', 'si', 's', 'true', '1', 'yes', 'activo', 'activa'].includes(s); };
export function date(v) {
  if (v === '' || v === null || v === undefined) return null;
  let d = null;
  if (v instanceof Date) d = new Date(v.getTime() + 12 * 3600 * 1000); // evita desfase de zona horaria
  else if (typeof v === 'number') d = new Date(Date.UTC(1899, 11, 30) + v * 864e5 + 12 * 3600 * 1000);
  else {
    const s = String(v).trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
    m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (m) d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], 12));
  }
  if (!d || isNaN(d)) return undefined;
  return d.toISOString().slice(0, 10);
}
