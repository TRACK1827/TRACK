import { useEffect, useState } from 'react';
import { sb, q, fetchAll, msg } from '../lib/supabase.js';
import { telFmt, DIA_VISITA, fechaHora, fmtN } from '../lib/fmt.js';
import Icon from '../Icon.jsx';

const RED = '#AC1622';
const G = '136px minmax(200px, 1.5fr) minmax(170px, 1.1fr) 132px 110px 116px 90px';
const CAMPO = { responsable: 'responsable', telefono: 'teléfono', direccion: 'dirección', distrito: 'distrito', lat: 'latitud', lng: 'longitud', dia_visita: 'día de visita', ruta_codigo: 'ruta', activo: 'estado', nombre: 'nombre' };

export default function Clientes({ ctx }) {
  const { enFiltro, f, admin, say, visibles } = ctx;
  const [all, setAll] = useState(null);
  const [cq, setCq] = useState('');
  const [sinDia, setSinDia] = useState(false);
  const [n, setN] = useState(200);
  const [ed, setEd] = useState(null);
  const [ult, setUlt] = useState('');
  const [busy, setBusy] = useState(false);
  const [personas, setPersonas] = useState({});

  useEffect(() => {
    fetchAll(() => sb.from('clientes').select('codigo, nombre, responsable, telefono, direccion, distrito, lat, lng, ruta_codigo, dia_visita, activo').order('nombre')).then(setAll).catch((e) => say(msg(e), true));
    q(sb.from('perfiles').select('id, nombre')).then((r) => setPersonas(Object.fromEntries(r.map((p) => [p.id, p.nombre])))).catch(() => {});
  }, []);

  if (!all) return <div className="loading"><span className="spin" />Cargando clientes</div>;
  const filtrosTodos = f.region === 'todas' && f.sala === 'todas' && f.ruta === 'todas';
  const txt = cq.trim().toLowerCase();
  const CL = all.filter((c) => (c.ruta_codigo ? enFiltro(c.ruta_codigo) : filtrosTodos) && (!sinDia || !c.dia_visita) &&
    (!txt || [c.codigo, c.nombre, c.responsable, c.telefono, c.direccion].join(' ').toLowerCase().includes(txt)));
  const nSinDia = all.filter((c) => c.activo && !c.dia_visita && (c.ruta_codigo ? enFiltro(c.ruta_codigo) : filtrosTodos)).length;

  async function abrir(c) {
    setEd({ codigo: c.codigo, nombre: c.nombre, f: { responsable: c.responsable || '', telefono: c.telefono || '', direccion: c.direccion || '', distrito: c.distrito || '', lat: c.lat ?? '', lng: c.lng ?? '', dia_visita: c.dia_visita || '', ruta_codigo: c.ruta_codigo || '', activo: c.activo } });
    setUlt('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      const r = await q(sb.from('cliente_cambios').select('campo, usuario_id, origen, creado_en').eq('cliente_codigo', c.codigo).order('creado_en', { ascending: false }).limit(1));
      setUlt(r[0] ? 'Último cambio: ' + (CAMPO[r[0].campo] || r[0].campo) + ' · ' + (r[0].origen === 'campo' ? 'en campo por ' : 'en el portal por ') + (personas[r[0].usuario_id] || '—') + ' · ' + fechaHora(new Date(r[0].creado_en)) : 'Sin ediciones manuales');
    } catch { /* sin historial */ }
  }

  let err = '';
  if (ed) {
    const x = ed.f;
    const lat = x.lat === '' ? null : Number(x.lat), lng = x.lng === '' ? null : Number(x.lng);
    if (x.telefono && !/^9\d{8}$/.test(x.telefono)) err = 'El teléfono debe tener 9 dígitos y empezar con 9.';
    else if ((lat != null && (isNaN(lat) || lat > 0 || lat < -18.5)) || (lng != null && (isNaN(lng) || lng > -68.5 || lng < -81.5))) err = 'Revisa las coordenadas: deben estar dentro del Perú.';
  }
  const upd = (k) => (e) => setEd({ ...ed, f: { ...ed.f, [k]: k === 'telefono' ? e.target.value.replace(/\D/g, '') : e.target.value } });

  async function guardar() {
    if (err) return;
    setBusy(true);
    const x = ed.f;
    const r = visibles.find((v) => v.codigo === x.ruta_codigo);
    const patch = { responsable: x.responsable.trim() || null, telefono: x.telefono || null, direccion: x.direccion.trim() || null, distrito: x.distrito.trim() || null,
      lat: x.lat === '' ? null : Number(x.lat), lng: x.lng === '' ? null : Number(x.lng), dia_visita: x.dia_visita ? Number(x.dia_visita) : null,
      ruta_codigo: x.ruta_codigo || null, activo: x.activo === true || x.activo === 'true', ...(r ? { region: r.region, sala: r.sala } : {}) };
    try {
      const row = await q(sb.from('clientes').update(patch).eq('codigo', ed.codigo).select('codigo, nombre, responsable, telefono, direccion, distrito, lat, lng, ruta_codigo, dia_visita, activo').single());
      setAll(all.map((c) => (c.codigo === ed.codigo ? row : c)));
      say('Datos actualizados · ' + ed.nombre); setEd(null);
    } catch (e) { say(msg(e), true); }
    setBusy(false);
  }

  return (
    <div className="scr">
      {ed && (
        <div className="box scr" style={{ marginTop: 24, padding: 24 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
            <div>
              <div className="lbl">Editar cliente · {ed.codigo}</div>
              <h2 style={{ margin: '8px 0 0', fontSize: 20, fontWeight: 700 }}>{ed.nombre}</h2>
            </div>
            <span className="muted" style={{ fontSize: 13 }}>{ult}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 20 }}>
            <label className="fld">Responsable del negocio<input className="inp" value={ed.f.responsable} onChange={upd('responsable')} /></label>
            <label className="fld">Teléfono<input className="inp" inputMode="numeric" maxLength={9} value={ed.f.telefono} onChange={upd('telefono')} /></label>
            <label className="fld">Dirección<input className="inp" value={ed.f.direccion} onChange={upd('direccion')} /></label>
            <label className="fld">Distrito<input className="inp" value={ed.f.distrito} onChange={upd('distrito')} /></label>
            <label className="fld">Latitud<input className="inp" value={ed.f.lat} onChange={upd('lat')} /></label>
            <label className="fld">Longitud<input className="inp" value={ed.f.lng} onChange={upd('lng')} /></label>
            <label className="fld">Día de visita<select className="inp" value={ed.f.dia_visita} onChange={upd('dia_visita')}><option value="">Sin asignar</option>{[1, 2, 3, 4, 5, 6].map((d) => <option key={d} value={d}>{DIA_VISITA[d]}</option>)}</select></label>
            <label className="fld">Ruta asignada<select className="inp" value={ed.f.ruta_codigo} onChange={upd('ruta_codigo')}><option value="">Sin ruta</option>{visibles.map((r) => <option key={r.codigo} value={r.codigo}>{r.codigo} · {r.sala}</option>)}</select></label>
            <label className="fld">Estado<select className="inp" value={String(ed.f.activo)} onChange={upd('activo')}><option value="true">Activo</option><option value="false">Inactivo (sale de la cartera)</option></select></label>
          </div>
          {err && <p className="err" style={{ marginTop: 14 }}>{err}</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 20 }}>
            <span className="muted" style={{ fontSize: 13 }}>Cada cambio queda en el historial: quién, cuándo y el valor anterior. El código de cliente no se edita.</span>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btnS" onClick={() => setEd(null)}>Cancelar</button>
              <button type="button" className="btnP" disabled={!!err || busy} onClick={guardar}>{busy && <span className="spin" />}Guardar cambios</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 24 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, flex: '0 1 640px' }}>
          <label className="search" style={{ flex: '1 1 320px' }}>
            <Icon n="search" s={18} c="#6B6B6B" />
            <input value={cq} onChange={(e) => { setCq(e.target.value); setN(200); }} placeholder="Código, cliente, responsable o teléfono" aria-label="Buscar cliente" />
          </label>
          {nSinDia > 0 && (
            <button type="button" className="chip" onClick={() => setSinDia(!sinDia)} style={sinDia ? { background: RED, color: '#FFFFFF' } : { background: '#FFFFFF', color: RED, boxShadow: 'inset 0 0 0 1px ' + RED }}>Sin día de visita · {nSinDia}</button>
          )}
        </div>
        <span className="muted" style={{ fontSize: 13 }}>{fmtN(CL.length)} clientes</span>
      </div>
      <div className="box" style={{ marginTop: 12, overflowX: 'auto' }}>
        <div style={{ minWidth: 1060 }}>
          <div className="gr gh" style={{ gridTemplateColumns: G }}><div>Código</div><div>Cliente</div><div>Resp. del negocio</div><div>Teléfono</div><div>Ruta</div><div>Día</div><div /></div>
          {CL.slice(0, n).map((c, ix) => (
            <div key={c.codigo} className="gr" style={{ gridTemplateColumns: G, background: ix % 2 ? '#FAFAFA' : '#FFFFFF', ...(c.activo ? {} : { color: '#8C8C8C' }) }}>
              <div className="tab">{c.codigo}</div>
              <div style={{ fontWeight: 600 }}>{c.nombre}{!c.activo && <span style={{ fontWeight: 400 }}> · inactivo</span>}</div>
              <div>{c.responsable || '—'}</div>
              <div className="tab">{telFmt(c.telefono)}</div>
              <div style={{ fontWeight: 600 }}>{c.ruta_codigo || '—'}</div>
              <div className="muted" style={c.dia_visita ? undefined : { color: RED, fontWeight: 600 }}>{c.dia_visita ? DIA_VISITA[c.dia_visita] : 'Sin asignar'}</div>
              <div style={{ textAlign: 'right' }}>{admin && <button type="button" className="qbtn" onClick={() => abrir(c)}>Editar</button>}</div>
            </div>
          ))}
          {CL.length === 0 && <div className="empty">Sin resultados.</div>}
          {CL.length > n && <div style={{ padding: 14, textAlign: 'center' }}><button type="button" className="qbtn" onClick={() => setN(n + 300)}>Mostrar más ({fmtN(CL.length - n)} restantes)</button></div>}
        </div>
      </div>
    </div>
  );
}
