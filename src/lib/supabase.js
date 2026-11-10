import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configured = !!(url && key);
export const sb = configured ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
export const LOGIN_DOMAIN = import.meta.env.VITE_LOGIN_DOMAIN || 'track.local';
export const BUCKET = 'evidencias';

// Traduce errores técnicos a mensajes claros
export function msg(e) {
  const m = (e && (e.message || e.error_description || e.error)) || String(e || 'Error');
  if (/Invalid login credentials/i.test(m)) return 'Usuario o contraseña incorrectos.';
  if (/banned/i.test(m)) return 'Tu usuario está inactivo. Habla con el administrador.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.';
  if (/JWT expired/i.test(m)) return 'Tu sesión venció. Vuelve a ingresar.';
  return m;
}

export async function q(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

export const rpc = (name, args) => q(sb.rpc(name, args));

// Supabase devuelve como máximo 1.000 filas por consulta: esto trae todas, por páginas
export async function fetchAll(build, page = 1000) {
  const out = [];
  for (let from = 0; ; from += page) {
    const data = await q(build().range(from, from + page - 1));
    out.push(...data);
    if (data.length < page) break;
  }
  return out;
}

const urlCache = new Map();
export async function signedUrl(path) {
  if (!path) return null;
  const hit = urlCache.get(path);
  if (hit && hit.exp > Date.now()) return hit.url;
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  urlCache.set(path, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}

export async function upload(path, blob, contentType) {
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType, upsert: false });
  if (error) throw error;
  return path;
}

// Llama a la función segura de Netlify para crear o editar usuarios
export async function adminUsers(action, payload) {
  const { data: { session } } = await sb.auth.getSession();
  const res = await fetch('/.netlify/functions/admin-users', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (session?.access_token || '') },
    body: JSON.stringify({ action, ...payload })
  });
  let body = {};
  try { body = await res.json(); } catch { /* respuesta vacía */ }
  if (!res.ok) throw new Error(body.error || (res.status === 404 ? 'La función de usuarios no está publicada. Revisa la guía (paso Netlify).' : 'No se pudo completar la operación'));
  return body;
}
