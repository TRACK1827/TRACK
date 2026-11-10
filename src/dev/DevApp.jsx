import { useEffect, useMemo, useRef, useState } from 'react';
import { sb, q } from '../lib/supabase.js';
import { larga, corta, hora, isoDow, telFmt, DIAS, plural, parseIso } from '../lib/fmt.js';
import { getPosition, meters } from '../lib/device.js';
import Icon from '../Icon.jsx';
import { HeroTabs } from './ui.jsx';
import { useRuta, alertas } from './data.js';
import Ficha from './Ficha.jsx';
import Visita from './Visita.jsx';
import ActFlow from './ActFlow.jsx';
import Mapa from './Mapa.jsx';
import Desempeno from './Desempeno.jsx';

const RED = '#AC1622';

export default function DevApp({ perfil, salir }) {
  const [programas, setProgramas] = useState([]);
  const [nav, setNav] = useState({ screen: 'menu', tab: 'hoy' });
  const [toast, setToast] = useState(null);
  const [pos, setPos] = useState(null);
  const tt = useRef();
  const D = useRuta(perfil);
  const go = (patch) => setNav((n) => ({ ...n, ...patch }));
  const say = (t, bad) => { setToast({ t, bad }); clearTimeout(tt.current); tt.current = setTimeout(() => setToast(null), 3400); };

  useEffect(() => {
    q(sb.from('programas').select('*').order('orden')).then(setProgramas).catch(() => {});
    getPosition(12000).then(setPos).catch(() => {});
    return () => clearTimeout(tt.current);
  }, []);

  const now = new Date();
  const clientes = D.clientes || [];
  const cliBy = useMemo(() => Object.fromEntries(clientes.map((c) => [c.codigo, c])), [clientes]);
  const propBy = useMemo(() => Object.fromEntries((D.props || []).map((p) => [p.id, p])), [D.props]);

  // ---------- Pantallas a pantalla completa
  if (nav.screen === 'menu') return <ShellBase toast={toast}><Menu perfil={perfil} programas={programas} now={now} go={go} salir={salir} /></ShellBase>;
  if (nav.screen === 'soon') return <ShellBase toast={toast}><Soon p={programas.find((x) => x.id === nav.soon)} go={go} /></ShellBase>;
  if (D.loading) return <ShellBase toast={toast}><div className="scr"><div className="loading"><span className="spin" />Cargando tu ruta</div></div></ShellBase>;
  if (D.error && !D.clientes) return <ShellBase toast={toast}><ErrorScr text={D.error} retry={D.reload} back={() => go({ screen: 'menu' })} /></ShellBase>;

  if (nav.screen === 'det' && cliBy[nav.cid]) return <ShellBase toast={toast}><Ficha c={cliBy[nav.cid]} D={D} nav={nav} go={go} say={say} now={now} /></ShellBase>;
  if (nav.screen === 'vis' && cliBy[nav.cid]) return <ShellBase toast={toast}><Visita c={cliBy[nav.cid]} D={D} perfil={perfil} nav={nav} go={go} say={say} /></ShellBase>;
  if (nav.screen === 'actf' && propBy[nav.pid]) return <ShellBase toast={toast}><ActFlow p={propBy[nav.pid]} D={D} perfil={perfil} go={go} say={say} /></ShellBase>;
  if (nav.screen === 'map') {
    const t = nav.map.tipo === 'cli' ? cliBy[nav.map.id] : propBy[nav.map.id];
    if (t) return <ShellBase toast={toast}><Mapa t={t} pos={pos} back={() => go(nav.map.back)} backLbl={nav.map.backLbl} /></ShellBase>;
  }

  // ---------- Pestañas de Incubadoras
  const tab = nav.tab;
  return (
    <ShellBase toast={toast}>
      <div className="scr" style={{ animation: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px 12px 8px', borderBottom: '1px solid #E6E6E6', flex: 'none' }}>
          <button type="button" className="back" onClick={() => go({ screen: 'menu' })} style={{ gap: 2 }}><Icon n="back" s={22} />Menú</button>
          <img src="/track-logo.png" alt="TRACK" style={{ height: 26 }} />
        </div>
        {tab === 'hoy' && <Plan D={D} cliBy={cliBy} pos={pos} now={now} nav={nav} go={go} />}
        {tab === 'cartera' && <Cartera D={D} nav={nav} go={go} now={now} />}
        {tab === 'act' && <ActList D={D} nav={nav} go={go} />}
        {tab === 'des' && <Desempeno perfil={perfil} now={now} D={D} />}
        <nav className="tabbar" aria-label="Incubadoras">
          {[['act', 'userPlus', 'Activación'], ['hoy', 'calendar', 'Plan'], ['cartera', 'users', 'Cartera'], ['des', 'chart', 'Desempeño']].map(([id, ic, l]) => (
            <button key={id} type="button" onClick={() => go({ tab: id })} aria-current={tab === id ? 'page' : undefined}
              style={tab === id ? { color: RED, fontWeight: 600 } : { color: '#8C8C8C', fontWeight: 400 }}>
              <span className="bar" style={{ background: tab === id ? RED : 'transparent' }} />
              <Icon n={ic} s={22} />{l}
            </button>
          ))}
        </nav>
      </div>
    </ShellBase>
  );

}

function ShellBase({ children, toast }) {
  return <div className="tk-shell"><div className="tk">{children}{toast && <Toast {...toast} />}</div></div>;
}

export function Toast({ t, bad }) {
  return (
    <div role="status" className={'toast' + (bad ? ' bad' : '')}>
      <Icon n={bad ? 'info' : 'check'} s={18} w={1.75} />
      <span style={{ flex: 1, minWidth: 0 }}>{t}</span>
    </div>
  );
}

function ErrorScr({ text, retry, back }) {
  return (
    <div className="scr">
      <div style={{ padding: '20px 12px 0' }}><button type="button" className="back" onClick={back}><Icon n="back" s={22} />Programas</button></div>
      <div className="body" style={{ padding: '48px 24px' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>No se pudo cargar</h1>
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>{text}</p>
      </div>
      <div className="foot"><button type="button" className="btnS" style={{ flex: 1 }} onClick={retry}>Reintentar</button></div>
    </div>
  );
}

// ======================= Menú de programas =======================
function Menu({ perfil, programas, now, go, salir }) {
  const lista = programas.length ? programas : [{ id: 'inc', nombre: 'Incubadoras', activo: true }];
  const zona = [perfil.ruta_codigo && 'Ruta ' + perfil.ruta_codigo, perfil.region && 'Región ' + perfil.region, perfil.sala && 'Sala de ventas ' + perfil.sala].filter(Boolean).join(' · ');
  return (
    <div className="scr">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px 32px' }}>
        <img src="/track-logo.png" alt="TRACK" style={{ height: 40 }} />
      </div>
      <div className="body">
        <div className="hero" style={{ margin: '0 16px', padding: '28px 24px 26px', borderRadius: 20 }}>
          <div className="lbl">{larga(now)}</div>
          <h1 style={{ margin: '14px 0 0', fontSize: 30, fontWeight: 700, letterSpacing: '-.02em' }}>Hola, {perfil.nombre.split(' ')[0]}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18 }}>
            <div className="accent" />
            <span className="muted" style={{ fontSize: 14 }}>Desarrollador de Mercado</span>
          </div>
          {zona && <p className="muted" style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.5 }}>{zona}</p>}
        </div>
        <div className="lbl" style={{ padding: '32px 24px 14px' }}>Programas</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px 24px' }}>
          {lista.map((m) => {
            const ok = m.activo && (perfil.programas || []).includes(m.id) && m.id === 'inc';
            return (
              <button key={m.id} type="button" className="prog" onClick={() => go(ok ? { screen: 'tabs', tab: 'hoy' } : { screen: 'soon', soon: m.id })}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 17, fontWeight: 600 }}>{m.nombre}</span>
                <span style={{ width: 32, height: 32, borderRadius: 16, border: '1px solid #E6E6E6', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon n="next" s={16} /></span>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button type="button" onClick={salir} style={{ height: 44, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: '#6B6B6B' }}><Icon n="logout" s={18} />Cerrar sesión</button>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 24px' }}>
        <img src="/rtm.png" alt="RTM" style={{ height: 56, opacity: 0.45 }} />
      </div>
    </div>
  );
}

function Soon({ p, go }) {
  return (
    <div className="scr">
      <div style={{ padding: '20px 12px 0' }}><button type="button" className="back" onClick={() => go({ screen: 'menu' })}><Icon n="back" s={22} />Programas</button></div>
      <div className="body" style={{ padding: '56px 24px 24px' }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.15 }}>{p ? p.nombre : 'Programa'}</h1>
        <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid #E6E6E6' }}>
          <div className="lbl">Estado</div>
          <p style={{ margin: '10px 0 0', fontSize: 17, fontWeight: 600 }}>Disponible en la siguiente fase</p>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.45 }}>Usará los mismos módulos de visita, evidencia y seguimiento.</p>
        </div>
      </div>
      <div className="foot"><button type="button" className="btnS" style={{ flex: 1 }} onClick={() => go({ screen: 'menu' })}>Volver a programas</button></div>
    </div>
  );
}

// ======================= Plan de visita =======================
function Plan({ D, cliBy, pos, now, nav, go }) {
  const dow = isoDow(now);
  const defaultDow = dow >= 1 && dow <= 6 ? dow : 1;
  const selectedDow = Number(nav.planDia || defaultDow);
  const dayNames = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const dayShort = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const dayOptions = [1, 2, 3, 4, 5, 6].map((d) => ({
    id: d,
    label: dayShort[d],
    count: (D.clientes || []).filter((c) => c.dia_visita === d).length
  }));
  const plan = (D.clientes || []).filter((c) => c.dia_visita === selectedDow);
  const last = {};
  (D.visitasHoy || []).forEach((v) => { const p = last[v.cliente_codigo]; if (!p || (!p.efectiva && (v.efectiva || new Date(v.fin) > new Date(p.fin)))) last[v.cliente_codigo] = v; });
  const rows = plan.map((c) => {
    const v = last[c.codigo];
    return { c, v, st: v ? (v.efectiva ? 'ok' : 'noef') : 'pend', t: v ? new Date(v.fin).getTime() : 0, m: meters(pos, c) };
  });
  const ef = rows.filter((r) => r.st === 'ok').sort((a, b) => b.t - a.t);
  const ne = rows.filter((r) => r.st === 'noef').sort((a, b) => b.t - a.t);
  const pe = rows.filter((r) => r.st === 'pend').sort((a, b) => (a.m != null && b.m != null ? a.m - b.m : a.c.nombre.localeCompare(b.c.nombre, 'es')));
  const view = nav.plan || 'pend';
  const V = [
    { id: 'ok', l: 'Visitados', n: ef.length, list: ef, empty: 'Aún no hay visitas efectivas.' },
    { id: 'noef', l: 'No efectivos', n: ne.length, list: ne, empty: 'Sin visitas no efectivas.' },
    { id: 'pend', l: 'Pendientes', n: pe.length, list: pe, empty: plan.length ? 'No quedan clientes pendientes.' : 'No tienes clientes programados para ' + dayNames[selectedDow].toLowerCase() + '.' }
  ];
  const cur = V.find((x) => x.id === view);
  const total = plan.length;
  const pctv = total ? (ef.length / total) * 100 : 0;
  return (
    <div className="scr in">
      <div style={{ padding: '12px 16px', flex: 'none' }}>
        <div className="hero" style={{ padding: '16px 18px 14px', borderRadius: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-.02em' }}>Plan de visita</h1>
            <span className="lbl">{selectedDow === dow ? corta(now) : dayNames[selectedDow]}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <span className="big" style={{ fontSize: 48, color: '#FFFFFF' }}>{Math.round(pctv)}</span>
              <span style={{ fontSize: 22, fontWeight: 700, marginLeft: 2 }}>%</span>
            </div>
            <div style={{ textAlign: 'right', paddingBottom: 4 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{ef.length} de {total} clientes</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Visitas efectivas</div>
            </div>
          </div>
          <div style={{ height: 4, background: '#4A4A4D', borderRadius: 2, marginTop: 12, overflow: 'hidden' }}>
            <div style={{ height: 4, background: RED, borderRadius: 2, transition: 'width .4s ease', width: pctv.toFixed(1) + '%' }} />
          </div>
          <HeroTabs items={V} value={view} onPick={(id) => go({ plan: id })} label="Estado de visitas" />
        </div>
      </div>
      <div style={{ padding: '0 16px 12px', flex: 'none' }}>
        <div className="lbl" style={{ padding: '0 8px 8px' }}>Día de visita</div>
        <div role="tablist" aria-label="Seleccionar día del plan de visita" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 6 }}>
          {dayOptions.map((d) => {
            const on = selectedDow === d.id;
            const isToday = dow === d.id;
            return (
              <button key={d.id} type="button" role="tab" aria-selected={on} onClick={() => go({ planDia: d.id, plan: 'pend' })}
                style={{ minHeight: 52, borderRadius: 10, border: on ? '1px solid #2E2E30' : '1px solid #E6E6E6', background: on ? '#2E2E30' : '#FFFFFF', color: on ? '#FFFFFF' : '#2E2E30', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{d.label}</span>
                <span style={{ fontSize: 11, opacity: on ? .8 : .6 }}>{d.count}{isToday ? ' · Hoy' : ''}</span>
              </button>
            );
          })}
        </div>
        {selectedDow !== dow && (
          <div style={{ marginTop: 10, padding: '9px 12px', borderRadius: 10, background: '#F5F5F6', fontSize: 12, lineHeight: 1.4, color: '#6B6B6B' }}>
            Estás viendo clientes programados para <b style={{ color: '#2E2E30' }}>{dayNames[selectedDow]}</b>. Puedes iniciar la visita hoy para adelantar tu ruta.
          </div>
        )}
      </div>
      <div className="grp" style={{ flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 24px', borderTop: '1px solid #E6E6E6', borderBottom: '1px solid #E6E6E6' }}>
        <span className="lbl" style={{ color: '#2E2E30' }}>{cur.l} · {cur.n}</span>
        <span className="lbl">Código · Cliente</span>
      </div>
      <div className="body">
        {cur.list.map((r, i) => (
          <div key={r.c.codigo} className="lrow" style={{ background: i % 2 ? '#F5F5F6' : '#FFFFFF' }}>
            <button type="button" className="open" onClick={() => go({ screen: 'det', cid: r.c.codigo, from: 'hoy' })} aria-label={'Ver ficha de ' + r.c.nombre}>
              <span className="code">{r.c.codigo}</span>
              <span className="cname ellip">{r.c.nombre}</span>
              {r.st !== 'pend' && (
                <span className="ellip" style={{ display: 'block', fontSize: 12, marginTop: 4, ...(r.st === 'noef' ? { color: RED, fontWeight: 600 } : { color: '#6B6B6B' }) }}>
                  {r.st === 'noef' ? r.v.motivo + ' · ' + hora(new Date(r.v.fin)) : 'Efectiva · ' + hora(new Date(r.v.fin))}
                </span>
              )}
              {r.st === 'pend' && r.m != null && <span className="muted" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>{r.m < 1000 ? r.m + ' m' : (r.m / 1000).toFixed(1).replace('.', ',') + ' km'}</span>}
            </button>
            {r.st !== 'ok' ? (
              <button type="button" onClick={() => go({ screen: 'vis', cid: r.c.codigo, from: 'hoy', visFrom: 'tabs' })}
                style={{ height: 44, padding: '0 4px 0 12px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 600, flex: 'none', color: r.st === 'noef' ? RED : '#2E2E30' }}>
                {r.st === 'noef' ? 'Reintentar' : 'Iniciar'}<Icon n="next" s={18} />
              </button>
            ) : (
              <span className="okdot" role="img" aria-label="Visita efectiva"><Icon n="check" s={16} w={2} /></span>
            )}
          </div>
        ))}
        {cur.list.length === 0 && <div className="muted" style={{ padding: '28px 24px', fontSize: 14 }}>{cur.empty}</div>}
        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}

// ======================= Cartera =======================
function Cartera({ D, nav, go, now }) {
  const dsel = nav.dia || 'todos';
  const qtxt = (nav.q || '').trim().toLowerCase();
  const today = isoDow(now) === 7 ? 1 : isoDow(now);
  const C = D.clientes || [];
  const list = C.filter((c) => (dsel === 'todos' || c.dia_visita === dsel) && (!qtxt || [c.codigo, c.nombre, c.direccion, c.distrito, c.responsable, c.telefono].join(' ').toLowerCase().includes(qtxt)));
  const days = [{ id: 'todos', l: 'Todos', aria: 'Todos los días' }].concat([1, 2, 3, 4, 5, 6].map((d) => ({ id: d, l: ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d], aria: DIAS[d % 7] + (d === today ? ', hoy' : '') })));
  return (
    <div className="body scr in">
      <div style={{ padding: 16 }}>
        <div className="hero" style={{ padding: '22px 22px 20px', borderRadius: 20 }}>
          <span className="lbl">Incubadoras</span>
          <h1 style={{ margin: '12px 0 0', fontSize: 24, fontWeight: 700, letterSpacing: '-.02em' }}>Cartera</h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>{C.length} clientes asignados · ubicación y contacto</p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, height: 48, marginTop: 18, padding: '0 14px', background: '#FFFFFF', borderRadius: 12, color: '#2E2E30' }}>
            <Icon n="search" s={18} c="#6B6B6B" />
            <input type="search" value={nav.q || ''} onChange={(e) => go({ q: e.target.value })} placeholder="Código, cliente, dirección o responsable" aria-label="Buscar cliente"
              style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', font: 'inherit', fontSize: 15, color: '#2E2E30', background: 'transparent', height: 44 }} />
          </label>
        </div>
      </div>
      <div style={{ padding: '0 16px 16px' }}>
        <div className="lbl" style={{ padding: '0 8px 10px' }}>Día de visita</div>
        <div role="tablist" aria-label="Día de visita" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
          {days.map((d) => {
            const on = d.id === dsel;
            return (
              <button key={d.id} type="button" role="tab" aria-selected={on} aria-label={d.aria} onClick={() => go({ dia: d.id })}
                style={{ position: 'relative', height: 48, borderRadius: 12, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', transition: 'background .2s, color .2s', ...(on ? { background: '#2E2E30', color: '#FFFFFF' } : { background: '#FFFFFF', color: '#2E2E30', boxShadow: 'inset 0 0 0 1px #E6E6E6' }) }}>
                {d.l}
                {d.id === today && <span style={{ position: 'absolute', bottom: 7, left: '50%', width: 4, height: 4, marginLeft: -2, borderRadius: 2, background: RED }} />}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grp" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderTop: '1px solid #E6E6E6', borderBottom: '1px solid #E6E6E6', position: 'sticky', top: 0, zIndex: 1 }}>
        <span className="lbl" style={{ color: '#2E2E30' }}>{(dsel === 'todos' ? '' : ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][dsel] + ' · ') + plural(list.length, 'cliente', 'clientes')}</span>
        <span className="lbl">Código · Cliente</span>
      </div>
      {list.map((c, i) => {
        const al = alertas(c, D, now);
        return (
          <div key={c.codigo} className="lrow" style={{ minHeight: 76, background: i % 2 ? '#F5F5F6' : '#FFFFFF' }}>
            <button type="button" className="open" onClick={() => go({ screen: 'det', cid: c.codigo, from: 'cartera' })} aria-label={'Ver ficha de ' + c.nombre}>
              <span className="code">{c.codigo}</span>
              <span className="cname ellip">{c.nombre}</span>
              <span className="ellip muted" style={{ display: 'block', fontSize: 13, marginTop: 3 }}>{[c.direccion, c.distrito].filter(Boolean).join(' · ')}</span>
              <span className="ellip muted" style={{ display: 'block', fontSize: 13, marginTop: 1 }}>Responsable: {c.responsable || '—'} · {telFmt(c.telefono)}</span>
              {al.length > 0 && <span className="ellip" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: RED, marginTop: 4 }}>{al.join(' · ')}</span>}
            </button>
            <button type="button" onClick={() => go({ screen: 'map', map: { tipo: 'cli', id: c.codigo, back: { screen: 'tabs', tab: 'cartera' }, backLbl: 'Cartera' } })}
              style={{ height: 44, padding: '0 4px 0 12px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, flex: 'none' }}>
              <Icon n="pin" s={18} />Ubicar
            </button>
          </div>
        );
      })}
      {list.length === 0 && <div className="muted" style={{ padding: '28px 24px', fontSize: 14 }}>Sin resultados.</div>}
      <div style={{ height: 24 }} />
    </div>
  );
}

// ======================= Activación (lista) =======================
function ActList({ D, nav, go }) {
  const PR = D.props || [];
  const view = nav.actF || 'pend';
  const AV = [{ id: 'pend', l: 'Por evaluar', e: 'No hay propuestas por evaluar.' }, { id: 'act', l: 'Activados', e: 'Aún no hay clientes activados.' }, { id: 'noapto', l: 'No aptos', e: 'Sin propuestas descartadas.' }];
  const cur = AV.find((x) => x.id === view);
  const list = PR.filter((x) => x.estado === view);
  const fecha = (s) => { if (!s) return ''; const d = parseIso(s); return d.getDate() + ' ' + ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][d.getMonth()]; };
  return (
    <div className="scr in">
      <div style={{ padding: '12px 16px', flex: 'none' }}>
        <div className="hero" style={{ padding: '16px 18px 14px', borderRadius: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-.02em' }}>Activación</h1>
            <span className="lbl">Propuestas de Comercial</span>
          </div>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.4 }}>Evalúa el potencial, firma el compromiso y entrega la tarjeta.</p>
          <HeroTabs items={AV.map((x) => ({ ...x, n: PR.filter((y) => y.estado === x.id).length }))} value={view} onPick={(id) => go({ actF: id })} label="Estado de propuestas" />
        </div>
      </div>
      <div className="grp" style={{ flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 24px', borderTop: '1px solid #E6E6E6', borderBottom: '1px solid #E6E6E6' }}>
        <span className="lbl" style={{ color: '#2E2E30' }}>{cur.l} · {list.length}</span>
        <span className="lbl">Código · Cliente</span>
      </div>
      <div className="body">
        {list.map((x, k) => {
          const meta = x.estado === 'pend'
            ? (x.noef_motivo ? 'No efectiva · ' + x.noef_motivo + ' · ' + hora(new Date(x.noef_en)) : 'Propuesta del ' + fecha(x.fecha_propuesta) + ' · ' + [x.direccion, x.distrito].filter(Boolean).join(' · '))
            : x.estado === 'act' ? 'Activado con compromiso y tarjeta' : 'No apto · ' + (x.motivos || '');
          const red = x.estado === 'noapto' || (x.estado === 'pend' && x.noef_motivo);
          return (
            <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 76, padding: '12px 16px 12px 24px', background: k % 2 ? '#F5F5F6' : '#FFFFFF' }}>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <span className="code">{x.codigo_cliente}</span>
                <span className="cname ellip">{x.nombre}</span>
                <span className="ellip" style={{ display: 'block', fontSize: 12, marginTop: 3, ...(red ? { color: RED, fontWeight: 600 } : { color: '#6B6B6B' }) }}>{meta}</span>
              </span>
              <button type="button" className="icbtn" aria-label={'Ver mapa de ' + x.nombre} onClick={() => go({ screen: 'map', map: { tipo: 'prop', id: x.id, back: { screen: 'tabs', tab: 'act' }, backLbl: 'Activación' } })}><Icon n="pin" s={20} /></button>
              {x.estado === 'pend' && (
                <button type="button" onClick={() => go({ screen: 'actf', pid: x.id })} style={{ height: 44, padding: '0 4px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 600, flex: 'none', color: x.noef_motivo ? RED : '#2E2E30' }}>
                  {x.noef_motivo ? 'Reintentar' : 'Evaluar'}<Icon n="next" s={18} />
                </button>
              )}
              {x.estado === 'act' && <span className="okdot" role="img" aria-label="Cliente activado"><Icon n="check" s={16} w={2} /></span>}
            </div>
          );
        })}
        {list.length === 0 && <div className="muted" style={{ padding: '28px 24px', fontSize: 14 }}>{cur.e}</div>}
        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}
