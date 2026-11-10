import { useEffect, useState } from 'react';
import { sb, q, fetchAll, signedUrl, msg } from '../lib/supabase.js';
import { writeBook } from '../lib/xlsx-io.js';
import { iso, dmy, hora, parseIso, fmtN, PT_START, DIA_VISITA } from '../lib/fmt.js';
import Icon from '../Icon.jsx';

const D = [
  { id: 'visitas', fmt: 'XLSX', t: 'Visitas', s: 'Una fila por visita, efectiva o no efectiva.', cols: 'ruta, persona, cliente, fecha y hora, GPS, distancia, estado, motivo, ejecución FDE, revisión de fotos' },
  { id: 'checklist', fmt: 'XLSX', t: 'Checklist', s: 'Una fila por ítem respondido: disponibilidad de SKU, FDE y digitalización.', cols: 'visita, cliente, tipo de ítem, ítem, respuesta' },
  { id: 'activaciones', fmt: 'XLSX', t: 'Activaciones', s: 'Evaluaciones de propuestas de Comercial y su resultado.', cols: 'propuesta, ruta, evaluación, potencial, compromisos, hora de firma, tarjeta, resultado, motivos' },
  { id: 'no_efectivas', fmt: 'XLSX', t: 'No efectivas', s: 'Visitas no efectivas con motivo, hora y si se reintentaron.', cols: 'ruta, persona, cliente, fecha y hora, motivo, reintento' },
  { id: 'tuali', fmt: 'XLSX', t: 'Digitalización TUALI', s: 'Respuesta por visita sobre uso de TUALI y pedidos iniciados por el cliente.', cols: 'cliente, TUALI instalado, pide autónomo o asistido, faltantes, pedido iniciado' },
  { id: 'cambios_clientes', fmt: 'XLSX', t: 'Cambios en clientes', s: 'Historial de ediciones de datos de clientes, desde campo y desde el portal.', cols: 'cliente, campo, valor anterior, valor nuevo, quién, cuándo, origen' },
  { id: 'fotos', fmt: 'ZIP', t: 'Fotos', s: 'Fachada y rack de cada visita, ordenadas por ruta y cliente.', cols: 'carpeta por ruta · archivo con código de cliente, fecha y tipo' }
];
const CAMPO = { nombre: 'Nombre', direccion: 'Dirección', distrito: 'Distrito', region: 'Región', sala: 'Sala de ventas', lat: 'Latitud', lng: 'Longitud', responsable: 'Responsable del negocio', telefono: 'Teléfono', ruta_codigo: 'Ruta', dia_visita: 'Día de visita', activo: 'Estado' };
const valor = (campo, v) => (v == null ? '' : campo === 'dia_visita' ? DIA_VISITA[+v] || v : campo === 'activo' ? (v === 'true' ? 'Activo' : 'Inactivo') : v);
const PED = { auto: 'Sí, autónomo', asist: 'Sí, asistido', no: 'No' };
const REV = { pend: 'Por revisar', ok: 'Aprobada', rej: 'Rechazada' };
const siNo = (v) => (v === true ? 'Sí' : v === false ? 'No' : '');
const dt = (s) => (s ? dmy(new Date(s)) + ' ' + hora(new Date(s)) : '');

export default function Descargas({ ctx }) {
  const { P, f, filtRutas, visibles, say } = ctx;
  const today = new Date();
  const [desde, setDesde] = useState(iso(P.from < PT_START ? PT_START : P.from));
  const [hasta, setHasta] = useState(iso(P.to > today ? today : P.to));
  const [busy, setBusy] = useState(null);
  const [prog, setProg] = useState('');
  useEffect(() => { setDesde(iso(P.from < PT_START ? PT_START : P.from)); setHasta(iso(P.to > today ? today : P.to)); }, [P.label]);

  const dR = f.ruta !== 'todas' ? visibles.find((r) => r.codigo === f.ruta) : null;
  const fmtD = (x) => dmy(parseIso(x));
  const filtTxt = fmtD(desde) + ' al ' + fmtD(hasta) + ' · ' + (dR ? 'Ruta ' + dR.codigo + ' · ' + dR.sala : (f.region === 'todas' ? 'Todas las regiones' : f.region) + ' · ' + (f.sala === 'todas' ? 'Todas las salas' : 'Sala ' + f.sala));
  const sufijo = (dR ? '_' + dR.codigo : '') + '_' + desde + '_' + hasta;

  async function base() {
    const [ps, cat] = await Promise.all([q(sb.from('perfiles').select('id, nombre')), q(sb.from('catalogos').select('tipo, codigo, descripcion'))]);
    return { pn: Object.fromEntries(ps.map((p) => [p.id, p.nombre])), cn: Object.fromEntries(cat.map((c) => [c.tipo + '|' + c.codigo, c.descripcion])) };
  }
  const visitas = (cols, extra = (x) => x) => fetchAll(() => extra(sb.from('visitas').select(cols + ', clientes(nombre, distrito)').gte('fecha', desde).lte('fecha', hasta).in('ruta_codigo', filtRutas).order('fecha').order('fin')));

  async function go(d) {
    if (!filtRutas.length) { say('No hay rutas con estos filtros', true); return; }
    if (desde > hasta) { say('La fecha inicial es posterior a la final', true); return; }
    setBusy(d.id); setProg('');
    try {
      const { pn, cn } = await base();
      const name = 'TRACK_' + d.id + sufijo;
      if (d.id === 'visitas') {
        const V = await visitas('*');
        await writeBook(name + '.xlsx', { Visitas: V.map((v) => ({ ruta: v.ruta_codigo, persona: pn[v.usuario_id] || '', codigo_cliente: v.cliente_codigo, cliente: v.clientes?.nombre || '', distrito: v.clientes?.distrito || '', fecha: fmtD(v.fecha), inicio: dt(v.inicio), fin: dt(v.fin), estado: v.efectiva ? 'Efectiva' : 'No efectiva', motivo_no_efectiva: v.motivo || '', latitud: v.lat ?? '', longitud: v.lng ?? '', distancia_m: v.distancia_m ?? '', ejecucion_fde: v.efectiva ? (v.n_incumplimientos ? 'No conforme (' + v.n_incumplimientos + ')' : 'Conforme') : '', incidencias: (v.incidencias || []).join(', '), revision_fotos: REV[v.revision] || '', motivo_rechazo: v.motivo_rechazo || '' })) });
      } else if (d.id === 'checklist') {
        const V = await visitas('id, fecha, ruta_codigo, cliente_codigo, usuario_id, skus, fde, tuali_instalado, tuali_pedidos', (x) => x.eq('efectiva', true));
        const rows = [];
        V.forEach((v) => {
          const b = { visita: v.id, fecha: fmtD(v.fecha), ruta: v.ruta_codigo, persona: pn[v.usuario_id] || '', codigo_cliente: v.cliente_codigo, cliente: v.clientes?.nombre || '' };
          Object.entries(v.skus || {}).forEach(([k, r]) => rows.push({ ...b, tipo: 'Disponibilidad de SKU', item: cn['SKU|' + k] || k, respuesta: r === 'si' ? 'Sí' : r === 'no' ? 'No' : r }));
          Object.entries(v.fde || {}).forEach(([k, r]) => rows.push({ ...b, tipo: 'Foto de Éxito', item: cn['Ítem FDE|' + k] || k, respuesta: r === 'si' ? 'Sí' : r === 'no' ? 'No' : r === 'na' ? 'N/A' : r }));
          rows.push({ ...b, tipo: 'Digitalización', item: 'Tiene TUALI instalado', respuesta: siNo(v.tuali_instalado) });
          if (v.tuali_instalado) rows.push({ ...b, tipo: 'Digitalización', item: 'Hace pedidos por TUALI', respuesta: PED[v.tuali_pedidos] || '' });
        });
        await writeBook(name + '.xlsx', { Checklist: rows });
      } else if (d.id === 'activaciones') {
        const PRs = await fetchAll(() => sb.from('propuestas').select('*').in('ruta_codigo', filtRutas).or(`estado.eq.pend,and(resuelto_en.gte.${desde},resuelto_en.lte.${hasta}T23:59:59)`).order('fecha_propuesta'));
        const EST = { pend: 'Por evaluar', act: 'Activado', noapto: 'No apto' };
        await writeBook(name + '.xlsx', { Activaciones: PRs.map((p) => ({ codigo_cliente: p.codigo_cliente, cliente: p.nombre, ruta: p.ruta_codigo, asesor_comercial: p.asesor || '', fecha_propuesta: p.fecha_propuesta ? fmtD(p.fecha_propuesta) : '', resultado: EST[p.estado], evaluado_por: pn[p.resuelto_por] || '', fecha_resultado: dt(p.resuelto_en),
          ...Object.fromEntries(Object.entries(p.evaluacion || {}).map(([k, r]) => ['eval_' + (cn['Ítem evaluación|' + k] || k), r === 'si' ? 'Sí' : 'No'])),
          potencial: p.potencial || '', compromisos: siNo(p.compromisos), hora_firma: dt(p.firma_en), tarjeta: p.tarjeta_codigo || '', motivos_no_apto: p.motivos || '', ultima_no_efectiva: p.noef_motivo ? p.noef_motivo + ' · ' + dt(p.noef_en) : '' })) });
      } else if (d.id === 'no_efectivas') {
        const V = await visitas('id, fecha, fin, efectiva, ruta_codigo, cliente_codigo, usuario_id, motivo');
        const efDia = new Set(V.filter((v) => v.efectiva).map((v) => v.cliente_codigo + '|' + v.fecha));
        const rows = V.filter((v) => !v.efectiva).map((v) => ({ ruta: v.ruta_codigo, persona: pn[v.usuario_id] || '', codigo_cliente: v.cliente_codigo, cliente: v.clientes?.nombre || '', fecha_hora: dt(v.fin), motivo: v.motivo || '', reintento_efectivo_mismo_dia: efDia.has(v.cliente_codigo + '|' + v.fecha) ? 'Sí' : 'No' }));
        await writeBook(name + '.xlsx', { 'No efectivas': rows });
      } else if (d.id === 'tuali') {
        const V = await visitas('fecha, ruta_codigo, cliente_codigo, usuario_id, skus, pedido_tuali, tuali_instalado, tuali_pedidos', (x) => x.eq('efectiva', true));
        await writeBook(name + '.xlsx', { 'Digitalización TUALI': V.map((v) => ({ fecha: fmtD(v.fecha), ruta: v.ruta_codigo, persona: pn[v.usuario_id] || '', codigo_cliente: v.cliente_codigo, cliente: v.clientes?.nombre || '', tuali_instalado: siNo(v.tuali_instalado), hace_pedidos: v.tuali_instalado ? PED[v.tuali_pedidos] || '' : '', sku_faltantes: Object.values(v.skus || {}).filter((r) => r === 'no').length, pedido_iniciado_por_cliente: siNo(v.pedido_tuali) })) });
      } else if (d.id === 'cambios_clientes') {
        const C = await fetchAll(() => sb.from('cliente_cambios').select('*, clientes(nombre, ruta_codigo)').gte('creado_en', desde).lte('creado_en', hasta + 'T23:59:59').order('creado_en'));
        const rows = C.filter((c) => !c.clientes?.ruta_codigo || filtRutas.includes(c.clientes.ruta_codigo)).map((c) => ({ codigo_cliente: c.cliente_codigo, cliente: c.clientes?.nombre || '', ruta: c.clientes?.ruta_codigo || '', campo: CAMPO[c.campo] || c.campo, valor_anterior: valor(c.campo, c.anterior), valor_nuevo: valor(c.campo, c.nuevo), quien: pn[c.usuario_id] || '', cuando: dt(c.creado_en), origen: c.origen === 'campo' ? 'Campo' : 'Portal' }));
        await writeBook(name + '.xlsx', { 'Cambios en clientes': rows });
      } else if (d.id === 'fotos') {
        const V = await visitas('fecha, ruta_codigo, cliente_codigo, foto_fachada, foto_rack, foto_edf', (x) => x.eq('efectiva', true));
        const files = [];
        V.forEach((v) => { if (v.foto_fachada) files.push([v.ruta_codigo + '/' + v.cliente_codigo + '_' + v.fecha + '_fachada.jpg', v.foto_fachada]); if (v.foto_rack) files.push([v.ruta_codigo + '/' + v.cliente_codigo + '_' + v.fecha + '_rack.jpg', v.foto_rack]); if (v.foto_edf) files.push([v.ruta_codigo + '/' + v.cliente_codigo + '_' + v.fecha + '_edf.jpg', v.foto_edf]); });
        if (!files.length) { say('No hay fotos en este rango', true); setBusy(null); return; }
        if (files.length > 1500 && !window.confirm('Son ' + fmtN(files.length) + ' fotos. La descarga puede tardar varios minutos. ¿Continuar? (Puedes acotar por ruta o fechas.)')) { setBusy(null); return; }
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        let n = 0;
        for (let i = 0; i < files.length; i += 6) {
          await Promise.all(files.slice(i, i + 6).map(async ([zname, path]) => {
            const u = await signedUrl(path);
            if (u) { const r = await fetch(u); if (r.ok) zip.file(zname, await r.blob()); }
            n++; setProg(fmtN(n) + ' de ' + fmtN(files.length));
          }));
        }
        setProg('Comprimiendo');
        const blob = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name + '.zip'; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }
      say('Descarga lista · ' + d.t);
    } catch (e) { say(msg(e), true); }
    setBusy(null); setProg('');
  }

  return (
    <div className="scr">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '12px 16px', marginTop: 24 }}>
        <label className="fld">Desde<input className="inp" type="date" value={desde} min={iso(PT_START)} max={iso(today)} onChange={(e) => setDesde(e.target.value)} style={{ width: 176 }} /></label>
        <label className="fld">Hasta<input className="inp" type="date" value={hasta} min={iso(PT_START)} max={iso(today)} onChange={(e) => setHasta(e.target.value)} style={{ width: 176 }} /></label>
        <p className="muted" style={{ flex: 1, minWidth: 240, margin: 0, paddingBottom: 11, fontSize: 13 }}>Se descargará: <b style={{ color: '#2E2E30' }}>{filtTxt}</b></p>
      </div>
      <div className="box" style={{ marginTop: 16, overflow: 'hidden' }}>
        {D.map((d, ix) => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '16px 20px', borderBottom: '1px solid #E6E6E6', background: ix % 2 ? '#FAFAFA' : '#FFFFFF' }}>
            <span style={{ width: 48, height: 28, borderRadius: 6, background: '#F2F2F3', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{d.fmt}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{d.t}</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>{d.s}</div>
              <div style={{ fontSize: 12, color: '#8C8C8C', marginTop: 4, lineHeight: 1.45 }}>{busy === d.id && prog ? 'Descargando fotos · ' + prog : d.cols}</div>
            </div>
            <button type="button" className="btnS" style={{ flex: 'none', height: 40 }} disabled={!!busy} onClick={() => go(d)}>
              {busy === d.id ? <span className="spin" /> : <Icon n="download" s={16} />}{busy === d.id ? 'Preparando' : 'Descargar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
