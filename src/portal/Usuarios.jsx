import { useEffect, useState } from 'react';
import { sb, q, adminUsers, msg } from '../lib/supabase.js';
import { genPw, fechaHora, sinTildes, telFmt, plural } from '../lib/fmt.js';
import Icon from '../Icon.jsx';

const G = 'minmax(170px, 1.4fr) 120px 120px 104px minmax(150px, 1fr) 120px 110px 104px';
const PROGS = [{ id: 'inc', l: 'Incubadoras' }, { id: 'pro', l: 'Prospecta' }, { id: 'ret', l: 'Retornabilidad' }, { id: 'tua', l: 'Embajadores TUALI' }];

export default function Usuarios({ ctx }) {
  const { rutas, enFiltro, f, say, perfil } = ctx;
  const [users, setUsers] = useState(null);
  const [uq, setUq] = useState('');
  const [ue, setUe] = useState(null);   // formulario abierto
  const [uc, setUc] = useState(null);   // acceso recién creado para compartir
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = () => q(sb.from('perfiles').select('*').order('nombre')).then(setUsers).catch((e) => say(msg(e), true));
  useEffect(() => { load(); }, []);
  if (!users) return <div className="loading"><span className="spin" />Cargando usuarios</div>;

  const routeOf = Object.fromEntries(rutas.map((r) => [r.codigo, r]));
  const filtrosTodos = f.ruta === 'todas' && f.sala === 'todas';
  const txt = uq.trim().toLowerCase();
  const UL = users.filter((u) => {
    const r = routeOf[u.ruta_codigo];
    if (r && r.tipo === 'Desarrollador' && !enFiltro(r.codigo)) return false;
    if (r && r.tipo === 'Supervisión' && f.region !== 'todas' && r.region !== f.region) return false;
    if ((!r || r.tipo === 'Supervisión') && !filtrosTodos) return false;
    return !txt || [u.nombre, u.usuario, u.ruta_codigo, u.celular].join(' ').toLowerCase().includes(txt);
  });

  const nuevo = () => { setUc(null); setErr(''); setUe({ id: null, f: { nombre: '', usuario: '', celular: '', correo: '', rol: 'Desarrollador', ruta_codigo: '', programas: ['inc'], activo: true }, pwEdit: true, pw: '', show: true }); };
  const editar = (u) => { setUc(null); setErr(''); setUe({ id: u.id, ult: u.ultimo_ingreso, f: { nombre: u.nombre, usuario: u.usuario, celular: u.celular || '', correo: u.correo || '', rol: u.rol, ruta_codigo: u.ruta_codigo || '', programas: u.programas || ['inc'], activo: u.activo }, pwEdit: false, pw: '', show: false }); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  let vErr = '';
  if (ue) {
    const x = ue.f;
    const needRuta = x.rol === 'Desarrollador' || x.rol === 'Supervisor';
    const dup = users.some((u) => u.usuario === x.usuario.trim().toLowerCase() && u.id !== ue.id);
    vErr = !x.nombre.trim() ? 'Escribe el nombre.' : !x.usuario.trim() ? 'Escribe el usuario.' : !/^[a-z0-9._-]{3,30}$/.test(x.usuario.trim().toLowerCase()) ? 'El usuario debe tener de 3 a 30 caracteres: letras sin tildes, números, punto o guion.'
      : dup ? 'Ese usuario ya existe.' : x.celular && !/^9\d{8}$/.test(x.celular) ? 'El celular debe tener 9 dígitos y empezar con 9.' : needRuta && !x.ruta_codigo ? 'Elige la ruta.'
      : ue.pwEdit && ue.pw.length < 8 ? 'La contraseña debe tener al menos 8 caracteres.' : '';
  }
  const upF = (k) => (e) => {
    let v = e.target.value;
    if (k === 'celular') v = v.replace(/\D/g, '');
    const nf = { ...ue.f, [k]: v };
    if (k === 'rol') nf.ruta_codigo = '';
    if (k === 'nombre' && ue.id === null && !ue.userTouched) { const p = sinTildes(v).toLowerCase().split(/\s+/).filter(Boolean); nf.usuario = p.length > 1 ? (p[0][0] + p[1]).replace(/[^a-z0-9]/g, '') : (p[0] || '').replace(/[^a-z0-9]/g, ''); }
    setUe({ ...ue, f: nf, ...(k === 'usuario' ? { userTouched: true } : {}) });
  };

  async function guardar() {
    if (vErr) return;
    setBusy(true); setErr('');
    const x = ue.f;
    try {
      const res = await adminUsers(ue.id ? 'update' : 'create', { id: ue.id, user: { ...x, usuario: x.usuario.trim().toLowerCase(), password: ue.pwEdit ? ue.pw : undefined } });
      if (ue.pwEdit) setUc({ u: x.usuario.trim().toLowerCase(), p: ue.pw, copied: false });
      say((ue.id ? 'Cambios guardados · ' : 'Usuario creado · ') + x.nombre.trim() + (res.reassigned ? ' · ' + res.reassigned + ' quedó inactivo' : ''));
      setUe(null); load();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }

  const rutaOpts = ue ? rutas.filter((r) => (ue.f.rol === 'Supervisor' ? r.tipo === 'Supervisión' : r.tipo === 'Desarrollador')) : [];
  const ocupada = ue && ue.f.rol === 'Desarrollador' && ue.f.activo && users.find((u) => u.ruta_codigo === ue.f.ruta_codigo && u.rol === 'Desarrollador' && u.activo && u.id !== ue.id);

  return (
    <div className="scr">
      {ue && (
        <div className="box scr" style={{ marginTop: 24, padding: 24 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div className="lbl">{ue.id ? 'Editar usuario' : 'Nuevo usuario'}</div>
              <h2 style={{ margin: '8px 0 0', fontSize: 20, fontWeight: 700 }}>{ue.id ? ue.f.nombre || 'Usuario' : 'Crear acceso'}</h2>
            </div>
            {ue.id && <span className="muted" style={{ fontSize: 13 }}>Último ingreso: {ue.ult ? fechaHora(new Date(ue.ult)) : 'Nunca'}</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 20 }}>
            <label className="fld">Nombre y apellido<input className="inp" value={ue.f.nombre} onChange={upF('nombre')} /></label>
            <label className="fld">Usuario (para ingresar)<input className="inp" value={ue.f.usuario} onChange={upF('usuario')} autoComplete="off" autoCapitalize="none" /></label>
            <label className="fld">Celular<input className="inp" inputMode="numeric" maxLength={9} value={ue.f.celular} onChange={upF('celular')} /></label>
            <label className="fld">Correo (opcional)<input className="inp" value={ue.f.correo} onChange={upF('correo')} /></label>
            <label className="fld">Rol<select className="inp" value={ue.f.rol} onChange={upF('rol')}><option value="Desarrollador">Desarrollador</option><option value="Supervisor">Supervisor</option><option value="Administrador">Administrador</option><option value="Gerencia">Gerencia (solo lectura)</option></select></label>
            {(ue.f.rol === 'Desarrollador' || ue.f.rol === 'Supervisor') && (
              <label className="fld">Ruta<select className="inp" value={ue.f.ruta_codigo} onChange={upF('ruta_codigo')}><option value="">Elige una ruta</option>{rutaOpts.map((r) => <option key={r.codigo} value={r.codigo}>{r.codigo} · {r.region} · {r.sala}</option>)}</select></label>
            )}
          </div>
          {ocupada && <p className="muted" style={{ margin: '12px 0 0', fontSize: 13 }}>La ruta {ue.f.ruta_codigo} la tiene hoy <b style={{ color: '#2E2E30' }}>{ocupada.nombre}</b>. Al guardar, esa persona quedará inactiva y sin ruta.</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 20, paddingTop: 18, borderTop: '1px solid #E6E6E6' }}>
            <div style={{ flex: '1 1 320px' }}>
              <div className="fld" style={{ marginBottom: 6 }}>Contraseña</div>
              {!ue.pwEdit ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 42 }}>
                  <span style={{ fontSize: 18, letterSpacing: '.2em' }}>••••••••</span>
                  <button type="button" className="qbtn" onClick={() => setUe({ ...ue, pwEdit: true, pw: '', show: true })}>Cambiar contraseña</button>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ position: 'relative', flex: 1, display: 'block' }}>
                      <input className="inp" type={ue.show ? 'text' : 'password'} value={ue.pw} onChange={(e) => setUe({ ...ue, pw: e.target.value })} autoComplete="new-password" style={{ paddingRight: 44, fontVariantNumeric: 'tabular-nums' }} />
                      <button type="button" onClick={() => setUe({ ...ue, show: !ue.show })} aria-label={ue.show ? 'Ocultar contraseña' : 'Mostrar contraseña'} style={{ position: 'absolute', right: 4, top: 4, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B6B6B' }}><Icon n={ue.show ? 'eyeOff' : 'eye'} s={18} /></button>
                    </span>
                    <button type="button" className="btnS" style={{ height: 42 }} onClick={() => setUe({ ...ue, pw: genPw(), show: true })}>Generar</button>
                    {ue.id && <button type="button" className="qbtn" onClick={() => setUe({ ...ue, pwEdit: false, pw: '' })}>No cambiar</button>}
                  </div>
                  <p className="muted" style={{ margin: '8px 0 0', fontSize: 12, lineHeight: 1.5 }}>Mínimo 8 caracteres. Compártela con el usuario al guardar.</p>
                </>
              )}
            </div>
            <div style={{ flex: '1 1 260px' }}>
              <div className="fld" style={{ marginBottom: 6 }}>Programas con acceso</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {PROGS.map((g) => {
                  const on = ue.f.programas.includes(g.id), dis = g.id !== 'inc';
                  return (
                    <button key={g.id} type="button" className="chip" role="checkbox" aria-checked={on} disabled={dis}
                      onClick={() => setUe({ ...ue, f: { ...ue.f, programas: on ? ue.f.programas.filter((p) => p !== g.id) : [...ue.f.programas, g.id] } })}
                      style={dis ? { background: '#FFFFFF', color: '#C9C9C9', boxShadow: 'inset 0 0 0 1px #E6E6E6' } : on ? { background: '#2E2E30', color: '#FFFFFF' } : { background: '#FFFFFF', color: '#2E2E30', boxShadow: 'inset 0 0 0 1px #E6E6E6' }}>
                      {g.l}{dis ? ' · próx.' : ''}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ flex: '0 0 auto' }}>
              <div className="fld" style={{ marginBottom: 6 }}>Estado</div>
              <button type="button" role="switch" aria-checked={ue.f.activo} disabled={ue.id === perfil.id} onClick={() => setUe({ ...ue, f: { ...ue.f, activo: !ue.f.activo } })} style={{ display: 'flex', alignItems: 'center', gap: 10, height: 42 }}>
                <span style={{ width: 40, height: 24, borderRadius: 12, position: 'relative', transition: 'background .2s', background: ue.f.activo ? '#2E2E30' : '#C9C9C9' }}>
                  <span style={{ position: 'absolute', top: 3, width: 18, height: 18, borderRadius: 9, background: '#FFFFFF', transition: 'left .2s', left: ue.f.activo ? 19 : 3 }} />
                </span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{ue.f.activo ? 'Activo' : 'Inactivo'}</span>
              </button>
            </div>
          </div>
          {(err || (vErr && (ue.f.nombre || ue.f.usuario || ue.id))) && <p className="err" style={{ marginTop: 16 }}>{err || vErr}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="btnS" onClick={() => setUe(null)}>Cancelar</button>
            <button type="button" className="btnP" disabled={!!vErr || busy} onClick={guardar}>{busy && <span className="spin" />}{ue.id ? 'Guardar cambios' : 'Crear usuario'}</button>
          </div>
        </div>
      )}

      {uc && (
        <div className="box scr" style={{ marginTop: 24, padding: '20px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, borderColor: '#2E2E30' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="lbl">Acceso listo para compartir</div>
            <p style={{ margin: '8px 0 0', fontSize: 15 }}>Usuario <b>{uc.u}</b> · Contraseña <b className="tab">{uc.p}</b></p>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>Se muestra solo ahora. Después podrás cambiarla, pero no verla.</p>
          </div>
          <button type="button" className="btnS" onClick={async () => { try { await navigator.clipboard.writeText('TRACK\nIngresa en: ' + window.location.origin + '\nUsuario: ' + uc.u + '\nContraseña: ' + uc.p); setUc({ ...uc, copied: true }); } catch { /* sin portapapeles */ } }}>{uc.copied ? 'Copiado' : 'Copiar acceso'}</button>
          <button type="button" className="qbtn" onClick={() => setUc(null)}>Cerrar</button>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 24 }}>
        <label className="search" style={{ flex: '0 1 380px' }}>
          <Icon n="search" s={18} c="#6B6B6B" />
          <input value={uq} onChange={(e) => setUq(e.target.value)} placeholder="Nombre, usuario, ruta o celular" aria-label="Buscar usuario" />
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span className="muted" style={{ fontSize: 13 }}>{plural(UL.length, 'usuario', 'usuarios')}</span>
          <button type="button" className="btnP" onClick={nuevo}><Icon n="plus" s={16} w={2} />Nuevo usuario</button>
        </div>
      </div>
      <div className="box" style={{ marginTop: 12, overflowX: 'auto' }}>
        <div style={{ minWidth: 1000 }}>
          <div className="gr gh" style={{ gridTemplateColumns: G }}><div>Nombre</div><div>Usuario</div><div>Rol</div><div>Ruta</div><div>Región · Sala</div><div>Celular</div><div>Estado</div><div /></div>
          {UL.map((u, ix) => {
            const r = routeOf[u.ruta_codigo];
            return (
              <div key={u.id} className="gr" style={{ gridTemplateColumns: G, background: ix % 2 ? '#FAFAFA' : '#FFFFFF' }}>
                <div style={{ fontWeight: 600 }}>{u.nombre}</div>
                <div className="tab">{u.usuario}</div>
                <div className="muted">{u.rol}</div>
                <div style={{ fontWeight: 600 }}>{u.ruta_codigo || '—'}</div>
                <div className="muted">{r ? r.region + ' · ' + r.sala : '—'}</div>
                <div className="tab">{telFmt(u.celular)}</div>
                <div><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: u.activo ? '#2E2E30' : '#8C8C8C' }}><span style={{ width: 6, height: 6, borderRadius: 3, background: u.activo ? '#2E2E30' : '#C9C9C9' }} />{u.activo ? 'Activo' : 'Inactivo'}</span></div>
                <div style={{ textAlign: 'right' }}><button type="button" className="qbtn" onClick={() => editar(u)}>Editar</button></div>
              </div>
            );
          })}
          {UL.length === 0 && <div className="empty">Sin resultados.</div>}
        </div>
      </div>
      <p className="muted" style={{ fontSize: 12, margin: '10px 0 0' }}>Las contraseñas se guardan cifradas: nadie puede verlas después de creadas. Si alguien la olvida, usa «Cambiar contraseña». Para entrar al portal usan el mismo usuario.</p>
    </div>
  );
}
