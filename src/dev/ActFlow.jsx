import { forwardRef, useEffect, useRef, useState } from 'react';
import { sb, q, rpc, upload, msg } from '../lib/supabase.js';
import { hora, telFmt } from '../lib/fmt.js';
import { rid } from '../lib/device.js';
import Icon from '../Icon.jsx';
import { YesNo, RadioList, Steps, FlowHead, Check, MainBtn, segStyle } from './ui.jsx';

const RED = '#AC1622', INK = '#2E2E30';
const EV_SUB = { ESP: 'Cerca de la zona de atención', FLU: 'Tránsito en la zona', INT: 'Acepta participar', CEL: 'Para pedir por TUALI' };
const EV_CRIT = { ESP: 'Sin espacio para rack', INT: 'Cliente no interesado' };
const COMP = [
  'Acepta el capital de trabajo del programa Incubadoras.',
  'Se compromete a invertirlo en productos de marcas de Coca-Cola, comprando a su asesor comercial asignado.',
  'Se compromete a reinvertir el capital para reponer el portafolio sugerido a medida que rota.'
];

export default function ActFlow({ p, D, go, say }) {
  const [a, setA] = useState({ step: 1, ev: {}, pot: null, noMode: false, mot: null, noefMode: false, noefMot: null, comp: {}, firma: null, tcode: '', tarjeta: null, tErr: '', entregada: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const up = (x) => setA((s) => ({ ...s, ...x }));
  const pad = useRef(null);

  const EV = D.cat.EV || [], NOAPTO = (D.cat.NOAPTO || []).map((m) => m.descripcion), MOT = (D.cat.MOT || []).map((m) => m.descripcion);
  const evAns = EV.filter((e) => a.ev[e.codigo]).length;
  const fails = EV.filter((e) => EV_CRIT[e.codigo] && a.ev[e.codigo] === 'no');
  const auto = {}; fails.forEach((e) => { auto[EV_CRIT[e.codigo]] = true; }); if (a.pot === 'bajo') auto['Potencial bajo'] = true;
  const selMot = a.mot || auto;
  const nMot = NOAPTO.filter((m) => selMot[m]).length;
  const showMot = fails.length > 0 || a.pot === 'bajo' || a.noMode;
  const compOk = COMP.every((_, k) => a.comp[k]);
  const ast = a.step;
  const exit = () => go({ screen: 'tabs', tab: 'act' });

  async function cerrar(estado, extra) {
    setBusy(true); setErr('');
    try {
      let firma = null;
      if (estado === 'act') firma = await upload(`firmas/${p.ruta_codigo}/${p.codigo_cliente}_${rid()}.png`, a.firma.blob, 'image/png');
      await rpc('cerrar_propuesta', { p_id: p.id, p_estado: estado, p_evaluacion: { ...a.ev }, p_potencial: a.pot, p_firma: firma, p_tarjeta: a.tarjeta?.codigo || null, ...extra });
      const fresh = await q(sb.from('propuestas').select('*').eq('id', p.id).single());
      D.patch((s) => ({ props: s.props.map((x) => (x.id === p.id ? fresh : x)) }));
      if (estado === 'act') D.reload();
      go({ screen: 'tabs', tab: 'act', actF: estado === 'noef' ? 'pend' : estado });
      say(({ act: 'Cliente activado · ', noapto: 'No apto · ', noef: 'No efectiva · ' })[estado] + p.nombre);
    } catch (e) { setErr(msg(e)); }
    setBusy(false);
  }

  async function validarTarjeta() {
    const code = a.tcode.trim().toUpperCase();
    if (!code) return;
    up({ tErr: '' });
    try {
      const t = await q(sb.from('tarjetas').select('codigo, estado, ruta_codigo').ilike('codigo', code).maybeSingle());
      if (!t) up({ tErr: 'No encontramos esa tarjeta en tu ruta. Revisa el código.' });
      else if (t.estado === 'Entregada' || t.estado === 'Anulada') up({ tErr: 'Esa tarjeta ya fue ' + (t.estado === 'Entregada' ? 'entregada' : 'anulada') + '.' });
      else up({ tarjeta: t, tErr: '' });
    } catch (e) { up({ tErr: msg(e) }); }
  }

  async function guardarFirma() {
    const c = pad.current;
    const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
    up({ firma: { blob, url: URL.createObjectURL(blob), hora: hora(new Date()) }, step: 3 });
  }

  let can, lbl, act;
  if (ast === 1) {
    can = evAns === EV.length && !!a.pot;
    if (a.noefMode) { can = !!a.noefMot; lbl = 'Registrar no efectiva'; act = () => cerrar('noef', { p_noef_motivo: a.noefMot }); }
    else if (showMot) { can = nMot > 0 && evAns === EV.length && !!a.pot; lbl = 'Registrar no apto'; act = () => cerrar('noapto', { p_motivos: NOAPTO.filter((m) => selMot[m]).join(' · ') }); }
    else { lbl = 'Continuar'; act = () => up({ step: 2 }); }
  } else if (ast === 2) { can = compOk && (a.firma || a.signed); lbl = 'Continuar'; act = () => (a.firma ? up({ step: 3 }) : guardarFirma()); }
  else { can = !!a.tarjeta && a.entregada; lbl = 'Activar cliente'; act = () => cerrar('act', {}); }

  return (
    <div className="scr">
      <FlowHead label={'Paso ' + ast + ' de 3 · ' + ['Evaluación', 'Compromiso', 'Tarjeta'][ast - 1]} sub={p.nombre + ' · ' + p.codigo_cliente} onExit={exit} exitLabel="Salir de la activación" />
      <Steps n={3} cur={ast} />

      {ast === 1 && (
        <div className="body" style={{ padding: '28px 0 16px' }}>
          <div style={{ padding: '0 24px 18px', borderBottom: '1px solid #E6E6E6' }}>
            <h2 className="h2">Evaluación del cliente</h2>
            <p className="muted" style={{ margin: '6px 0 0', fontSize: 14 }}>{[p.direccion, p.distrito].filter(Boolean).join(' · ')}</p>
            <p style={{ margin: '4px 0 0', fontSize: 14 }}>Responsable: {p.responsable || '—'}{p.telefono && <> · <a href={'tel:+51' + p.telefono} style={{ fontWeight: 600 }}>{telFmt(p.telefono)}</a></>}</p>
            <button type="button" onClick={() => go({ screen: 'map', map: { tipo: 'prop', id: p.id, back: { screen: 'actf', pid: p.id }, backLbl: 'Evaluación' } })} style={{ height: 40, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600 }}><Icon n="pin" s={18} />Ver mapa</button>
          </div>
          {a.noefMode ? (
            <div className="anim" style={{ padding: '20px 24px 0' }}>
              <span className="lbl" style={{ color: RED }}>Visita no efectiva</span>
              <p className="muted" style={{ margin: '6px 0 10px', fontSize: 13 }}>Elige el motivo. La propuesta queda para reintentar.</p>
              <RadioList items={MOT} value={a.noefMot} onPick={(m) => up({ noefMot: m })} />
            </div>
          ) : (
            <>
              {EV.map((e) => (
                <div key={e.codigo} className="row" style={{ minHeight: 72 }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>{e.descripcion}</span>
                    <span className="muted" style={{ display: 'block', fontSize: 12, marginTop: 3 }}>{EV_SUB[e.codigo] || ''}</span>
                  </span>
                  <YesNo value={a.ev[e.codigo]} label={e.descripcion} onChange={(val) => up({ ev: { ...a.ev, [e.codigo]: val } })} />
                </div>
              ))}
              <div style={{ padding: '18px 24px 0' }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>Potencial del cliente</span>
                <div role="radiogroup" aria-label="Potencial del cliente" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, marginTop: 12 }}>
                  {[['alto', 'Alto'], ['medio', 'Medio'], ['bajo', 'Bajo']].map(([k, l]) => (
                    <button key={k} type="button" role="radio" aria-checked={a.pot === k} onClick={() => up({ pot: k })}
                      style={{ height: 48, borderRadius: 10, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', ...segStyle(a.pot === k, k === 'bajo') }}>{l}</button>
                  ))}
                </div>
              </div>
              {showMot && (
                <div className="anim" style={{ margin: '22px 24px 0', paddingTop: 18, borderTop: '1px solid #E6E6E6' }}>
                  <span className="lbl" style={{ color: RED }}>Motivos de no apto</span>
                  <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>Marca uno o más.</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                    {NOAPTO.map((m) => {
                      const on = !!selMot[m];
                      return <button key={m} type="button" className="chip" role="checkbox" aria-checked={on} onClick={() => up({ mot: { ...selMot, [m]: !on } })}
                        style={on ? { background: RED, color: '#FFFFFF', border: '1px solid ' + RED } : { background: '#FFFFFF', color: INK, border: '1px solid #E6E6E6' }}>{m}</button>;
                    })}
                  </div>
                </div>
              )}
              <div style={{ padding: '14px 24px 0' }}>
                <button type="button" className="link" onClick={() => up(a.noMode ? { noMode: false, mot: null } : { noMode: true })}><Icon n="info" s={16} />{a.noMode ? 'Cancelar no apto' : 'Marcar como no apto'}</button>
              </div>
            </>
          )}
          <div style={{ padding: '0 24px' }}>
            <button type="button" className="link" onClick={() => up({ noefMode: !a.noefMode, noefMot: null })}><Icon n="close" s={16} />{a.noefMode ? 'Volver a la evaluación' : 'No se pudo realizar la visita'}</button>
          </div>
          {err && <p className="err" style={{ padding: '0 24px' }}>{err}</p>}
        </div>
      )}

      {ast === 2 && (
        <div className="body" style={{ padding: '28px 0 16px' }}>
          <div style={{ padding: '0 24px 18px', borderBottom: '1px solid #E6E6E6' }}>
            <h2 className="h2">Compromiso del cliente</h2>
            <p className="muted" style={{ margin: '6px 0 0', fontSize: 14 }}>Lee cada punto con el cliente y márcalo.</p>
          </div>
          {COMP.map((t, k) => (
            <button key={k} type="button" role="checkbox" aria-checked={!!a.comp[k]} onClick={() => up({ comp: { ...a.comp, [k]: !a.comp[k] } })}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 14, width: '100%', padding: '16px 24px', borderBottom: '1px solid #E6E6E6' }}>
              <span style={{ marginTop: 1 }}><Check on={!!a.comp[k]} /></span>
              <span style={{ fontSize: 14, lineHeight: 1.5 }}>{t}</span>
            </button>
          ))}
          <div style={{ padding: '20px 24px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 32 }}>
              <span className="lbl" style={{ color: INK }}>Firma del cliente</span>
              {(a.firma || a.signed) && <button type="button" className="ulink" onClick={() => { if (a.firma) URL.revokeObjectURL(a.firma.url); up({ firma: null, signed: false, padKey: (a.padKey || 0) + 1 }); }}>Borrar</button>}
            </div>
            {a.firma ? (
              <div style={{ marginTop: 10, height: 160, border: '1px solid #E6E6E6', borderRadius: 14, position: 'relative', overflow: 'hidden' }}>
                <img src={a.firma.url} alt="Firma registrada" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                <span style={{ position: 'absolute', left: 14, bottom: 10, fontSize: 11, color: '#6B6B6B' }}>Firmado · {a.firma.hora}</span>
              </div>
            ) : (
              <SignaturePad key={a.padKey || 0} ref={pad} onSign={() => up({ signed: true })} signed={a.signed} />
            )}
          </div>
        </div>
      )}

      {ast === 3 && (
        <div className="body" style={{ padding: '28px 24px 16px' }}>
          <h2 className="h2">Entrega de tarjeta</h2>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 14 }}>Vincula la tarjeta del programa al cliente.</p>
          {!a.tarjeta ? (
            <div style={{ marginTop: 24, padding: 20, border: '1px dashed #C9C9C9', borderRadius: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#6B6B6B' }}><Icon n="scan" s={22} /><span style={{ fontSize: 14, fontWeight: 600 }}>Código de la tarjeta</span></div>
              <input className="inp" value={a.tcode} onChange={(e) => up({ tcode: e.target.value.toUpperCase(), tErr: '' })} placeholder="INC-000126320" autoCapitalize="characters" style={{ marginTop: 12, fontVariantNumeric: 'tabular-nums', letterSpacing: '.04em' }} />
              {a.tErr && <p className="err">{a.tErr}</p>}
              <button type="button" className="btnS" style={{ width: '100%', marginTop: 12 }} disabled={!a.tcode.trim()} onClick={validarTarjeta}>Validar tarjeta</button>
            </div>
          ) : (
            <>
              <div className="anim" style={{ marginTop: 24, height: 200, borderRadius: 18, background: INK, color: '#FFFFFF', padding: '20px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
                <span style={{ position: 'absolute', right: -40, top: -40, width: 160, height: 160, borderRadius: 80, border: '1px solid #47474A' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span className="lbl" style={{ color: '#B4B4B8' }}>Programa Incubadoras</span>
                  <img src="/icon.png" alt="" style={{ width: 36, height: 36, borderRadius: 8 }} />
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '.1em', fontVariantNumeric: 'tabular-nums' }}>{a.tarjeta.codigo}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12, color: '#B4B4B8' }}>
                    <span className="ellip" style={{ maxWidth: 200 }}>{p.nombre}</span><span>Capital de trabajo</span>
                  </div>
                </div>
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, background: RED }} />
              </div>
              <button type="button" className="ulink" style={{ marginTop: 10, height: 32 }} onClick={() => up({ tarjeta: null, entregada: false })}>Cambiar tarjeta</button>
              <button type="button" role="checkbox" aria-checked={a.entregada} onClick={() => up({ entregada: !a.entregada })}
                style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', minHeight: 60, marginTop: 8, borderTop: '1px solid #E6E6E6', borderBottom: '1px solid #E6E6E6' }}>
                <Check on={a.entregada} /><span style={{ fontSize: 15, fontWeight: 600 }}>Tarjeta entregada al cliente</span>
              </button>
            </>
          )}
          {err && <p className="err">{err}</p>}
        </div>
      )}

      <div className="foot">
        {ast > 1 && <button type="button" className="btnS" style={{ width: 112, flex: 'none' }} onClick={() => up({ step: ast - 1 })}>Atrás</button>}
        <MainBtn can={can} busy={busy} onClick={act}>{lbl}</MainBtn>
      </div>
    </div>
  );
}

// Lienzo para firmar con el dedo
const SignaturePad = forwardRef(function SignaturePad({ onSign, signed }, ref) {
  const cv = useRef(null);
  useEffect(() => {
    const c = cv.current; if (ref) ref.current = c;
    const r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    c.width = r.width * dpr; c.height = r.height * dpr;
    const ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = INK;
    let drawing = false, last = null;
    const pt = (e) => { const b = c.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
    const down = (e) => { e.preventDefault(); c.setPointerCapture(e.pointerId); drawing = true; last = pt(e); };
    const move = (e) => { if (!drawing) return; e.preventDefault(); const p = pt(e); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; onSign(); };
    const upE = () => { drawing = false; };
    c.addEventListener('pointerdown', down); c.addEventListener('pointermove', move); c.addEventListener('pointerup', upE); c.addEventListener('pointercancel', upE);
    return () => { c.removeEventListener('pointerdown', down); c.removeEventListener('pointermove', move); c.removeEventListener('pointerup', upE); c.removeEventListener('pointercancel', upE); };
  }, []);
  return (
    <div style={{ marginTop: 10, height: 160, border: '1px dashed #C9C9C9', borderRadius: 14, position: 'relative', overflow: 'hidden' }}>
      <canvas ref={cv} aria-label="Área de firma" style={{ width: '100%', height: '100%', touchAction: 'none', display: 'block' }} />
      {!signed && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#8C8C8C', fontSize: 14, fontWeight: 600, pointerEvents: 'none' }}><Icon n="pen" s={20} />Firma aquí con el dedo</span>}
      <span style={{ position: 'absolute', left: 16, right: 16, bottom: 28, height: 1, background: '#E6E6E6', pointerEvents: 'none' }} />
    </div>
  );
});
