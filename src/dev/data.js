import { useCallback, useEffect, useState } from 'react';
import { sb, q, rpc } from '../lib/supabase.js';
import { iso, parseIso } from '../lib/fmt.js';

const TIPOS = { SKU: 'SKU', FDE: 'Ítem FDE', EV: 'Ítem evaluación', MOT: 'Motivo no efectiva', NOAPTO: 'Motivo no apto', INC: 'Incidencia' };

export function useRuta(perfil, programa = 'inc') {
  const [st, setSt] = useState({ loading: true, error: '' });

  const load = useCallback(async () => {
    const ruta = perfil.ruta_codigo;
    if (!ruta) { setSt({ loading: false, error: 'No tienes una ruta asignada. Habla con el administrador.' }); return; }
    try {
      const now = new Date();
      const mes = iso(new Date(now.getFullYear(), now.getMonth(), 1));
      const desde = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 60));
      const [catRows, clientes, visitasHoy, cuotas, avance, ult, props, corte] = await Promise.all([
        q(sb.from('catalogos').select('tipo, codigo, descripcion, orden').eq('programa_id', programa).eq('activo', true).order('orden')),
        q(sb.from('clientes').select('*').eq('ruta_codigo', ruta).eq('activo', true).order('nombre').limit(1000)),
        q(sb.from('visitas').select('id, cliente_codigo, efectiva, motivo, fin, n_incumplimientos').eq('ruta_codigo', ruta).eq('fecha', iso(now)).order('fin')),
        q(sb.from('cuotas').select('cliente_codigo, cuota_cu').eq('mes', mes).limit(2000)),
        q(sb.from('v_avance_actual').select('cliente_codigo, fecha_corte, cu').limit(2000)),
        q(sb.from('v_ultima_visita').select('cliente_codigo, fecha').limit(5000)),
        q(sb.from('propuestas').select('*').eq('ruta_codigo', ruta).eq('programa_id', programa).or('estado.eq.pend,resuelto_en.gte.' + desde).order('fecha_propuesta', { ascending: true })),
        rpc('corte_volumen')
      ]);
      const cat = {};
      Object.entries(TIPOS).forEach(([k, t]) => { cat[k] = catRows.filter((r) => r.tipo === t); });
      const cuotaBy = Object.fromEntries(cuotas.map((c) => [c.cliente_codigo, Number(c.cuota_cu)]));
      const avBy = Object.fromEntries(avance.map((a) => [a.cliente_codigo, Number(a.cu)]));
      const ultBy = Object.fromEntries(ult.map((u) => [u.cliente_codigo, u.fecha]));
      setSt({ loading: false, error: '', cat, clientes, visitasHoy, cuotaBy, avBy, ultBy, props, corte });
    } catch (e) {
      setSt((s) => ({ ...s, loading: false, error: e.message || 'No se pudieron cargar los datos' }));
    }
  }, [perfil.ruta_codigo, programa]);

  useEffect(() => { load(); }, [load]);

  // Actualizaciones locales tras guardar, sin recargar todo
  const patch = useCallback((fn) => setSt((s) => ({ ...s, ...fn(s) })), []);
  return { ...st, reload: load, patch };
}

// Alertas de un cliente: bajo cuota a la fecha de corte, o muchos días sin visita efectiva
export function alertas(c, D, now) {
  const a = [];
  const cuota = D.cuotaBy[c.codigo], av = D.avBy[c.codigo];
  if (cuota && D.corte) {
    const cd = parseIso(D.corte);
    if (cd.getMonth() === now.getMonth()) {
      const frac = cd.getDate() / new Date(cd.getFullYear(), cd.getMonth() + 1, 0).getDate();
      if ((av || 0) < cuota * frac * 0.85) a.push('Bajo cuota');
    }
  }
  const u = D.ultBy[c.codigo];
  const dias = u ? Math.floor((now - parseIso(u)) / 864e5) : null;
  if (dias != null && dias >= 8) a.push('Sin visita hace ' + dias + ' días');
  return a;
}
