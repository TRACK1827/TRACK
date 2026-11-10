// TRACK · Función segura para crear y editar usuarios (solo Administrador).
// Corre en Netlify; usa la llave "service_role" de Supabase, que nunca llega al navegador.
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DOMAIN = process.env.LOGIN_DOMAIN || process.env.VITE_LOGIN_DOMAIN || 'track.local';
const ROLES = ['Desarrollador', 'Supervisor', 'Administrador', 'Gerencia'];
const BAN = '876000h'; // ~100 años: usuario inactivo no puede ingresar

class NoSocket { constructor() { throw new Error('Tiempo real no disponible en la función'); } }

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const fail = (msg, status = 400) => json(status, { error: msg });

function clean(u) {
  return String(u || '').trim().toLowerCase();
}

export default async (req) => {
  if (req.method !== 'POST') return fail('Método no permitido', 405);
  if (!URL || !SERVICE_KEY) return fail('Falta configurar SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Netlify', 500);

  // La función no usa tiempo real: se pasa un transporte vacío para que funcione en cualquier versión de Node
  const admin = createClient(URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: NoSocket } });

  // 1. ¿Quién llama? Debe ser un Administrador activo
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return fail('Sesión no válida', 401);
  const { data: who, error: whoErr } = await admin.auth.getUser(token);
  if (whoErr || !who?.user) return fail('Sesión no válida', 401);
  const { data: me } = await admin.from('perfiles').select('id, rol, activo').eq('id', who.user.id).maybeSingle();
  if (!me || !me.activo || me.rol !== 'Administrador') return fail('Solo el administrador puede gestionar usuarios', 403);

  let body;
  try { body = await req.json(); } catch { return fail('Solicitud no válida'); }
  const { action } = body;

  // 2. Validaciones comunes
  const f = body.user || {};
  const usuario = clean(f.usuario);
  const nombre = String(f.nombre || '').trim();
  const rol = f.rol;
  const celular = f.celular ? String(f.celular).replace(/\D/g, '') : null;
  const correo = f.correo ? String(f.correo).trim() : null;
  const ruta = f.ruta_codigo || null;
  const programas = Array.isArray(f.programas) && f.programas.length ? f.programas : ['inc'];
  const activo = f.activo !== false;
  const password = f.password ? String(f.password) : '';

  if (action !== 'create' && action !== 'update') return fail('Acción no válida');
  if (!nombre) return fail('Escribe el nombre');
  if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) return fail('El usuario debe tener entre 3 y 30 caracteres: letras, números, punto o guion');
  if (!ROLES.includes(rol)) return fail('Rol no válido');
  if (celular && !/^9\d{8}$/.test(celular)) return fail('El celular debe tener 9 dígitos y empezar con 9');
  if (password && password.length < 8) return fail('La contraseña debe tener al menos 8 caracteres');
  if (rol === 'Desarrollador' || rol === 'Supervisor') {
    if (!ruta) return fail('Elige la ruta');
    const { data: r } = await admin.from('rutas').select('codigo, tipo').eq('codigo', ruta).maybeSingle();
    if (!r) return fail('La ruta ' + ruta + ' no existe');
    if (rol === 'Desarrollador' && r.tipo !== 'Desarrollador') return fail('Un desarrollador debe tener una ruta de tipo Desarrollador');
    if (rol === 'Supervisor' && r.tipo !== 'Supervisión') return fail('Un supervisor debe tener una ruta de tipo Supervisión');
  }
  const { data: dup } = await admin.from('perfiles').select('id').eq('usuario', usuario).maybeSingle();

  const perfil = { usuario, nombre, rol, celular, correo, ruta_codigo: (rol === 'Desarrollador' || rol === 'Supervisor') ? ruta : null, programas, activo };
  let id = body.id;
  let reassigned = null;

  if (action === 'create') {
    if (dup) return fail('Ese usuario ya existe');
    if (!password) return fail('Escribe una contraseña');
    const { data, error } = await admin.auth.admin.createUser({ email: `${usuario}@${DOMAIN}`, password, email_confirm: true, user_metadata: { usuario, nombre } });
    if (error) return fail('No se pudo crear el acceso: ' + error.message);
    id = data.user.id;
    const { error: e2 } = await admin.from('perfiles').insert({ id, ...perfil });
    if (e2) { await admin.auth.admin.deleteUser(id); return fail('No se pudo guardar el perfil: ' + e2.message); }
    if (!activo) await admin.auth.admin.updateUserById(id, { ban_duration: BAN });
  } else {
    if (!id) return fail('Falta el usuario a editar');
    if (dup && dup.id !== id) return fail('Ese usuario ya existe');
    if (id === me.id && (!activo || rol !== 'Administrador')) return fail('No puedes desactivarte ni quitarte el rol de administrador');
    const authPatch = { email: `${usuario}@${DOMAIN}`, email_confirm: true, user_metadata: { usuario, nombre }, ban_duration: activo ? 'none' : BAN };
    if (password) authPatch.password = password;
    const { error } = await admin.auth.admin.updateUserById(id, authPatch);
    if (error) return fail('No se pudo actualizar el acceso: ' + error.message);
    const { error: e2 } = await admin.from('perfiles').update(perfil).eq('id', id);
    if (e2) return fail('No se pudo guardar el perfil: ' + e2.message);
  }

  // 3. Una ruta tiene un solo desarrollador activo: el anterior queda inactivo y sin ruta
  if (activo && rol === 'Desarrollador' && perfil.ruta_codigo) {
    const { data: prev } = await admin.from('perfiles').select('id, nombre').eq('ruta_codigo', perfil.ruta_codigo).eq('rol', 'Desarrollador').eq('activo', true).neq('id', id);
    for (const p of prev || []) {
      await admin.from('perfiles').update({ activo: false, ruta_codigo: null }).eq('id', p.id);
      await admin.auth.admin.updateUserById(p.id, { ban_duration: BAN });
      reassigned = p.nombre;
    }
  }

  return json(200, { ok: true, id, reassigned });
};
