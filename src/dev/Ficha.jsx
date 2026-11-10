import { useState } from 'react';
import { sb, q, msg } from '../lib/supabase.js';
import { MES, corta, corteTxt, telFmt, parseIso, hora } from '../lib/fmt.js';
import Icon from '../Icon.jsx';
import { Back, RadioList } from './ui.jsx';
import { alertas } from './data.js';
import { registrarNoEf } from './Visita.jsx';

const RED = '#AC1622';

export default function Ficha({ c, D, nav, go, say, now }) {
  const [ct, setCt] = useState(null);       // edición del responsable
  const [saving, setSaving] = useState(false);
  const [sheet, setSheet] = useState(false); // hoja de "no efectiva"
  const [mot, setMot] = useState(null);
  const [busy, setBusy] = useState(false);

  const cuota = D.cuotaBy[c.codigo] || 0, av = D.avBy[c.codigo] || 0;
  let frac = 0;
  if (D.corte) { const cd = parseIso(D.corte); if (cd.getMonth() === now.getMonth() && cd.getFullYear() === now.getFullYear()) frac = cd.getDate() / new Date(cd.getFullYear(), cd.getMonth() + 1, 0).getDate(); }
  const pctF = cuota && frac ? Math.round((av / (cuota * frac)) * 100) : 0;
  const ing = c.fecha_ingreso ? parseIso(c.fecha_ingreso) : null;
  const mes = ing ? Math.min(6, Math.max(1, (now.getFullYear() - ing.getFullYear()) * 12 + now.getMonth() - ing.getMonth() + 1)) : null;
  const al = alertas(c, D, now);
  const hoyV = (D.visitasHoy || []).filter((v) => v.cliente_codigo === c.codigo);
  const efHoy = hoyV.some((v) => v.efectiva);
  const noefHoy = !efHoy && hoyV.length > 0;
  const u = D.ultBy[c.codigo];
  const ult = efHoy ? 'Hoy · Efectiva' : noefHoy ? 'Hoy · No efectiva' : u ? corta(parseIso(u)) + ' · Efectiva' : 'Sin visitas registradas';
  const ctOk = ct && /^9\d{8}$/.test(ct.t) && ct.n.trim();
  const backLbl = nav.from === 'cartera' ? 'Cartera' : 'Plan de visita';
  const editado = c.actualizado_en ? 'Actualizado el ' + corta(new Date(c.actualizado_en)) + ' · ' + hora(new Date(c.actualizado_en)) : '';

  async function guardarCt() {
    if (!ctOk) return;
    setSaving(true);
    try {
      const row = await q(sb.from('clientes').update({ responsable: ct.n.trim(), telefono: ct.t }).eq('codigo', c.codigo).select().single());
      D.patch((s) => ({ clientes: s.clientes.map((x) => (x.codigo === c.codigo ? row : x)) }));
      setCt(null); say('Contacto actualizado · ' + c.nombre);
    } catch (e) { say(msg(e), true); }
    setSaving(false);
  }

  async function noEf() {
    if (!mot) return;
    setBusy(true);
    try {
      await registrarNoEf(c, mot, D);
      go({ screen: 'tabs', tab: 'hoy', plan: 'noef' }); say('No efectiva · ' + c.nombre);
    } catch (e) { say(msg(e), true); }
    setBusy(false);
  }

  return (
    <div className="scr">
      <div style={{ padding: '20px 12px 0' }}><Back onClick={() => go({ screen: 'tabs', tab: nav.from || 'hoy' })}>{backLbl}</Back></div>
      <div className="body">
        <div style={{ padding: '8px 16px 16px' }}>
          <div className="hero" style={{ padding: '22px 22px 20px', borderRadius: 20 }}>
            <div className="lbl">Cliente · {c.distrito || c.sala || ''}</div>
            <h1 style={{ margin: '10px 0 0', fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.15 }}>{c.nombre}</h1>
            <p className="muted" style={{ margin: '6px 0 0', fontSize: 14 }}>Cód. {c.codigo}{c.direccion ? ' · ' + c.direccion : ''}</p>
            {mes && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20, paddingTop: 16, borderTop: '1px solid #47474A' }}>
                <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>Mes {mes} de 6</span>
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 4 }}>
                  {[1, 2, 3, 4, 5, 6].map((k) => <span key={k} style={{ height: 4, borderRadius: 2, background: k < mes ? '#FFFFFF' : k === mes ? RED : '#4A4A4D' }} />)}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '20px 24px 22px', borderTop: '1px solid #E6E6E6', borderBottom: '1px solid #E6E6E6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <span className="lbl">Cuota · {MES[now.getMonth()]}</span>
            <span className="lbl">Actualizado al {corteTxt(D.corte)}</span>
          </div>
          {cuota ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span className="big" style={{ fontSize: 40 }}>{Math.round(av)}</span>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>de {Math.round(cuota)} CU</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <span className="big" style={{ fontSize: 32, color: RED }}>{pctF}</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: RED, marginLeft: 1 }}>%</span>
                </div>
              </div>
              <div style={{ position: 'relative', height: 4, background: '#E6E6E6', borderRadius: 2, marginTop: 16 }}>
                <div style={{ height: 4, background: RED, borderRadius: 2, width: Math.min(100, (av / cuota) * 100).toFixed(1) + '%' }} />
                {frac > 0 && <span style={{ position: 'absolute', top: -4, width: 2, height: 12, background: '#2E2E30', borderRadius: 1, left: (frac * 100).toFixed(1) + '%' }} />}
              </div>
              <p className="muted" style={{ margin: '10px 0 0', fontSize: 13 }}>Faltan {Math.max(0, Math.round(cuota - av))} CU para cumplir la cuota del mes</p>
            </>
          ) : <p className="muted" style={{ margin: '12px 0 0', fontSize: 14 }}>Sin cuota cargada para este mes.</p>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 14px 24px', borderBottom: '1px solid #E6E6E6' }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="muted" style={{ display: 'block', fontSize: 14 }}>Dirección</span>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 600, marginTop: 3 }}>{[c.direccion, c.distrito].filter(Boolean).join(' · ') || '—'}</span>
          </span>
          <button type="button" onClick={() => go({ screen: 'map', map: { tipo: 'cli', id: c.codigo, back: { screen: 'det' }, backLbl: 'Ficha' } })} style={{ height: 44, padding: '0 4px 0 12px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, flex: 'none' }}>
            <Icon n="pin" s={18} />Ver mapa
          </button>
        </div>

        {!ct ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '14px 8px 14px 24px', borderBottom: '1px solid #E6E6E6' }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="muted" style={{ display: 'block', fontSize: 14 }}>Responsable del negocio</span>
              <span className="ellip" style={{ display: 'block', fontSize: 14, fontWeight: 600, marginTop: 3 }}>{c.responsable || '—'}</span>
              <span className="tab" style={{ display: 'block', fontSize: 14, marginTop: 2 }}>{telFmt(c.telefono)}</span>
              {editado && <span className="muted" style={{ display: 'block', fontSize: 12, marginTop: 3 }}>{editado}</span>}
            </span>
            <button type="button" onClick={() => setCt({ n: c.responsable || '', t: c.telefono || '' })} style={{ height: 44, padding: '0 10px', fontSize: 14, fontWeight: 600, flex: 'none' }}>Editar</button>
            {c.telefono && (
              <a href={'tel:+51' + c.telefono} style={{ height: 44, padding: '0 8px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, flex: 'none', color: '#2E2E30', textDecoration: 'none' }}>
                <Icon n="phone" s={18} />Llamar
              </a>
            )}
          </div>
        ) : (
          <div className="anim" style={{ padding: '16px 24px 18px', borderBottom: '1px solid #E6E6E6', background: '#F7F7F8' }}>
            <div className="lbl" style={{ color: '#2E2E30' }}>Editar responsable del negocio</div>
            <label className="fld" style={{ marginTop: 12 }}>Nombre
              <input className="inp" value={ct.n} onChange={(e) => setCt({ ...ct, n: e.target.value })} />
            </label>
            <label className="fld" style={{ marginTop: 12 }}>Teléfono
              <input className="inp" type="tel" inputMode="numeric" maxLength={9} value={ct.t} onChange={(e) => setCt({ ...ct, t: e.target.value.replace(/\D/g, '') })} />
            </label>
            {ct.t.length > 0 && !/^9\d{8}$/.test(ct.t) && <p className="err" style={{ fontSize: 12 }}>El teléfono debe tener 9 dígitos y empezar con 9.</p>}
            <p className="muted" style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.45 }}>El cambio se guarda en la ficha y el administrador lo ve en el portal.</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button type="button" className="btnS" onClick={() => setCt(null)} style={{ flex: 1, height: 44 }}>Cancelar</button>
              <button type="button" className="btnP" disabled={!ctOk || saving} onClick={guardarCt} style={{ height: 44 }}>{saving && <span className="spin" />}Guardar</button>
            </div>
          </div>
        )}

        <div className="row" style={{ minHeight: 60 }}>
          <span className="muted" style={{ flex: 1, fontSize: 14 }}>Última visita</span>
          <span style={{ fontSize: 14, fontWeight: 600, textAlign: 'right' }}>{ult}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '18px 24px', borderBottom: '1px solid #E6E6E6' }}>
          <span className="muted" style={{ flex: 1, fontSize: 14 }}>Alertas</span>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            {al.map((t) => <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, fontWeight: 600, color: RED }}><Icon n="info" s={14} w={1.75} />{t}</span>)}
            {al.length === 0 && <span style={{ fontSize: 14, color: '#6B6B6B' }}>Sin alertas</span>}
          </span>
        </div>
      </div>
      <div className="foot">
        {!efHoy ? (
          <>
            <button type="button" className="btnS" onClick={() => { setSheet(true); setMot(null); }} style={{ width: 128, flex: 'none' }}>No efectiva</button>
            <button type="button" className="btnP" onClick={() => go({ screen: 'vis', cid: c.codigo, visFrom: 'det' })}>{noefHoy ? 'Reintentar visita' : 'Iniciar visita'}</button>
          </>
        ) : (
          <button type="button" className="btnP" disabled>Visita efectiva hoy</button>
        )}
      </div>

      {sheet && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <button type="button" aria-label="Cerrar" className="sheet-bg" onClick={() => setSheet(false)} />
          <div role="dialog" aria-label="Visita no efectiva" className="sheet">
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E6E6E6', margin: '0 auto 18px' }} />
            <div className="lbl">{c.nombre}</div>
            <h2 style={{ margin: '8px 0 0', fontSize: 22, fontWeight: 700, letterSpacing: '-.02em' }}>Visita no efectiva</h2>
            <p className="muted" style={{ margin: '4px 0 14px', fontSize: 14 }}>Elige el motivo. El cliente queda para reintentar.</p>
            <RadioList items={(D.cat.MOT || []).map((m) => m.descripcion)} value={mot} onPick={setMot} />
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button type="button" className="btnS" onClick={() => setSheet(false)} style={{ width: 112, flex: 'none' }}>Cancelar</button>
              <button type="button" className="btnP" disabled={!mot || busy} onClick={noEf}>{busy && <span className="spin" />}Registrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
