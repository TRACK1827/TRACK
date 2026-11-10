import { useEffect, useRef, useState } from 'react';
import { sb, q, fetchAll, msg } from '../lib/supabase.js';
import { readSheet, txt, code, num, yes, date } from '../lib/xlsx-io.js';
import { fechaHora, fmtN, sinTildes } from '../lib/fmt.js';
import Icon from '../Icon.jsx';

const RED = '#AC1622';
const G = 'minmax(220px, 1.4fr) minmax(200px, 1fr) 100px 150px 260px';
const DIAS = { lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const TEL = /^9\d{8}$/;

// Cada plantilla: hoja, tabla destino, clave única y cómo validar/convertir cada fila
const TPL = [
  { id: 'rutas', n: 'Rutas', d: 'Estructura: región, sala y supervisión', sheet: 'Rutas', table: 'rutas', key: 'codigo',
    row: (r, x) => {
      const o = { codigo: code(r.codigo_ruta), tipo: txt(r.tipo), region: txt(r.region), sala: txt(r.sala_ventas), ruta_supervisor: code(r.ruta_supervisor) || null, activa: yes(r.activa) };
      if (!o.codigo) return ['codigo_ruta', 'Vacío'];
      if (sinTildes(o.tipo).toLowerCase().startsWith('super')) o.tipo = 'Supervisión'; else if (o.tipo.toLowerCase().startsWith('desa')) o.tipo = 'Desarrollador'; else return ['tipo', 'Debe ser Desarrollador o Supervisión'];
      if (!o.region) return ['region', 'Vacío'];
      if (!o.sala) return ['sala_ventas', 'Vacío'];
      if (o.ruta_supervisor && !x.rutas.has(o.ruta_supervisor) && !x.fileKeys.has(o.ruta_supervisor)) return ['ruta_supervisor', 'La ruta ' + o.ruta_supervisor + ' no existe'];
      return o;
    },
    sort: (a, b) => (a.tipo === b.tipo ? 0 : a.tipo === 'Supervisión' ? -1 : 1) },
  { id: 'catalogos', n: 'Catálogos', d: 'SKU, ítems FDE, motivos', sheet: 'Catalogos', table: 'catalogos', key: 'programa_id,tipo,codigo',
    row: (r) => {
      const o = { programa_id: 'inc', tipo: txt(r.tipo), codigo: code(r.codigo).toUpperCase(), descripcion: txt(r.descripcion), orden: num(r.orden) ?? 0, activo: yes(r.activo) };
      if (!o.tipo) return ['tipo', 'Vacío'];
      if (!o.codigo) return ['codigo', 'Vacío'];
      if (!o.descripcion) return ['descripcion', 'Vacío'];
      if (isNaN(o.orden)) return ['orden', 'Debe ser un número'];
      return o;
    } },
  { id: 'cartera', n: 'Cartera', d: 'Clientes por ruta y día de visita', sheet: 'Cartera', table: 'clientes', key: 'codigo',
    row: (r, x) => {
      const ruta = code(r.codigo_ruta), rt = x.rutaBy[ruta];
      const o = { codigo: code(r.codigo_cliente), programa_id: 'inc', nombre: txt(r.nombre_cliente), direccion: txt(r.direccion) || null, distrito: txt(r.distrito) || null,
        region: txt(r.region) || rt?.region || null, sala: txt(r.sala_ventas) || rt?.sala || null, lat: num(r.latitud), lng: num(r.longitud),
        responsable: txt(r.responsable_negocio) || null, telefono: code(r.telefono) || null, ruta_codigo: ruta, dia_visita: DIAS[sinTildes(txt(r.dia_visita)).toLowerCase()] || null,
        fecha_ingreso: date(r.fecha_ingreso), activo: yes(r.activo) };
      if (!o.codigo) return ['codigo_cliente', 'Vacío'];
      if (!o.nombre) return ['nombre_cliente', 'Vacío'];
      if (!rt) return ['codigo_ruta', ruta ? 'La ruta ' + ruta + ' no existe en Rutas' : 'Vacío'];
      if (!o.dia_visita) return ['dia_visita', 'Debe ser Lunes a Sábado'];
      if (o.telefono && !TEL.test(o.telefono)) return ['telefono', 'Debe tener 9 dígitos y empezar con 9'];
      if (Number.isNaN(o.lat) || (o.lat != null && (o.lat > 0 || o.lat < -18.5))) return ['latitud', 'Fuera del Perú o no es número'];
      if (Number.isNaN(o.lng) || (o.lng != null && (o.lng > -68.5 || o.lng < -81.5))) return ['longitud', 'Fuera del Perú o no es número'];
      if (o.fecha_ingreso === undefined) return ['fecha_ingreso', 'Fecha no válida (usa dd/mm/aaaa)'];
      return o;
    } },
  { id: 'propuestas', n: 'Propuestas', d: 'Clientes a evaluar en Activación', sheet: 'Propuestas', table: 'propuestas', key: 'programa_id,codigo_cliente',
    row: (r, x) => {
      const ruta = code(r.codigo_ruta), rt = x.rutaBy[ruta];
      const o = { programa_id: 'inc', codigo_cliente: code(r.codigo_cliente), nombre: txt(r.nombre_cliente), direccion: txt(r.direccion) || null, distrito: txt(r.distrito) || null,
        region: txt(r.region) || rt?.region || null, sala: txt(r.sala_ventas) || rt?.sala || null, lat: num(r.latitud), lng: num(r.longitud),
        responsable: txt(r.responsable_negocio) || null, telefono: code(r.telefono) || null, asesor: txt(r.asesor_comercial) || null, fecha_propuesta: date(r.fecha_propuesta), ruta_codigo: ruta };
      if (!o.codigo_cliente) return ['codigo_cliente', 'Vacío'];
      if (!o.nombre) return ['nombre_cliente', 'Vacío'];
      if (!rt) return ['codigo_ruta', ruta ? 'La ruta ' + ruta + ' no existe en Rutas' : 'Vacío'];
      if (o.telefono && !TEL.test(o.telefono)) return ['telefono', 'Debe tener 9 dígitos y empezar con 9'];
      if (Number.isNaN(o.lat) || Number.isNaN(o.lng)) return ['latitud', 'Coordenadas no válidas'];
      if (o.fecha_propuesta === undefined) return ['fecha_propuesta', 'Fecha no válida (usa dd/mm/aaaa)'];
      return o;
    } },
  { id: 'cuotas', n: 'Cuotas', d: 'Cuota mensual por cliente', sheet: 'Cuotas', table: 'cuotas', key: 'cliente_codigo,mes',
    row: (r, x) => {
      const m = date(r.mes);
      const o = { cliente_codigo: code(r.codigo_cliente), mes: m ? m.slice(0, 8) + '01' : m, cuota_cu: num(r.cuota_cu) };
      if (!x.clientes.has(o.cliente_codigo)) return ['codigo_cliente', o.cliente_codigo ? 'El cliente no existe en Cartera' : 'Vacío'];
      if (!o.mes) return ['mes', 'Fecha no válida (usa 01/mm/aaaa)'];
      if (o.cuota_cu == null || Number.isNaN(o.cuota_cu) || o.cuota_cu < 0) return ['cuota_cu', 'Debe ser un número mayor o igual a 0'];
      return o;
    } },
  { id: 'avance', n: 'Avance de volumen', d: 'CU acumuladas del mes', sheet: 'Avance_volumen', table: 'avance_volumen', key: 'cliente_codigo,fecha_corte',
    row: (r, x) => {
      const o = { cliente_codigo: code(r.codigo_cliente), fecha_corte: date(r.fecha_corte), cu: num(r.cu_acumuladas_mes) };
      if (!x.clientes.has(o.cliente_codigo)) return ['codigo_cliente', o.cliente_codigo ? 'El cliente no existe en Cartera' : 'Vacío'];
      if (!o.fecha_corte) return ['fecha_corte', 'Fecha no válida (usa dd/mm/aaaa)'];
      if (o.cu == null || Number.isNaN(o.cu) || o.cu < 0) return ['cu_acumuladas_mes', 'Debe ser un número mayor o igual a 0'];
      return o;
    } },
  { id: 'tarjetas', n: 'Tarjetas', d: 'Lote de tarjetas del programa', sheet: 'Tarjetas', table: 'tarjetas', key: 'codigo',
    row: (r, x) => {
      const ruta = code(r.codigo_ruta) || null;
      const st = txt(r.estado) || (ruta ? 'Asignada' : 'Disponible');
      const o = { codigo: code(r.codigo_tarjeta).toUpperCase(), lote: txt(r.lote) || null, fecha_recepcion: date(r.fecha_recepcion), ruta_codigo: ruta, estado: st.charAt(0).toUpperCase() + st.slice(1).toLowerCase() };
      if (!o.codigo) return ['codigo_tarjeta', 'Vacío'];
      if (ruta && !x.rutaBy[ruta]) return ['codigo_ruta', 'La ruta ' + ruta + ' no existe en Rutas'];
      if (!['Disponible', 'Asignada', 'Anulada'].includes(o.estado)) return ['estado', 'Debe ser Disponible, Asignada o Anulada'];
      if (x.entregadas.has(o.codigo)) return ['codigo_tarjeta', 'La tarjeta ya fue entregada a un cliente; no se modifica'];
      if (o.fecha_recepcion === undefined) return ['fecha_recepcion', 'Fecha no válida (usa dd/mm/aaaa)'];
      return o;
    } }
];

export default function Cargas({ ctx }) {
  const { say, loadRutas } = ctx;
  const [log, setLog] = useState({});
  const [up, setUp] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();
  const pending = useRef(null);

  const loadLog = async () => {
    const [rows, ps] = await Promise.all([q(sb.from('cargas').select('*').order('creado_en', { ascending: false }).limit(200)), q(sb.from('perfiles').select('id, nombre'))]);
    const pn = Object.fromEntries(ps.map((p) => [p.id, p.nombre]));
    const by = {};
    rows.forEach((r) => { if (!by[r.plantilla]) by[r.plantilla] = { ...r, persona: pn[r.usuario_id] || '—' }; });
    setLog(by);
  };
  useEffect(() => { loadLog().catch(() => {}); }, []);

  function pedir(t) { pending.current = t; fileRef.current.click(); }

  async function analizar(file) {
    const t = pending.current;
    if (!file || !t) return;
    setBusy(true); setUp(null);
    try {
      const rows = (await readSheet(file, t.sheet)).filter((r) => Object.values(r).some((v) => txt(v) !== ''));
      // contexto para validar contra lo que ya existe
      const [rutas, clientes, entregadas] = await Promise.all([
        q(sb.from('rutas').select('codigo, region, sala')),
        t.id === 'cuotas' || t.id === 'avance' ? fetchAll(() => sb.from('clientes').select('codigo')) : Promise.resolve([]),
        t.id === 'tarjetas' ? fetchAll(() => sb.from('tarjetas').select('codigo').eq('estado', 'Entregada')) : Promise.resolve([])
      ]);
      const x = { rutaBy: Object.fromEntries(rutas.map((r) => [r.codigo, r])), rutas: new Set(rutas.map((r) => r.codigo)), clientes: new Set(clientes.map((c) => c.codigo)), entregadas: new Set(entregadas.map((c) => c.codigo)), fileKeys: new Set() };
      if (t.id === 'rutas') { rows.forEach((r) => x.fileKeys.add(code(r.codigo_ruta))); rows.forEach((r) => { const c = code(r.codigo_ruta); x.rutaBy[c] = { region: txt(r.region), sala: txt(r.sala_ventas) }; }); }
      const ok = [], errors = [], seen = {};
      const keyCols = t.key.split(',');
      rows.forEach((r, i) => {
        const fila = i + 2;
        const o = t.row(r, x);
        if (Array.isArray(o)) { errors.push({ fila, campo: o[0], e: o[1] }); return; }
        const k = keyCols.map((c) => o[c]).join('|');
        if (seen[k]) { errors.push({ fila, campo: keyCols[keyCols.length - 1], e: 'Duplicado: también está en la fila ' + seen[k] }); return; }
        seen[k] = fila; ok.push(o);
      });
      if (t.sort) ok.sort(t.sort);
      setUp({ t, file: file.name, total: rows.length, ok, errors });
    } catch (e) { say(msg(e), true); }
    setBusy(false);
  }

  async function confirmar() {
    const { t, ok, errors, file } = up;
    setBusy(true);
    try {
      for (let i = 0; i < ok.length; i += 500) {
        await q(sb.from(t.table).upsert(ok.slice(i, i + 500), { onConflict: t.key }));
        setUp((u) => ({ ...u, done: Math.min(ok.length, i + 500) }));
      }
      await q(sb.from('cargas').insert({ plantilla: t.id, archivo: file, filas: ok.length, errores: errors.length }));
      say(fmtN(ok.length) + ' filas cargadas en ' + t.n);
      setUp(null); loadLog();
      if (t.id === 'rutas') loadRutas();
    } catch (e) { say(msg(e), true); }
    setBusy(false);
  }

  return (
    <div className="scr">
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={(e) => { analizar(e.target.files[0]); e.target.value = ''; }} />
      {busy && !up && <div className="loading"><span className="spin" />Leyendo y validando el archivo</div>}
      {up && (
        <div className="box scr" style={{ marginTop: 24, padding: 24 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div className="lbl">Vista previa · {up.t.n}</div>
              <h2 style={{ margin: '8px 0 0', fontSize: 20, fontWeight: 700 }}>{up.file}</h2>
            </div>
            <div style={{ display: 'flex', gap: 28, fontSize: 13 }}>
              <div><div className="muted">Filas</div><div className="big" style={{ fontSize: 26, marginTop: 6 }}>{fmtN(up.total)}</div></div>
              <div><div className="muted">Válidas</div><div className="big" style={{ fontSize: 26, marginTop: 6 }}>{fmtN(up.ok.length)}</div></div>
              <div><div className="muted">Con error</div><div className="big" style={{ fontSize: 26, marginTop: 6, color: up.errors.length ? RED : undefined }}>{fmtN(up.errors.length)}</div></div>
            </div>
          </div>
          {up.errors.length > 0 && (
            <div className="box" style={{ marginTop: 18, overflowX: 'auto', maxHeight: 360, overflowY: 'auto' }}>
              <div style={{ minWidth: 520 }}>
                <div className="gr gh" style={{ gridTemplateColumns: '80px 180px minmax(240px, 1fr)' }}><div className="num">Fila</div><div>Campo</div><div>Error</div></div>
                {up.errors.slice(0, 300).map((e, i) => (
                  <div key={i} className="gr" style={{ gridTemplateColumns: '80px 180px minmax(240px, 1fr)' }}><div className="num">{e.fila}</div><div style={{ fontWeight: 600 }}>{e.campo}</div><div style={{ color: RED }}>{e.e}</div></div>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 18 }}>
            <span className="muted" style={{ fontSize: 13 }}>{up.done ? 'Cargando ' + fmtN(up.done) + ' de ' + fmtN(up.ok.length) + '…' : up.errors.length ? 'Las filas con error no se cargan. Corrígelas en el Excel y vuelve a subirlo.' : 'Todo listo. Las filas existentes se actualizan y las nuevas se agregan.'}</span>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btnS" disabled={busy} onClick={() => setUp(null)}>Cancelar</button>
              <button type="button" className="btnP" disabled={busy || !up.ok.length} onClick={confirmar}>{busy && <span className="spin" />}Cargar {fmtN(up.ok.length)} filas válidas</button>
            </div>
          </div>
        </div>
      )}

      <div className="box" style={{ marginTop: 24, overflowX: 'auto' }}>
        <div style={{ minWidth: 940 }}>
          <div className="gr gh" style={{ gridTemplateColumns: G }}><div>Plantilla</div><div>Última carga</div><div className="num">Filas</div><div>Estado</div><div /></div>
          {TPL.map((t, i) => {
            const l = log[t.id];
            return (
              <div key={t.id} className="gr" style={{ gridTemplateColumns: G, background: i % 2 ? '#FAFAFA' : '#FFFFFF' }}>
                <div><div style={{ fontWeight: 700 }}>{t.n}</div><div className="muted ellip" style={{ fontSize: 12, marginTop: 2 }}>{t.d}</div></div>
                <div>{l ? fechaHora(new Date(l.creado_en)) + ' · ' + l.persona : <span className="muted">Sin cargas</span>}</div>
                <div className="num">{l ? fmtN(l.filas) : '—'}</div>
                <div><span style={{ fontSize: 13, fontWeight: 600, color: l && l.errores ? RED : '#2E2E30' }}>{!l ? '—' : l.errores ? fmtN(l.errores) + ' filas con error' : 'Cargada'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, alignItems: 'center', overflow: 'visible' }}>
                  <a className="qbtn" href="/TRACK_plantillas_carga.xlsx" download style={{ textDecoration: 'none' }}>Plantilla</a>
                  <button type="button" className="btnS" style={{ height: 36 }} disabled={busy} onClick={() => pedir(t)}><Icon n="upload" s={16} />Subir Excel</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="muted" style={{ fontSize: 12, margin: '10px 0 0' }}>Orden de carga: Rutas → Catálogos → Cartera → Propuestas → Cuotas → Avance de volumen → Tarjetas. Los usuarios se crean en la sección Usuarios. Puedes subir el archivo completo de plantillas: se lee la hoja que corresponde.</p>
    </div>
  );
}
