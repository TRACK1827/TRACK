-- TRACK · Migración: tercera evidencia EDF para visitas efectivas
-- Ejecutar una sola vez en Supabase SQL Editor si la base ya estaba instalada.

alter table public.visitas
  add column if not exists foto_edf text;

comment on column public.visitas.foto_edf is
  'Ruta en Storage (bucket evidencias) de la imagen EDF adjunta en el paso Evidencia.';
