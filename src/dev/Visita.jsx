import { useRef, useState } from 'react';
import { sb, q, upload, msg } from '../lib/supabase.js';
import { hora, fechaHora, iso, dist } from '../lib/fmt.js';
import { getPosition, meters, compress, rid, RADIO_M } from '../lib/device.js';
import Icon from '../Icon.jsx';
import { YesNo, RadioList, Steps, FlowHead, OkDot, MainBtn, segStyle } from './ui.jsx';

const RED = '#AC1622', INK = '#2E2E30';
const STEPS = ['Check-in', 'Disponibilidad de SKU', 'Foto de Éxito', 'Digitalización', 'Evidencia'];
const FDE_SUB = { RACK: 'Rack', VIS: 'Exhibición', PREC: 'Precios', POP: 'Si corresponde' };

// Registra una visita no efectiva (se usa desde la ficha y desde el check-in)
export async function registrarNoEf(c, motivo, D, extra = {}) {
  const row = await q(sb.from('visitas').insert({
    cliente_codigo: c.codigo, ruta_codigo: c.ruta_codigo, fecha: iso(new Date()), efectiva: false, motivo, ...extra
  }).select('id, cliente_codigo, efectiva, motivo, fin, n_incumplimientos').single());
  D.patch((s) => ({ visitasHoy: [...(s.visitasHoy || []), row] }));
  return row;
}

export default function Visita({ c, D, nav, go, say }) {
  const [v, setV] = useState(() => ({ step: 1, inicio: new Date().toISOString(), ubic: { st: 'idle' }, chk: {}, sku: {}, tuali: null, inst: null, ped: null, fotos: {}, inc: {}, noefMode: false, motivo: null }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRefs = { fach: useRef(), rack: useRef(), edf: useRef() };
  const up = (p) => setV((x) => ({ ...x, ...p }));

  const SKUS = D.cat.SKU || [], FDE = D.cat.FDE || [], INC = D.cat.INC || [], MOT = (D.cat.MOT || []).map((m) => m.descripcion);
  const st = v.step;
  const skuAns = SKUS.filter((k) => v.sku[k.codigo]).length;
  const faltantes = SKUS.filter((k) => v.sku[k.codigo] === 'no');
  const fdeAns = FDE.filter((k) => v.chk[k.codigo]).length;
  const nInc = FDE.filter((k) => v.chk[k.codigo] === 'no').length + (faltantes.length ? 1 : 0);
  const nFotos = (v.fotos.fach ? 1 : 0) + (v.fotos.rack ? 1 : 0) + (v.fotos.edf ? 1 : 0);
  const exit = () => go(nav.visFrom === 'tabs' ? { screen: 'tabs', tab: 'hoy' } : { screen: 'det' });

  async function validar() {
    up({ ubic: { st: 'loading' } }); setErr('');
    try {
      const p = await getPosition();
      const d = meters(p, c);
      up({ ubic: { st: 'ok', lat: p.lat, lng: p.lng, d, hora: hora(new Date()) } });
    } catch (e) { up({ ubic: { st: 'err', err: e.message } }); }
  }

  async function shoot(k, file) {
    if (!file) return;
    try {
      const blob = await compress(file);
      const prev = v.fotos[k];
      if (prev) URL.revokeObjectURL(prev.url);
      up({ fotos: { ...v.fotos, [k]: { blob, url: URL.createObjectURL(blob), fecha: fechaHora(new Date()) } } });
    } catch { say('No se pudo leer la foto. Inténtalo de nuevo.', true); }
  }

  async function noEf() {
    setBusy(true);
    try {
      const u = v.ubic.st === 'ok' ? { lat: v.ubic.lat, lng: v.ubic.lng, distancia_m: v.ubic.d } : {};
      await registrarNoEf(c, v.motivo, D, { inicio: v.inicio, ...u });
      go({ screen: 'tabs', tab: 'hoy', plan: 'noef' }); say('No efectiva · ' + c.nombre);
    } catch (e) { setErr(msg(e)); }
    setBusy(false);
  }

  async function cerrar() {
    setBusy(true); setErr('');
    try {
      const fecha = iso(new Date());
      const base = `${c.ruta_codigo}/${c.codigo}/${fecha}`;
      const id = rid();
      const pf = await upload(`${base}_fachada_${id}.jpg`, v.fotos.fach.blob, 'image/jpeg');
      const pr = await upload(`${base}_rack_${id}.jpg`, v.fotos.rack.blob, 'image/jpeg');
      const pe = await upload(`${base}_edf_${id}.jpg`, v.fotos.edf.blob, 'image/jpeg');
      const row = await q(sb.from('visitas').insert({
        cliente_codigo: c.codigo, ruta_codigo: c.ruta_codigo, fecha, inicio: v.inicio, efectiva: true,
        lat: v.ubic.lat ?? null, lng: v.ubic.lng ?? null, distancia_m: v.ubic.d ?? null,
        fde: v.chk, skus: v.sku, n_incumplimientos: nInc,
        pedido_tuali: faltantes.length ? !!v.tuali : null,
        tuali_instalado: v.inst === 'si', tuali_pedidos: v.inst === 'si' ? v.ped : null,
        incidencias: Object.keys(v.inc).filter((k) => v.inc[k]),
        foto_fachada: pf, foto_rack: pr, foto_edf: pe
      }).select('id, cliente_codigo, efectiva, motivo, fin, n_incumplimientos').single());
      D.patch((s) => ({ visitasHoy: [...(s.visitasHoy || []), row], ultBy: { ...s.ultBy, [c.codigo]: fecha } }));
      Object.values(v.fotos).forEach((f) => URL.revokeObjectURL(f.url));
      go({ screen: 'tabs', tab: 'hoy', plan: 'ok' }); say('Visita efectiva · ' + c.nombre);
    } catch (e) { setErr(msg(e)); }
    setBusy(false);
  }

  // ---------- botón principal
  let can = true, label = 'Continuar', act = () => up({ step: st + 1 });
  if (st === 1 && v.noefMode) { can = !!v.motivo; label = 'Registrar no efectiva'; act = noEf; }
  else if (st === 1 && v.ubic.st !== 'ok') {
    if (v.ubic.st === 'err') { label = 'Reintentar ubicación'; act = validar; }
    else { label = 'Validar ubicación'; act = validar; can = v.ubic.st !== 'loading'; }
  }
  else if (st === 2) can = skuAns === SKUS.length;
  else if (st === 3) can = fdeAns === FDE.length;
  else if (st === 4) can = v.inst === 'no' || (v.inst === 'si' && !!v.ped);
  else if (st === 5) can = nFotos === 3;
  else if (st === 6) { label = 'Cerrar visita'; act = cerrar; }

  const far = v.ubic.st === 'ok' && v.ubic.d != null && v.ubic.d > RADIO_M;
  const digiTxt = v.inst === 'no' ? 'No instalado' : ({ auto: 'Pedidos autónomos', asist: 'Pedidos asistidos', no: 'Instalado, sin pedidos' }[v.ped] || '—');

  return (
    <div className="scr">
      <FlowHead label={st === 6 ? 'Cierre' : 'Paso ' + st + ' de 5 · ' + STEPS[st - 1]} sub={c.nombre} onExit={exit} exitLabel="Salir de la visita" />
      <Steps n={5} cur={st} done={st === 6} />

      {st === 1 && (
        <div className="body" style={{ padding: '28px 24px' }}>
          {v.noefMode ? (
            <>
              <h2 className="h2">Visita no efectiva</h2>
              <p className="muted" style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.45 }}>El cliente queda en la lista para volver más tarde.</p>
              <div className="lbl" style={{ margin: '28px 0 8px' }}>Motivo</div>
              <RadioList items={MOT} value={v.motivo} onPick={(m) => up({ motivo: m })} minH={60} />
            </>
          ) : (
            <>
              <h2 className="h2">Check-in</h2>
              <p className="muted" style={{ margin: '6px 0 0', fontSize: 14 }}>{[c.direccion, c.distrito].filter(Boolean).join(' · ')}</p>
              <div style={{ marginTop: 28, height: 240, border: '1px solid #E6E6E6', borderRadius: 16, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="300" height="220" viewBox="0 0 300 220" fill="none" role="img" aria-label="Referencia de ubicación: tú y el cliente">
                  <path d="M0 70h300M0 150h300M100 0v220M200 0v220" stroke="#F2F2F3" strokeWidth="1" />
                  <circle cx="150" cy="110" r="90" stroke="#E6E6E6" strokeWidth="1" />
                  <circle cx="150" cy="110" r="52" stroke="#E6E6E6" strokeWidth="1" />
                  <circle cx="150" cy="110" r="52" stroke={far ? RED : INK} strokeWidth="1" strokeDasharray="2 4" opacity={v.ubic.st === 'ok' ? 1 : 0} />
                  {v.ubic.st === 'ok' && (() => {
                    const r = v.ubic.d == null ? 30 : Math.min(84, 8 + (v.ubic.d / RADIO_M) * 44);
                    const x = 150 + r * 0.77, y = 110 - r * 0.64;
                    return <>
                      <path d={`M150 110 L${x} ${y}`} stroke="#8C8C8C" strokeWidth="1" strokeDasharray="3 3" />
                      <circle cx={x} cy={y} r="10" fill={INK} opacity=".08" /><circle cx={x} cy={y} r="5" fill={INK} />
                      <text x={150 + r * 0.4 - 18} y={110 - r * 0.32 + 18} fontFamily="Inter, sans-serif" fontSize="11" fontWeight="600" fill="#6B6B6B">{dist(v.ubic.d)}</text>
                    </>;
                  })()}
                  <g transform="translate(138 88)"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" stroke={RED} strokeWidth="1.5" fill="#FFFFFF" /><circle cx="12" cy="10" r="3" stroke={RED} strokeWidth="1.5" /></g>
                </svg>
                <div style={{ position: 'absolute', left: 14, bottom: 12, display: 'flex', gap: 14, fontSize: 11, color: '#6B6B6B' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: RED }} />Cliente</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: INK }} />Tú</span>
                </div>
              </div>
              {v.ubic.st !== 'ok' && (
                <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid #E6E6E6' }}>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{v.ubic.st === 'loading' ? 'Buscando tu ubicación…' : 'Valida tu ubicación'}</p>
                  <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>Debes estar a menos de {RADIO_M} m del cliente.</p>
                  {v.ubic.st === 'err' && (
                    <>
                      <p className="err" style={{ marginTop: 10 }}>{v.ubic.err}</p>
                      <button type="button" className="ulink" style={{ marginTop: 10, height: 32 }} onClick={() => up({ ubic: { st: 'ok', d: null, hora: hora(new Date()) } })}>Continuar sin ubicación</button>
                    </>
                  )}
                </div>
              )}
              {v.ubic.st === 'ok' && (
                <div className="anim" style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid #E6E6E6', display: 'flex', gap: 12 }}>
                  <OkDot red={far || v.ubic.d == null} x={far || v.ubic.d == null} />
                  <span>
                    <span style={{ display: 'block', fontSize: 16, fontWeight: 600, color: far ? RED : INK }}>
                      {v.ubic.lat == null ? 'Sin ubicación' : v.ubic.d == null ? 'Ubicación registrada' : 'Estás a ' + dist(v.ubic.d) + ' del cliente'}
                    </span>
                    <span className="muted" style={{ display: 'block', fontSize: 14, marginTop: 3 }}>
                      {v.ubic.lat == null ? 'Se registrará sin GPS y el supervisor lo verá.' : v.ubic.d == null ? 'El cliente no tiene coordenadas cargadas · ' + v.ubic.hora : far ? 'Fuera del radio de ' + RADIO_M + ' m. Se registrará y el supervisor lo verá.' : 'Ubicación verificada · ' + v.ubic.hora}
                    </span>
                  </span>
                </div>
              )}
              <button type="button" className="link" style={{ marginTop: 16 }} onClick={() => up({ noefMode: true })}><Icon n="info" s={16} />No se pudo realizar la visita</button>
            </>
          )}
          {err && <p className="err">{err}</p>}
        </div>
      )}

      {st === 2 && (
        <div className="body" style={{ padding: '28px 0 16px' }}>
          <div style={{ padding: '0 24px 16px', borderBottom: '1px solid #E6E6E6' }}>
            <h2 className="h2">Disponibilidad de SKU</h2>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 6 }}>
              <p className="muted" style={{ margin: 0, fontSize: 14 }}>¿Está el SKU en el punto de venta?</p>
              <button type="button" className="ulink" style={{ height: 44, color: INK }} onClick={() => up({ sku: Object.fromEntries(SKUS.map((k) => [k.codigo, 'si'])) })}>Todos sí</button>
            </div>
          </div>
          {SKUS.map((k, i) => (
            <div key={k.codigo} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 60, padding: '8px 16px 8px 24px', background: i % 2 ? '#F5F5F6' : '#FFFFFF' }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>{k.descripcion}</span>
                {v.sku[k.codigo] === 'no' && <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: RED, marginTop: 2 }}>Faltante</span>}
              </span>
              <YesNo value={v.sku[k.codigo]} label={k.descripcion} onChange={(val) => up({ sku: { ...v.sku, [k.codigo]: val } })} />
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 24px 0', fontSize: 13 }}>
            <span className="muted">{skuAns} de {SKUS.length} respondidos</span>
            <span style={{ fontWeight: 600, color: faltantes.length ? RED : INK }}>{skuAns === 0 ? '' : faltantes.length === 0 ? 'Sin faltantes' : faltantes.length + (faltantes.length === 1 ? ' faltante' : ' faltantes')}</span>
          </div>
          {faltantes.length > 0 && (
            <div className="anim" style={{ padding: '22px 24px 0' }}>
              <div className="lbl">Reposición en TUALI</div>
              {!v.tuali ? (
                <>
                  <button type="button" className="btnS" style={{ width: '100%', marginTop: 12 }} onClick={() => up({ tuali: hora(new Date()) })}><Icon n="mobile" s={20} />Cliente inició su pedido en TUALI</button>
                  <p className="muted" style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.45 }}>Tú no haces el pedido: invita al cliente a pedir los faltantes desde su app y registra si lo inició.</p>
                </>
              ) : (
                <div className="anim" style={{ display: 'flex', gap: 12, padding: 16, marginTop: 12, border: '1px solid #E6E6E6', borderRadius: 12 }}>
                  <OkDot />
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>Pedido iniciado por el cliente</span>
                    <span className="muted" style={{ display: 'block', fontSize: 13, marginTop: 3 }}>TUALI · {v.tuali} · {faltantes.length} SKU</span>
                  </span>
                  <button type="button" className="ulink" onClick={() => up({ tuali: null })}>Deshacer</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {st === 3 && (
        <div className="body" style={{ padding: '28px 0 16px' }}>
          <div style={{ padding: '0 24px 18px', borderBottom: '1px solid #E6E6E6' }}>
            <h2 className="h2">Foto de Éxito</h2>
            <p className="muted" style={{ margin: '6px 0 0', fontSize: 14 }}>Marca cada punto de la FDE básica.</p>
          </div>
          {FDE.map((k) => {
            const na = k.codigo === 'POP' || /corresponde/i.test(k.descripcion);
            const l = k.descripcion.replace(/\s*\(si corresponde\)/i, '');
            return (
              <div key={k.codigo} className="row" style={{ minHeight: 76 }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>{l}</span>
                  <span className="muted" style={{ display: 'block', fontSize: 12, marginTop: 3 }}>{FDE_SUB[k.codigo] || (na ? 'Si corresponde' : '')}</span>
                </span>
                <YesNo value={v.chk[k.codigo]} label={l} na={na} onChange={(val) => up({ chk: { ...v.chk, [k.codigo]: val } })} />
              </div>
            );
          })}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '18px 24px 0', fontSize: 13 }}>
            <span className="muted">{fdeAns} de {FDE.length} respondidos</span>
            <span style={{ fontWeight: 600, color: nInc ? RED : INK }}>{fdeAns === 0 ? '' : nInc === 0 ? 'Sin incumplimientos' : nInc + (nInc === 1 ? ' incumplimiento' : ' incumplimientos')}</span>
          </div>
        </div>
      )}

      {st === 4 && (
        <div className="body" style={{ padding: '28px 0 16px' }}>
          <div style={{ padding: '0 24px 18px', borderBottom: '1px solid #E6E6E6' }}>
            <h2 className="h2">Digitalización</h2>
            <p className="muted" style={{ margin: '6px 0 0', fontSize: 14 }}>Uso de TUALI por el cliente.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 76, padding: '12px 16px 12px 24px', borderBottom: '1px solid #E6E6E6' }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>Tiene TUALI instalado</span>
              <span className="muted" style={{ display: 'block', fontSize: 12, marginTop: 3 }}>App en el celular del cliente</span>
            </span>
            <YesNo value={v.inst} label="Tiene TUALI instalado" onChange={(val) => up({ inst: val, ped: val === 'no' ? null : v.ped })} />
          </div>
          {v.inst === 'si' && (
            <div className="anim" style={{ padding: '18px 24px 20px', borderBottom: '1px solid #E6E6E6' }}>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>Hace pedidos por TUALI</span>
              <div role="radiogroup" aria-label="Hace pedidos por TUALI" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, marginTop: 12 }}>
                {[['auto', 'Sí, autónomo'], ['asist', 'Sí, asistido'], ['no', 'No']].map(([k, l]) => (
                  <button key={k} type="button" role="radio" aria-checked={v.ped === k} onClick={() => up({ ped: k })}
                    style={{ height: 52, padding: '0 6px', borderRadius: 10, fontSize: 13, fontWeight: 600, lineHeight: 1.2, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', ...segStyle(v.ped === k, k === 'no') }}>{l}</button>
                ))}
              </div>
            </div>
          )}
          {v.inst === 'no' && <p className="muted anim" style={{ margin: 0, padding: '16px 24px 0', fontSize: 13, lineHeight: 1.45 }}>Se registra como cliente sin TUALI. Puedes ayudarlo a instalarla en la próxima visita.</p>}
        </div>
      )}

      {st === 5 && (
        <div className="body" style={{ padding: '28px 24px 16px' }}>
          <h2 className="h2">Evidencia</h2>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 14 }}>Adjunta las tres evidencias para continuar.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 22 }}>
            {[['fach', 'Fachada', 'Foto de la fachada'], ['rack', 'Rack', 'Foto del rack'], ['edf', 'EDF', 'Imagen de EDF']].map(([k, l, h]) => {
              const f = v.fotos[k];
              return (
                <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input ref={fileRefs[k]} type="file" accept="image/*" capture={k === 'edf' ? undefined : 'environment'} style={{ display: 'none' }} onChange={(e) => { shoot(k, e.target.files[0]); e.target.value = ''; }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 20 }}>
                    <span className="lbl" style={{ color: INK }}>{l}</span>
                    {f && <button type="button" className="ulink" style={{ height: 32 }} onClick={() => fileRefs[k].current.click()}>Repetir</button>}
                  </div>
                  {!f ? (
                    <button type="button" className="shot" onClick={() => fileRefs[k].current.click()} aria-label={'Tomar foto de ' + l.toLowerCase()}>
                      <Icon n="camera" s={26} /><span style={{ fontSize: 14, fontWeight: 600 }}>{h}</span>
                    </button>
                  ) : (
                    <div className="anim" style={{ height: 196, borderRadius: 14, position: 'relative', overflow: 'hidden', background: INK }}>
                      <img src={f.url} alt={'Foto de ' + l.toLowerCase() + ' de ' + c.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      <div style={{ position: 'absolute', left: 10, bottom: 10, padding: '7px 10px', borderRadius: 8, background: 'rgba(46, 46, 48, .82)', color: '#FFFFFF' }}>
                        <span style={{ display: 'block', fontSize: 12, fontWeight: 600 }}>{f.fecha}</span>
                        {v.ubic.lat != null && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, marginTop: 2, color: '#E6E6E6' }}><Icon n="check" s={12} w={2} />Ubicación registrada</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {st === 6 && (
        <div className="body" style={{ padding: '28px 0 16px' }}>
          <div style={{ padding: '0 24px 18px' }}><h2 className="h2">Cierre de visita</h2></div>
          <div style={{ borderTop: '1px solid #E6E6E6' }}>
            <div className="row"><OkDot /><span style={{ fontSize: 17, fontWeight: 600 }}>Visita efectiva</span></div>
            <div className="row">
              {nInc === 0
                ? <><OkDot /><span style={{ fontSize: 17, fontWeight: 600 }}>Ejecución: Conforme</span></>
                : <><OkDot red x /><span style={{ fontSize: 17, fontWeight: 600, color: RED }}>Ejecución: No conforme <span style={{ fontWeight: 400 }}>({nInc + (nInc === 1 ? ' incumplimiento' : ' incumplimientos')})</span></span></>}
            </div>
          </div>
          <div style={{ padding: '16px 24px 0', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
            {[
              ['Faltantes', faltantes.length ? faltantes.length + ' SKU' : 'Ninguno'],
              ['Pedido en TUALI', v.tuali ? 'Iniciado por el cliente' : faltantes.length ? 'No iniciado' : 'No requerido'],
              ['TUALI', digiTxt],
              ['Evidencia', nFotos + ' de 3 evidencias'],
              ['Ubicación', v.ubic.lat == null ? 'Sin GPS' : v.ubic.d == null ? 'Registrada' : dist(v.ubic.d) + (far ? ' · fuera de radio' : '')]
            ].map(([k, val]) => <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span className="muted">{k}</span><span style={{ fontWeight: 600, textAlign: 'right' }}>{val}</span></div>)}
          </div>
          <div style={{ padding: '28px 24px 0' }}>
            <div className="lbl">Incidencias · opcional</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {INC.map((i) => {
                const on = !!v.inc[i.descripcion];
                return <button key={i.codigo} type="button" className="chip" aria-pressed={on} onClick={() => up({ inc: { ...v.inc, [i.descripcion]: !on } })}
                  style={on ? { background: INK, color: '#FFFFFF', border: '1px solid ' + INK } : { background: '#FFFFFF', color: INK, border: '1px solid #E6E6E6' }}>{i.descripcion}</button>;
              })}
            </div>
          </div>
          {err && <p className="err" style={{ padding: '0 24px' }}>{err}</p>}
        </div>
      )}

      <div className="foot">
        {(st > 1 || v.noefMode) && (
          <button type="button" className="btnS" style={{ width: 112, flex: 'none' }} onClick={() => (v.noefMode ? up({ noefMode: false, motivo: null }) : up({ step: st - 1 }))}>{v.noefMode ? 'Cancelar' : 'Atrás'}</button>
        )}
        <MainBtn can={can} busy={busy || v.ubic.st === 'loading'} onClick={act}>{busy && st === 6 ? 'Guardando' : label}</MainBtn>
      </div>
    </div>
  );
}
