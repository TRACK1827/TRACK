import { useEffect, useState } from 'react';
import { rpc } from '../lib/supabase.js';
import { iso, period, corta, corteTxt, fmtN, signed } from '../lib/fmt.js';

const RED = '#AC1622';

function spark(vals) {
  const w = 96, h = 30, p = 3;
  const mn = Math.min(...vals), mx = Math.max(...vals), sp = mx - mn || 1;
  const pts = vals.map((v, i) => [+(p + (i * (w - 2 * p)) / (vals.length - 1)).toFixed(1), +(h - p - ((v - mn) / sp) * (h - 2 * p)).toFixed(1)]);
  return { pts: pts.map((q) => q.join(',')).join(' '), last: pts[pts.length - 1] };
}

export default function Desempeno({ perfil, now, D }) {
  const [weeks, setWeeks] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    const ps = Array.from({ length: 8 }, (_, k) => period('semana', 7 - k, now));
    Promise.all(ps.map((p) => rpc('dashboard_rutas', { p_desde: iso(p.from), p_hasta: iso(p.to) })))
      .then((rs) => { if (alive) setWeeks(rs.map((r) => r.find((x) => x.ruta === perfil.ruta_codigo) || {})); })
      .catch((e) => alive && setErr(e.message));
    return () => { alive = false; };
  }, [perfil.ruta_codigo]);

  const pc = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
  let kpis = [];
  if (weeks) {
    const ej = weeks.map((w) => pc(w.fde_ok || 0, w.efectivas || 0));
    const vo = weeks.map((w) => pc(Number(w.avance) || 0, Number(w.cuota_esperada) || 0));
    const ef = weeks.map((w) => pc(w.efectivas || 0, w.plan || 0));
    const c = weeks[7];
    kpis = [
      { name: 'Ejecución', desc: 'Cumplimiento de FDE básica', t: ej, foot: (c.fde_ok || 0) + ' de ' + (c.efectivas || 0) + ' visitas con ejecución conforme' },
      { name: 'Volumen', desc: 'Cumplimiento de cuota de la cartera', t: vo, foot: fmtN(c.avance) + ' de ' + fmtN(c.cuota_total) + ' CU del mes · actualizado al ' + corteTxt(D.corte) },
      { name: 'Efectividad de visita', desc: 'Visitas efectivas sobre el plan', t: ef, foot: (c.efectivas || 0) + ' de ' + (c.plan || 0) + ' visitas efectivas sobre el plan a la fecha' }
    ];
  }

  return (
    <div className="body scr in">
      <div style={{ padding: '16px 16px 8px', borderBottom: '1px solid #E6E6E6' }}>
        <div className="hero" style={{ padding: '20px 22px', borderRadius: 20 }}>
          <div className="lbl">Incubadoras</div>
          <h1 style={{ margin: '10px 0 0', fontSize: 26, fontWeight: 700, letterSpacing: '-.02em' }}>Desempeño</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
            <div className="accent" /><span className="muted" style={{ fontSize: 13 }}>Semana en curso · al {corta(now)}</span>
          </div>
        </div>
        <div style={{ height: 8 }} />
      </div>
      {!weeks && !err && <div className="loading" style={{ padding: 40 }}><span className="spin" />Calculando</div>}
      {err && <p className="err" style={{ padding: '0 24px' }}>{err}</p>}
      {kpis.map((k, i) => {
        const s = spark(k.t);
        const v = k.t[7], d = v - k.t[6];
        return (
          <div key={k.name} style={{ padding: 24, borderBottom: '1px solid #E6E6E6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#8C8C8C' }}>{'0' + (i + 1)}</span>
              <span className="lbl" style={{ color: '#2E2E30' }}>{k.name}</span>
            </div>
            <p className="muted" style={{ margin: '6px 0 0', fontSize: 14 }}>{k.desc}</p>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 18, gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span className="big" style={{ fontSize: 48, color: RED }}>{v}</span><span style={{ fontSize: 15, fontWeight: 600 }}>%</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <svg width="96" height="30" viewBox="0 0 96 30" fill="none" role="img" aria-label="Tendencia de 8 semanas">
                  <polyline points={s.pts} stroke="#8C8C8C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  <circle cx={s.last[0]} cy={s.last[1]} r="2.5" fill="#2E2E30" />
                </svg>
                <span className="muted" style={{ fontSize: 12 }}>{signed(d)} pts vs. sem. ant.</span>
              </div>
            </div>
            <p style={{ margin: '14px 0 0', fontSize: 12, color: '#6B6B6B' }}>{k.foot}</p>
          </div>
        );
      })}
      {weeks && <p style={{ margin: 0, padding: '18px 24px 28px', fontSize: 12, color: '#6B6B6B' }}>Tendencia: últimas 8 semanas.</p>}
    </div>
  );
}
