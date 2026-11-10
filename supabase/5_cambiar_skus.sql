-- =====================================================================
-- TRACK · Cambiar la lista de SKU de Disponibilidad (Incubadoras)
-- Los SKU anteriores se desactivan (no se borran: las visitas pasadas
-- conservan sus respuestas y siguen saliendo bien en las descargas).
-- =====================================================================
update public.catalogos set activo = false where programa_id = 'inc' and tipo = 'SKU';

insert into public.catalogos (programa_id, tipo, codigo, descripcion, orden, activo) values
  ('inc', 'SKU', 'CCIK296', 'CC/IK 296 ml RGB', 1, true),
  ('inc', 'SKU', 'CCIK1L', 'CC/IK 1 L RGB', 2, true),
  ('inc', 'SKU', 'SL500', 'San Luis 500 ml', 3, true),
  ('inc', 'SKU', 'SLS625', 'San Luis Saborizada 625 ml', 4, true),
  ('inc', 'SKU', 'FR350', 'Fresh 350 ml', 5, true)
on conflict (programa_id, tipo, codigo) do update
  set descripcion = excluded.descripcion, orden = excluded.orden, activo = true;

select codigo, descripcion, orden from public.catalogos
where programa_id = 'inc' and tipo = 'SKU' and activo order by orden;
