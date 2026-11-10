import { useEffect, useState } from 'react';
import { rpc } from '../lib/supabase.js';
import { iso, fmtN, corteTxt, plural } from '../lib/fmt.js';

const RED = '#AC1622', INK = '#2E2E30';
const G = '104px minmax(150px, 1.3fr) minmax(120px, 1fr) 104px 136px 72px 104px 104px 80px 116px';

export default function Dashboard({ ctx }) {
  const { P, f, filtRutas, enFiltro, set, setView } = ctx;
  const [data, setData] = useState(null);
  const [mot, setMot] = useState([]);
  const [corte, setCorte] = useState(null);
  const [err, setErr] = useState('');
  const today = new Date();
  const hasta = P.to > today ? today : P.to;
  const key = iso(P.from) + iso(hasta) + filtRutas.join(',');

  useEffect(() => {
    let alive = true;
    setErr('');
    Promise.all([
      rpc('dashboard_rutas', { p_desde: iso(P.from), p_hasta: iso(hasta) }),
      rpc('dashboard_motivos', { p_desde: iso(P.from), p_hasta: iso(hasta), p_rutas: filtRutas }),
      rpc('corte_volumen')
    ]).then(([d, m, c]) => { if (alive) { setData(d); setMot(m); setCorte(c); } })
      .catch((e) => alive && setErr(e.message));
    return () => { alive = false; };
  }, [key]);

  if (err) return <p className="err" style={{ marginTop: 24 }}>{err}</p>;
  if (!data) return <div className="loading"><span className="spin" />Calculando indicadores</div>;

  const cur = f.back === 0, hoy = f.periodo === 'dia' && cur;
  const M = data.filter((r) => enFiltro(r.ruta)).map((r) => ({ ...r, cuota_total: +r.cuota_total, cuota_esperada: +r.cuota_esperada, avance: +r.avance }))
    .map((r) => ({ ...r, effP: r.plan ? Math.round((r.efectivas / r.plan) * 100) : 0, fdeP: r.efectivas ? Math.round((r.fde_ok / r.efectivas) * 100) : 0, volP: r.cuota_esperada ? Math.round((r.avance / r.cuota_esperada) * 100) : 0 }))
    .sort((a, b) => b.effP - a.effP);
  const sum = (k) => M.reduce((s, m) => s + (+m[k] || 0), 0);
  const sEf = sum('efectivas'), sPlan = sum('plan'), sFde = sum('fde_ok'), sEv = sum('evaluadas'), sAct = sum('activadas');
  const sCu = sum('cuota_total'), sEsp = sum('cuota_esperada'), sAv = sum('avance');
  const pc = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const w = (x) => Math.max(0, Math.min(100, x)) + '%';
  const effP = pc(sEf, sPlan), fdeP = pc(sFde, sEf), volP = pc(sAv, sEsp);
  const kpis = [
    { l: 'Efectividad de visita', v: effP, u: '%', bar: effP, s: fmtN(sEf) + ' de ' + fmtN(sPlan) + ' visitas del plan', s2: hoy ? 'Jornada en curso' : cur ? 'A la fecha' : 'Periodo cerrado' },
    { l: 'Ejecución FDE', v: fdeP, u: '%', bar: fdeP, s: 'Foto de Éxito conforme', s2: 'Sobre visitas efectivas' },
    { l: 'Volumen vs cuota', v: volP, u: '%', bar: volP, s: 'Cuota ' + fmtN(sCu) + ' CU', s2: cur ? 'Actualizado al ' + corteTxt(corte) : 'Cierre del periodo' },
    { l: 'Clientes activados', v: fmtN(sAct), u: '', bar: pc(sAct, sEv), s: 'De ' + fmtN(sEv) + ' evaluados · ' + fmtN(sEv - sAct) + ' no aptos', s2: 'Propuestas de Comercial' }
  ];
  const noef = sum('no_efectivas'), tr = sum('tuali_resp');
  const top = mot[0];

  return (
    <div className="scr">
      <div style={{ marginTop: 24, background: INK, color: '#FFFFFF', borderRadius: 18, padding: '24px 28px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px 32px' }}>
        {kpis.map((k) => (
          <div key={k.l} style={{ minWidth: 0 }}>
            <div className="lbl" style={{ color: '#B4B4B8' }}>{k.l}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 14 }}>
              <span className="big" style={{ fontSize: 44 }}>{k.v}</span><span style={{ fontSize: 20, fontWeight: 700 }}>{k.u}</span>
            </div>
            <div style={{ height: 4, background: '#4A4A4D', borderRadius: 2, marginTop: 14, overflow: 'hidden' }}><div style={{ height: 4, background: RED, borderRadius: 2, width: w(k.bar) }} /></div>
            <div style={{ fontSize: 13, color: '#E6E6E6', marginTop: 10 }}>{k.s}</div>
            <div style={{ fontSize: 12, color: '#B4B4B8', marginTop: 3 }}>{k.s2}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginTop: 16 }}>
        <div className="box" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div className="lbl">Fotos por revisar</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}><span className="big" style={{ fontSize: 28, color: RED }}>{fmtN(sum('fotos_pend'))}</span><span className="muted" style={{ fontSize: 13 }}>visitas</span></div>
          </div>
          <button type="button" className="btnS" onClick={() => setView('fotos')}>Revisar</button>
        </div>
        <div className="box" style={{ padding: '18px 20px' }}>
          <div className="lbl">No efectivas · motivo principal</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}><span className="big" style={{ fontSize: 28 }}>{fmtN(noef)}</span><span className="muted" style={{ fontSize: 13 }}>{top ? top.motivo + ' (' + fmtN(top.n) + ')' : 'Sin registros'}</span></div>
        </div>
        <div className="box" style={{ padding: '18px 20px' }}>
          <div className="lbl">Digitalización TUALI</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}><span className="big" style={{ fontSize: 28 }}>{pc(sum('tuali_inst'), tr)}%</span><span className="muted" style={{ fontSize: 13 }}>con TUALI · {pc(sum('tuali_auto'), tr)}% pide solo</span></div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'baseline', margin: '32px 0 12px' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Desempeño por ruta</h2>
        <span style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span className="muted" style={{ fontSize: 13 }}>{plural(M.length, 'ruta', 'rutas')} · {cur ? 'volumen actualizado al ' + corteTxt(corte) : 'volumen al cierre del periodo'}</span>
          <button type="button" className="qbtn" onClick={() => setView('desc')}>Descargar bases</button>
        </span>
      </div>
      <div className="box" style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 1100 }}>
          <div className="gr gh" style={{ gridTemplateColumns: G }}><div>Ruta</div><div>Desarrollador</div><div>Sala de ventas</div><div className="num">Visitas</div><div className="num">Efectividad</div><div className="num">FDE</div><div className="num">Volumen</div><div className="num">Activados</div><div className="num">Fotos</div><div /></div>
          {M.map((m, ix) => {
            const low = m.effP < 85 && !hoy;
            return (
              <div key={m.ruta} className="gr" style={{ gridTemplateColumns: G, background: ix % 2 ? '#FAFAFA' : '#FFFFFF' }}>
                <div style={{ fontWeight: 700 }}>{m.ruta}</div>
                <div>{m.persona || <span className="muted">Sin asignar</span>}</div>
                <div className="muted">{m.sala}</div>
                <div className="num">{fmtN(m.efectivas)}<span className="muted" style={{ marginLeft: 4 }}>de {fmtN(m.plan)}</span></div>
                <div className="num"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><span style={{ width: 56, height: 4, background: '#E6E6E6', borderRadius: 2, overflow: 'hidden', display: 'inline-block' }}><span style={{ display: 'block', height: 4, borderRadius: 2, width: w(m.effP), background: low ? RED : INK }} /></span><span style={{ fontWeight: 600, color: low ? RED : INK }}>{m.effP}%</span></span></div>
                <div className="num" style={m.fdeP < 80 && m.efectivas ? { color: RED, fontWeight: 700 } : undefined}>{m.fdeP}%</div>
                <div className="num" style={m.volP < 90 && m.cuota_esperada ? { color: RED, fontWeight: 700 } : undefined}>{m.cuota_esperada ? m.volP + '%' : '—'}</div>
                <div className="num">{m.activadas}<span className="muted" style={{ marginLeft: 4 }}>de {m.evaluadas}</span></div>
                <div className="num" style={m.fotos_pend ? { color: RED, fontWeight: 700 } : { color: '#8C8C8C' }}>{m.fotos_pend}</div>
                <div style={{ textAlign: 'right' }}><button type="button" className="qbtn" onClick={() => { set({ ruta: m.ruta, region: m.region, sala: m.sala }); setView('fotos'); }}>Ver fotos</button></div>
              </div>
            );
          })}
          {M.length === 0 && <div className="empty">No hay rutas con estos filtros.</div>}
        </div>
      </div>
      <p className="muted" style={{ fontSize: 12, margin: '10px 0 0' }}>{hoy ? 'Hoy la efectividad es parcial: la jornada está en curso. ' : 'En rojo: efectividad bajo 85 %, '}{hoy ? 'En rojo: ejecución bajo 80 % o volumen bajo 90 % de la cuota a la fecha.' : 'ejecución bajo 80 % o volumen bajo 90 % de la cuota a la fecha.'}</p>
    </div>
  );
}
