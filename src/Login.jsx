import { useState } from 'react';
import { sb, LOGIN_DOMAIN, msg } from './lib/supabase.js';
import Icon from './Icon.jsx';

export default function Login({ initialError = '' }) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(initialError);

  async function submit(e) {
    e.preventDefault();
    if (!u.trim() || !p) { setErr('Escribe tu usuario y contraseña.'); return; }
    setBusy(true); setErr('');
    const user = u.trim().toLowerCase();
    const email = user.includes('@') ? user : `${user}@${LOGIN_DOMAIN}`;
    const { error } = await sb.auth.signInWithPassword({ email, password: p });
    setBusy(false);
    if (error) setErr(msg(error));
  }

  return (
    <div className="center-page">
      <form className="login" onSubmit={submit} noValidate>
        <img src="/track-logo.png" alt="TRACK" style={{ height: 40, display: 'block', margin: '0 auto' }} />
        <div style={{ marginTop: 48 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-.02em' }}>Ingresa</h1>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 14 }}>Con el usuario y la contraseña que te dio el administrador.</p>
        </div>
        <label className="fld" style={{ marginTop: 28 }}>Usuario
          <input className="inp" value={u} onChange={(e) => setU(e.target.value)} autoCapitalize="none" autoCorrect="off" autoComplete="username" inputMode="text" />
        </label>
        <label className="fld" style={{ marginTop: 16 }}>Contraseña
          <span style={{ position: 'relative', display: 'block' }}>
            <input className="inp" type={show ? 'text' : 'password'} value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" style={{ paddingRight: 48 }} />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} style={{ position: 'absolute', right: 2, top: 0, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B6B6B' }}>
              <Icon n={show ? 'eyeOff' : 'eye'} s={18} />
            </button>
          </span>
        </label>
        {err && <p className="err" role="alert">{err}</p>}
        <button type="submit" disabled={busy} style={{ marginTop: 24, width: '100%', height: 52, borderRadius: 12, background: busy ? '#F2F2F3' : '#AC1622', color: busy ? '#8C8C8C' : '#FFFFFF', fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          {busy && <span className="spin" />}{busy ? 'Ingresando' : 'Ingresar'}
        </button>
        <p className="muted" style={{ margin: '20px 0 0', fontSize: 13, textAlign: 'center', lineHeight: 1.5 }}>¿Olvidaste tu contraseña? Pídele una nueva al administrador.</p>
        <img src="/rtm.png" alt="RTM" style={{ height: 48, display: 'block', margin: '48px auto 0', opacity: 0.4 }} />
      </form>
    </div>
  );
}
