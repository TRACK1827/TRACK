-- =====================================================================
-- TRACK · Borra TODOS los datos operativos (deja catálogos, programas y usuarios)
-- Úsalo para limpiar los datos de demostración antes de cargar los reales.
-- Los usuarios quedan, pero sin ruta asignada.
-- =====================================================================
update public.perfiles set ruta_codigo = null;
truncate public.propuesta_intentos, public.propuestas, public.tarjetas, public.visitas,
  public.avance_volumen, public.cuotas, public.cliente_cambios, public.clientes, public.cargas restart identity cascade;
delete from public.rutas;
-- Las fotos se borran desde Supabase → Storage → evidencias (seleccionar todo → Delete).
