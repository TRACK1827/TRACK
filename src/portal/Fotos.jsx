import { useEffect, useRef, useState } from 'react';
import { sb, q, signedUrl, msg } from '../lib/supabase.js';
import { fechaHora, corta, parseIso, fmtN } from '../lib/fmt.js';
import { RADIO_M } from '../lib/device.js';

const RED = '#AC1622';
const TABS = [{ id: 'pend', l: 'Por revisar' }, { id: 'ok', l: 'Aprobadas' }, { id: 'rej', l: 'Rechazadas' }];
const COLS = 'id, fecha, fin, ruta_codigo, cliente_codigo, usuario_id, distancia_m, lat, n_incumplimientos, foto_fachada, foto_rack, foto_edf, revision, motivo_rechazo, clientes(nombre, direccion, distrito)';

export default function Fotos({ ctx }) {
  const { filtRutas, canReview, say, loadPend } = ctx;
  const [tab, setTab] = useState('pend');
  const [counts, setCounts] = useState({});
  const [list, setList] = useState(null);
  const [sel, setSel] = useState(null);
  const [personas, setPersonas] = useState({});
  const [motivos, setMotivos] = useState([]);
  const [rej, setRej] = useState(null); // motivo elegido; null = no rechazando
  const [busy, setBusy] = useState(false);
  const key = filtRutas.join(',');
  const reqId = useRef(0);

  useEffect(() => {
    q(sb.from('perfiles').select('id, nombre')).then((r) => setPersonas(Object.fromEntries(r.map((p) => [p.id, p.nombre])))).catch(() => {});
    q(sb.from('catalogos').select('descripcion').eq('tipo', 'Motivo rechazo foto').eq('activo', true).order('orden')).then((r) => setMotivos(r.map((x) => x.descripcion))).catch(() => {});
  }, []);

  async function load(t = tab) {
    const my = ++reqId.current;
    setList(null); setSel(null); setRej(null);
    if (!filtRutas.length) { setList([]); setCounts({}); return; }
    const base = () => sb.from('visitas').select('id', { count: 'exact', head: true }).eq('efectiva', true).in('ruta_codigo', filtRutas);
    const [rows, ...cs] = await Promise.all([
      q(sb.from('visitas').select(COLS).eq('efectiva', true).eq('revision', t).in('ruta_codigo', filtRutas).order('fin', { ascending: t === 'pend' }).limit(100)),
      ...TABS.map((x) => base().eq('revision', x.id))
    ]);
    if (my !== reqId.current) return; // llegó una respuesta vieja: se descarta
    setCounts(Object.fromEntries(TABS.map((x, i) => [x.id, cs[i].count || 0])));
    setList(rows);
    if (rows[0]) pick(rows[0]);
  }
  useEffect(() => { load(tab).catch((e) => say(msg(e), true)); }, [tab, key]);

  async function pick(v) {
    setRej(null);
    setSel({ v, fach: null, rack: null, edf: null, prev: [] });
    const [fach, rack, edf, prevRows] = await Promise.all([
      signedUrl(v.foto_fachada), signedUrl(v.foto_rack), signedUrl(v.foto_edf),
      q(sb.from('visitas').select('id, fecha, foto_rack').eq('cliente_codigo', v.cliente_codigo).eq('efectiva', true).neq('id', v.id).not('foto_rack', 'is', null).order('fecha', { ascending: false }).limit(3))
    ]);
    const prev = await Promise.all(prevRows.map(async (p) => ({ d: corta(parseIso(p.fecha)), url: await signedUrl(p.foto_rack) })));
    setSel((s) => (s && s.v.id === v.id ? { v, fach, rack, edf, prev } : s));
  }

  async function decide(st, motivo) {
    const v = sel.v;
    setBusy(true);
    try {
      await q(sb.from('visitas').update({ revision: st, motivo_rechazo: motivo || null }).eq('id', v.id));
      const rest = list.filter((x) => x.id !== v.id);
      setList(rest); setCounts((c) => ({ ...c, pend: Math.max(0, (c.pend || 0) - 1), [st]: (c[st] || 0) + 1 }));
      if (rest[0]) pick(rest[0]); else setSel(null);
      setRej(null); loadPend();
      say((st === 'ok' ? 'Visita aprobada · ' : 'Visita rechazada · ') + (v.clientes?.nombre || v.cliente_codigo));
    } catch (e) { say(msg(e), true); }
    setBusy(false);
  }

  const distTxt = (v, long) => {
    if (v.distancia_m == null) return v.lat == null ? 'Sin GPS' : 'Cliente sin coordenadas';
    const far = v.distancia_m > RADIO_M;
    return v.distancia_m + ' m' + (far ? (long ? ' · fuera del radio de ' + RADIO_M + ' m' : ' · fuera de radio') : long ? ' · dentro del radio' : '');
  };
  const isFar = (v) => v.distancia_m == null || v.distancia_m > RADIO_M;
  const stTxt = { pend: 'Por revisar', ok: 'Aprobada', rej: 'Rechazada' };

  return (
    <div className="scr">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 24 }}>
        {TABS.map((t) => (
          <button key={t.id} type="button" className="chip" onClick={() => setTab(t.id)}
            style={tab === t.id ? { background: '#2E2E30', color: '#FFFFFF' } : { background: '#FFFFFF', color: '#2E2E30', boxShadow: 'inset 0 0 0 1px #E6E6E6' }}>{t.l} · {fmtN(counts[t.id] || 0)}</button>
        ))}
      </div>

      {!list && <div className="loading"><span className="spin" />Cargando visitas</div>}
      {list && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginTop: 16, alignItems: 'flex-start' }}>
          <div className="box" style={{ flex: '1 1 300px', maxWidth: '100%', overflow: 'hidden', maxHeight: 760, overflowY: 'auto' }}>
            {list.map((v) => (
              <button key={v.id} type="button" onClick={() => pick(v)} style={{ display: 'block', width: '100%', padding: '14px 18px', borderBottom: '1px solid #E6E6E6', background: sel && sel.v.id === v.id ? '#F2F2F3' : '#FFFFFF' }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span className="ellip" style={{ fontSize: 14, fontWeight: 600 }}>{v.clientes?.nombre || v.cliente_codigo}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', color: isFar(v) ? RED : '#6B6B6B' }}>{distTxt(v)}</span>
                </span>
                <span className="muted ellip" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>{v.cliente_codigo} · {v.ruta_codigo} · {personas[v.usuario_id] || '—'}</span>
                <span className="ellip" style={{ display: 'block', fontSize: 12, marginTop: 3, ...(v.revision === 'rej' ? { color: RED, fontWeight: 600 } : { color: '#6B6B6B' }) }}>{fechaHora(new Date(v.fin))} · {v.revision === 'rej' ? 'Rechazada · ' + (v.motivo_rechazo || '') : stTxt[v.revision]}</span>
              </button>
            ))}
            {list.length === 0 && <div className="empty">No hay visitas en esta bandeja.</div>}
            {list.length === 100 && <div className="empty" style={{ fontSize: 12 }}>Se muestran las 100 más {tab === 'pend' ? 'antiguas' : 'recientes'}. Usa los filtros para acotar.</div>}
          </div>

          {sel && (
            <div className="box" style={{ flex: '999 1 520px', minWidth: 0, padding: 24 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div>
                  <div className="lbl">{sel.v.cliente_codigo} · {sel.v.ruta_codigo} · {personas[sel.v.usuario_id] || '—'}</div>
                  <h2 style={{ margin: '8px 0 0', fontSize: 22, fontWeight: 700, letterSpacing: '-.01em' }}>{sel.v.clientes?.nombre}</h2>
                  <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>{[sel.v.clientes?.direccion, sel.v.clientes?.distrito].filter(Boolean).join(' · ')}</p>
                </div>
                <span className="chip" style={sel.v.revision === 'rej' ? { background: RED, color: '#FFFFFF' } : sel.v.revision === 'ok' ? { background: '#2E2E30', color: '#FFFFFF' } : { background: '#F2F2F3', color: '#2E2E30' }}>{stTxt[sel.v.revision]}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 20 }}>
                {[['Fachada', sel.fach, sel.v.foto_fachada], ['Rack', sel.rack, sel.v.foto_rack], ['EDF', sel.edf, sel.v.foto_edf]].map(([l, u, path]) => (
                  <figure key={l} style={{ margin: 0 }}>
                    <div className="lbl" style={{ marginBottom: 8 }}>{l}</div>
                    {u ? <a href={u} target="_blank" rel="noreferrer"><img src={u} alt={l + ' de ' + (sel.v.clientes?.nombre || '')} style={{ width: '100%', height: 300, objectFit: 'cover', borderRadius: 12, display: 'block', background: '#2E2E30' }} /></a>
                      : <div className="muted" style={{ height: 300, borderRadius: 12, background: '#F2F2F3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{path ? 'Cargando…' : 'Sin evidencia'}</div>}
                  </figure>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px 24px', marginTop: 20, padding: '16px 0', borderTop: '1px solid #E6E6E6', borderBottom: '1px solid #E6E6E6', fontSize: 13 }}>
                <div><div className="muted">Fecha y hora</div><div style={{ fontWeight: 600, marginTop: 3 }}>{fechaHora(new Date(sel.v.fin))}</div></div>
                <div><div className="muted">Distancia al cliente</div><div style={{ fontWeight: 600, marginTop: 3, color: isFar(sel.v) ? RED : undefined }}>{distTxt(sel.v, true)}</div></div>
                <div><div className="muted">Visita</div><div style={{ fontWeight: 600, marginTop: 3 }}>Efectiva</div></div>
                <div><div className="muted">Ejecución FDE</div><div style={{ fontWeight: 600, marginTop: 3, color: sel.v.n_incumplimientos ? RED : undefined }}>{sel.v.n_incumplimientos ? 'No conforme (' + sel.v.n_incumplimientos + ')' : 'Conforme'}</div></div>
              </div>
              {sel.prev.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <div className="lbl">Fotos anteriores del cliente</div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                    {sel.prev.map((p, i) => (
                      <div key={i} style={{ width: 104 }}>
                        {p.url ? <img src={p.url} alt="Foto anterior del rack" style={{ width: 104, height: 72, objectFit: 'cover', borderRadius: 8, display: 'block' }} /> : <div style={{ width: 104, height: 72, borderRadius: 8, background: '#F2F2F3' }} />}
                        <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{p.d}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {sel.v.revision === 'rej' && <p style={{ margin: '18px 0 0', fontSize: 13, fontWeight: 600, color: RED }}>Rechazada: {sel.v.motivo_rechazo}</p>}
              {rej !== null && (
                <div className="scr" style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid #E6E6E6' }}>
                  <div className="lbl" style={{ color: RED }}>Motivo de rechazo</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                    {motivos.map((m) => (
                      <button key={m} type="button" className="chip" role="radio" aria-checked={rej === m} onClick={() => setRej(m)}
                        style={rej === m ? { background: RED, color: '#FFFFFF' } : { background: '#FFFFFF', color: '#2E2E30', boxShadow: 'inset 0 0 0 1px #E6E6E6' }}>{m}</button>
                    ))}
                  </div>
                </div>
              )}
              {sel.v.revision === 'pend' && canReview && (
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
                  {rej === null ? (
                    <>
                      <button type="button" className="btnS" style={{ color: RED, borderColor: RED }} onClick={() => setRej('')}>Rechazar</button>
                      <button type="button" className="btnP" disabled={busy} onClick={() => decide('ok')}>Aprobar visita</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="btnS" onClick={() => setRej(null)}>Cancelar</button>
                      <button type="button" className="btnP" disabled={!rej || busy} onClick={() => decide('rej', rej)}>Confirmar rechazo</button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
