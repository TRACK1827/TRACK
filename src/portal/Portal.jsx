import { useEffect, useMemo, useRef, useState } from 'react';
import { sb, q } from '../lib/supabase.js';
import { period, PT_START } from '../lib/fmt.js';
import Icon from '../Icon.jsx';
import Dashboard from './Dashboard.jsx';
import Fotos from './Fotos.jsx';
import Clientes from './Clientes.jsx';
import Usuarios from './Usuarios.jsx';
import Cargas from './Cargas.jsx';
import Descargas from './Descargas.jsx';


const HEAD = {
  dash: ['Dashboard', 'Avance por ruta de desarrollador'],
  fotos: ['Verificación de fotos', 'Aprueba o rechaza la evidencia de cada visita'],
  cli: ['Clientes', 'Consulta y corrige los datos de cada cliente'],
  users: ['Usuarios', 'Crea usuarios, asigna su ruta y gestiona su acceso'],
  cargas: ['Cargas Excel', 'Sube las plantillas; el portal valida antes de grabar'],
  desc: ['Descargas', 'Exporta a Excel lo que levantan los desarrolladores']
};

export default function Portal({ perfil, salir }) {
  const admin = perfil.rol === 'Administrador';
  const canReview = admin || perfil.rol === 'Supervisor';
  const [programas, setProgramas] = useState([]);
  const [prog, setProg] = useState('inc');
  const [progOpen, setProgOpen] = useState(false);
  const [view, setView] = useState('dash');
  const [rutas, setRutas] = useState([]);
  const [f, setF] = useState({ periodo: 'semana', back: 0, region: 'todas', sala: 'todas', ruta: 'todas' });
  const [toast, setToast] = useState(null);
  const [nPend, setNPend] = useState(0);
  const tt = useRef();
  const say = (t, bad) => { setToast({ t, bad }); clearTimeout(tt.current); tt.current = setTimeout(() => setToast(null), 3400); };

  const loadRutas = () => q(sb.from('rutas').select('*').order('codigo')).then(setRutas).catch(() => {});
  const loadPend = () => sb.from('visitas').select('id', { count: 'exact', head: true }).eq('revision', 'pend').then(({ count }) => setNPend(count || 0));
  useEffect(() => {
    q(sb.from('programas').select('*').order('orden')).then(setProgramas).catch(() => {});
    loadRutas(); loadPend();
    return () => clearTimeout(tt.current);
  }, []);

  // Rutas visibles para este usuario (el supervisor solo ve las suyas)
  const visibles = useMemo(() => {
    const dev = rutas.filter((r) => r.tipo === 'Desarrollador');
    if (perfil.rol === 'Supervisor') return dev.filter((r) => r.ruta_supervisor === perfil.ruta_codigo);
    return dev;
  }, [rutas, perfil]);
  const regiones = [...new Set(visibles.map((r) => r.region))].sort();
  const salas = [...new Set(visibles.filter((r) => f.region === 'todas' || r.region === f.region).map((r) => r.sala))].sort();
  const rutasOpt = visibles.filter((r) => (f.region === 'todas' || r.region === f.region) && (f.sala === 'todas' || r.sala === f.sala));
  const enFiltro = (codigo) => rutasOpt.some((r) => r.codigo === codigo) && (f.ruta === 'todas' || f.ruta === codigo);
  const filtRutas = rutasOpt.filter((r) => f.ruta === 'todas' || r.codigo === f.ruta).map((r) => r.codigo);
  const P = period(f.periodo, f.back);
  const prevOk = period(f.periodo, f.back + 1).to >= PT_START;
  const set = (x) => setF((s) => ({ ...s, ...x }));
  const ctx = { perfil, admin, canReview, rutas, visibles, enFiltro, filtRutas, f, set, P, say, loadRutas, loadPend, prog, setView };

  const PG = programas.find((g) => g.id === prog) || { nombre: 'Incubadoras', activo: true };
  const inc = prog === 'inc';
  const NAV = [
    { g: 'Seguimiento' },
    { id: 'dash', l: 'Dashboard', ic: 'grid' },
    { id: 'fotos', l: 'Verificar fotos', ic: 'image', badge: nPend },
    { g: 'Datos' },
    { id: 'cli', l: 'Clientes', ic: 'store' },
    admin && { id: 'users', l: 'Usuarios', ic: 'users' },
    admin && { id: 'cargas', l: 'Cargas Excel', ic: 'upload' },
    { id: 'desc', l: 'Descargas', ic: 'download' }
  ].filter(Boolean);
  const showBar = inc && view !== 'cargas';
  const showPer = view === 'dash' || view === 'desc';
  const hasFilt = f.region !== 'todas' || f.sala !== 'todas' || f.ruta !== 'todas' || f.back > 0;

  return (
    <div className="pt">
      <aside>
        <div style={{ padding: '0 12px' }}>
          <img src="/track-logo.png" alt="TRACK" style={{ height: 26, display: 'block' }} />
          <div className="lbl" style={{ marginTop: 14 }}>Portal administrador</div>
        </div>
        <div style={{ position: 'relative' }}>
          <button type="button" onClick={() => setProgOpen(!progOpen)} aria-expanded={progOpen} aria-label="Cambiar de programa"
            style={{ width: '100%', padding: '12px 12px 12px 14px', border: '1px solid #E6E6E6', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10, background: '#FFFFFF' }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="lbl" style={{ display: 'block', fontSize: 10 }}>Programa</span>
              <span className="ellip" style={{ display: 'block', fontSize: 15, fontWeight: 700, marginTop: 4 }}>{PG.nombre}</span>
            </span>
            <Icon n="down" s={16} />
          </button>
          {progOpen && (
            <div role="listbox" aria-label="Programas" className="scr" style={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 6px)', zIndex: 30, background: '#FFFFFF', border: '1px solid #DCDCDE', borderRadius: 12, padding: 6 }}>
              {programas.map((g) => {
                const on = g.id === prog, act = g.activo && g.id === 'inc';
                return (
                  <button key={g.id} type="button" role="option" aria-selected={on} onClick={() => { setProg(g.id); setProgOpen(false); setView('dash'); }}
                    style={{ width: '100%', minHeight: 52, padding: '8px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, background: on ? '#F2F2F3' : 'transparent' }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="ellip" style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{g.nombre}</span>
                      <span style={{ display: 'block', fontSize: 12, marginTop: 2, ...(act ? { color: '#AC1622', fontWeight: 600 } : { color: '#8C8C8C' }) }}>{act ? 'Activo' : 'Siguiente fase'}</span>
                    </span>
                    {on && <Icon n="check" s={16} w={2} c="#AC1622" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <nav aria-label="Secciones" style={{ display: 'flex', flexDirection: 'column', gap: 2, ...(inc ? {} : { opacity: 0.35, pointerEvents: 'none' }) }}>
          {NAV.map((n, i) => n.g
            ? <div key={'g' + i} className="ngrp" style={i === 0 ? { paddingTop: 0 } : undefined}>{n.g}</div>
            : (
              <button key={n.id} type="button" className={'nav' + (view === n.id ? ' on' : '')} onClick={() => setView(n.id)} aria-current={view === n.id ? 'page' : undefined}>
                <Icon n={n.ic} s={20} /><span style={{ flex: 1, whiteSpace: 'nowrap' }}>{n.l}</span>
                {n.badge > 0 && <span style={{ minWidth: 24, height: 22, padding: '0 7px', borderRadius: 11, background: '#AC1622', color: '#FFFFFF', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n.badge}</span>}
              </button>
            ))}
        </nav>
        <div style={{ marginTop: 'auto', padding: '16px 12px 0', borderTop: '1px solid #E6E6E6' }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{perfil.nombre}</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{perfil.rol}{perfil.rol === 'Supervisor' && perfil.ruta_codigo ? ' · ' + perfil.ruta_codigo : ''}</div>
          <button type="button" onClick={salir} style={{ height: 40, marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#6B6B6B' }}><Icon n="logout" s={16} />Cerrar sesión</button>
          <img src="/rtm.png" alt="RTM" style={{ height: 40, display: 'block', opacity: 0.4, marginTop: 16 }} />
        </div>
      </aside>

      <main>
        <div>
          <div className="lbl">{PG.nombre}</div>
          <h1 style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 700, letterSpacing: '-.02em' }}>{inc ? HEAD[view][0] : 'Espacio del programa'}</h1>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 14 }}>{inc ? HEAD[view][1] : 'Este programa aún no está configurado en TRACK'}</p>
        </div>

        {showBar && (
          <div role="group" aria-label="Filtros" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 20, padding: 10, border: '1px solid #E6E6E6', borderRadius: 14, background: '#FAFAFA' }}>
            {showPer && (
              <>
                <div role="tablist" aria-label="Tipo de periodo" style={{ display: 'flex', background: '#FFFFFF', border: '1px solid #E6E6E6', borderRadius: 10, overflow: 'hidden' }}>
                  {[['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes'], ['anio', 'Año']].map(([id, l]) => (
                    <button key={id} type="button" role="tab" aria-selected={f.periodo === id} className="seg" onClick={() => set({ periodo: id, back: 0 })}
                      style={f.periodo === id ? { background: '#2E2E30', color: '#FFFFFF' } : { background: '#FFFFFF', color: '#2E2E30' }}>{l}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', background: '#FFFFFF', border: '1px solid #E6E6E6', borderRadius: 10, height: 40 }}>
                  <button type="button" disabled={!prevOk} onClick={() => set({ back: f.back + 1 })} aria-label="Periodo anterior" style={{ width: 40, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', color: prevOk ? '#2E2E30' : '#C9C9C9' }}><Icon n="back" s={18} w={1.75} /></button>
                  <span style={{ minWidth: 150, padding: '0 4px', textAlign: 'center', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>{P.label}</span>
                  <button type="button" disabled={f.back === 0} onClick={() => set({ back: f.back - 1 })} aria-label="Periodo siguiente" style={{ width: 40, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', color: f.back > 0 ? '#2E2E30' : '#C9C9C9' }}><Icon n="next" s={18} w={1.75} /></button>
                </div>
                {f.back > 0 && <button type="button" className="qbtn" onClick={() => set({ back: 0 })}>Ir al actual</button>}
                <span aria-hidden="true" style={{ width: 1, height: 24, background: '#E6E6E6', margin: '0 4px' }} />
              </>
            )}
            <FSel k="Región" pad={62} value={f.region} onChange={(v) => set({ region: v, sala: 'todas', ruta: 'todas' })} opts={regiones} />
            <FSel k="Sala" pad={46} value={f.sala} onChange={(v) => set({ sala: v, ruta: 'todas' })} opts={salas} />
            <FSel k="Ruta" pad={48} value={f.ruta} onChange={(v) => { const r = visibles.find((x) => x.codigo === v); set(r ? { ruta: v, region: r.region, sala: r.sala } : { ruta: 'todas' }); }} opts={rutasOpt.map((r) => r.codigo)} />
            {hasFilt && <button type="button" className="qbtn" style={{ marginLeft: 'auto', color: '#6B6B6B' }} onClick={() => set({ region: 'todas', sala: 'todas', ruta: 'todas', back: 0 })}>Limpiar</button>}
          </div>
        )}

        {!inc && (
          <div className="scr" style={{ marginTop: 24, maxWidth: 760 }}>
            <div className="box" style={{ padding: 32 }}>
              <div className="lbl">Programa</div>
              <h2 style={{ margin: '10px 0 0', fontSize: 26, fontWeight: 700, letterSpacing: '-.02em' }}>{PG.nombre}</h2>
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #E6E6E6' }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Disponible en la siguiente fase</p>
                <p className="muted" style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.55 }}>Cuando se active, tendrá su propio espacio, separado de Incubadoras: sus rutas, cartera, checklist, cargas Excel, verificación de fotos, dashboard y descargas. Los usuarios pueden tener acceso a uno o varios programas.</p>
              </div>
              <div style={{ marginTop: 24 }}><button type="button" className="btnS" onClick={() => { setProg('inc'); setView('dash'); }}>Ir a Incubadoras</button></div>
            </div>
          </div>
        )}

        {inc && view === 'dash' && <Dashboard ctx={ctx} />}
        {inc && view === 'fotos' && <Fotos ctx={ctx} />}
        {inc && view === 'cli' && <Clientes ctx={ctx} />}
        {inc && view === 'users' && admin && <Usuarios ctx={ctx} />}
        {inc && view === 'cargas' && admin && <Cargas ctx={ctx} />}
        {inc && view === 'desc' && <Descargas ctx={ctx} />}

        {toast && (
          <div role="status" className={'toast' + (toast.bad ? ' bad' : '')}>
            <Icon n={toast.bad ? 'info' : 'check'} s={18} w={1.75} /><span>{toast.t}</span>
          </div>
        )}
      </main>
    </div>
  );
}

function FSel({ k, pad, value, onChange, opts }) {
  return (
    <label className="fsel">
      <span className="k">{k}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={k} style={{ paddingLeft: pad }}>
        <option value="todas">Todas</option>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <Icon n="down" s={14} w={2} c="#6B6B6B" />
    </label>
  );
}
