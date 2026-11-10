import { useEffect, useState } from 'react';
import { sb, configured, rpc, msg } from './lib/supabase.js';
import Login from './Login.jsx';
import DevApp from './dev/DevApp.jsx';
import Portal from './portal/Portal.jsx';

export default function App() {
  const [session, setSession] = useState(undefined);
  const [perfil, setPerfil] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!configured) return;
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setPerfil(null); return; }
    let alive = true;
    setErr('');
    rpc('registrar_ingreso')
      .then((rows) => {
        if (!alive) return;
        const p = rows && rows[0];
        if (!p || !p.activo) { setErr(p ? 'Tu usuario está inactivo. Habla con el administrador.' : 'Tu usuario no tiene perfil en TRACK. Habla con el administrador.'); sb.auth.signOut(); return; }
        setErr(''); setPerfil(p);
      })
      .catch((e) => { if (alive) { setErr(msg(e)); sb.auth.signOut(); } });
    return () => { alive = false; };
  }, [session?.user?.id]);

  if (!configured) return <SinConfigurar />;
  if (session === undefined || (session && !perfil && !err)) return <div className="center-page"><span className="spin" style={{ color: '#8C8C8C' }} /></div>;
  if (!session || !perfil) return <Login initialError={err} />;
  const salir = () => { setPerfil(null); sb.auth.signOut(); };
  if (perfil.rol === 'Desarrollador') return <DevApp perfil={perfil} salir={salir} />;
  return <Portal perfil={perfil} salir={salir} />;
}

function SinConfigurar() {
  return (
    <div className="center-page">
      <div className="login">
        <img src="/track-logo.png" alt="TRACK" style={{ height: 36 }} />
        <h1 style={{ fontSize: 22, margin: '32px 0 8px' }}>Falta conectar la base de datos</h1>
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>
          Configura en Netlify las variables <b>VITE_SUPABASE_URL</b> y <b>VITE_SUPABASE_ANON_KEY</b> y vuelve a publicar el sitio. Los pasos están en la guía de publicación.
        </p>
      </div>
    </div>
  );
}
