-- TRACK · MVP · INSTALACIÓN COMPLETA (esquema + seguridad + funciones)
-- Pega TODO este archivo en Supabase → SQL Editor → New query y presiona Run.
-- Se puede volver a ejecutar sin perder datos (sirve también para actualizar).

-- =====================================================================
-- TRACK · MVP · Esquema de base de datos (Supabase / PostgreSQL)
-- Ejecutar una sola vez en: Supabase → SQL Editor → New query → Run
-- =====================================================================

-- ---------------------------------------------------------------
-- Programas (cada programa es un espacio independiente)
-- ---------------------------------------------------------------
create table if not exists public.programas (
  id        text primary key,
  nombre    text not null,
  activo    boolean not null default false,
  orden     int not null default 0
);

insert into public.programas (id, nombre, activo, orden) values
  ('inc', 'Incubadoras', true, 1),
  ('pro', 'Prospecta', false, 2),
  ('ret', 'Embajador de Retornabilidad', false, 3),
  ('tua', 'Embajadores TUALI', false, 4)
on conflict (id) do nothing;

-- ---------------------------------------------------------------
-- Rutas: estructura fija (la persona puede cambiar)
-- ---------------------------------------------------------------
create table if not exists public.rutas (
  codigo           text primary key,
  programa_id      text not null default 'inc' references public.programas(id),
  tipo             text not null default 'Desarrollador' check (tipo in ('Desarrollador', 'Supervisión')),
  region           text not null,
  sala             text not null,
  ruta_supervisor  text references public.rutas(codigo) on update cascade on delete set null,
  activa           boolean not null default true
);

-- ---------------------------------------------------------------
-- Perfiles de usuario (1 a 1 con auth.users)
-- ---------------------------------------------------------------
create table if not exists public.perfiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  usuario         text not null unique,
  nombre          text not null,
  rol             text not null check (rol in ('Desarrollador', 'Supervisor', 'Administrador', 'Gerencia')),
  celular         text,
  correo          text,
  ruta_codigo     text references public.rutas(codigo) on update cascade on delete set null,
  programas       text[] not null default array['inc'],
  activo          boolean not null default true,
  ultimo_ingreso  timestamptz,
  creado_en       timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Catálogos (SKU, ítems FDE, motivos, etc.)
-- ---------------------------------------------------------------
create table if not exists public.catalogos (
  programa_id  text not null default 'inc' references public.programas(id),
  tipo         text not null,
  codigo       text not null,
  descripcion  text not null,
  orden        int not null default 0,
  activo       boolean not null default true,
  primary key (programa_id, tipo, codigo)
);

insert into public.catalogos (tipo, codigo, descripcion, orden) values
  ('SKU', 'CCIK296', 'CC/IK 296 ml RGB', 1),
  ('SKU', 'CCIK1L', 'CC/IK 1 L RGB', 2),
  ('SKU', 'SL500', 'San Luis 500 ml', 3),
  ('SKU', 'SLS625', 'San Luis Saborizada 625 ml', 4),
  ('SKU', 'FR350', 'Fresh 350 ml', 5),
  ('Ítem FDE', 'RACK', 'Rack instalado y lleno', 1),
  ('Ítem FDE', 'VIS', 'Visibilidad de SKU', 2),
  ('Ítem FDE', 'PREC', 'Precios marcados', 3),
  ('Ítem FDE', 'POP', 'Material POP (si corresponde)', 4),
  ('Ítem evaluación', 'ESP', 'Espacio para rack', 1),
  ('Ítem evaluación', 'FLU', 'Buen flujo de clientes', 2),
  ('Ítem evaluación', 'INT', 'Interesado en el programa', 3),
  ('Ítem evaluación', 'CEL', 'Tiene smartphone', 4),
  ('Motivo no efectiva', 'CER', 'Cliente cerrado', 1),
  ('Motivo no efectiva', 'AUS', 'Cliente ausente', 2),
  ('Motivo no efectiva', 'TAR', 'Volver más tarde', 3),
  ('Motivo no efectiva', 'OTR', 'Otro', 4),
  ('Motivo no apto', 'SESP', 'Sin espacio para rack', 1),
  ('Motivo no apto', 'NINT', 'Cliente no interesado', 2),
  ('Motivo no apto', 'PBAJ', 'Potencial bajo', 3),
  ('Motivo no apto', 'NOMP', 'No es Micro o Pequeño', 4),
  ('Motivo no apto', 'CIER', 'Local por cerrar o traspasar', 5),
  ('Motivo no apto', 'OTR', 'Otro', 6),
  ('Incidencia', 'STK', 'Falta de stock', 1),
  ('Incidencia', 'RDA', 'Rack dañado', 2),
  ('Incidencia', 'OTR', 'Otro', 3),
  ('Motivo rechazo foto', 'BOR', 'Foto borrosa', 1),
  ('Motivo rechazo foto', 'NCO', 'No corresponde al cliente', 2),
  ('Motivo rechazo foto', 'RVA', 'Rack vacío o incompleto', 3),
  ('Motivo rechazo foto', 'REP', 'Foto repetida', 4),
  ('Motivo rechazo foto', 'OTR', 'Otro', 5)
on conflict do nothing;

-- ---------------------------------------------------------------
-- Clientes (cartera)
-- ---------------------------------------------------------------
create table if not exists public.clientes (
  codigo           text primary key,
  programa_id      text not null default 'inc' references public.programas(id),
  nombre           text not null,
  direccion        text,
  distrito         text,
  region           text,
  sala             text,
  lat              double precision,
  lng              double precision,
  responsable      text,
  telefono         text,
  ruta_codigo      text references public.rutas(codigo) on update cascade on delete set null,
  dia_visita       smallint check (dia_visita between 1 and 6),  -- 1 = lunes … 6 = sábado
  fecha_ingreso    date,
  activo           boolean not null default true,
  actualizado_en   timestamptz,
  actualizado_por  uuid references auth.users(id) on delete set null
);
create index if not exists clientes_ruta_idx on public.clientes (ruta_codigo, dia_visita);

-- Historial de cambios en datos de clientes
create table if not exists public.cliente_cambios (
  id              bigint generated always as identity primary key,
  cliente_codigo  text not null references public.clientes(codigo) on update cascade on delete cascade,
  campo           text not null,
  anterior        text,
  nuevo           text,
  usuario_id      uuid references auth.users(id) on delete set null,
  origen          text not null default 'portal',
  creado_en       timestamptz not null default now()
);
create index if not exists cliente_cambios_cli_idx on public.cliente_cambios (cliente_codigo, creado_en desc);

-- ---------------------------------------------------------------
-- Cuotas y avance de volumen
-- ---------------------------------------------------------------
create table if not exists public.cuotas (
  cliente_codigo  text not null references public.clientes(codigo) on update cascade on delete cascade,
  mes             date not null,          -- siempre el día 1 del mes
  cuota_cu        numeric not null,
  primary key (cliente_codigo, mes)
);

create table if not exists public.avance_volumen (
  cliente_codigo  text not null references public.clientes(codigo) on update cascade on delete cascade,
  fecha_corte     date not null,
  cu              numeric not null,       -- CU acumuladas del mes a la fecha de corte
  primary key (cliente_codigo, fecha_corte)
);

-- ---------------------------------------------------------------
-- Visitas
-- ---------------------------------------------------------------
create table if not exists public.visitas (
  id                 uuid primary key default gen_random_uuid(),
  programa_id        text not null default 'inc' references public.programas(id),
  cliente_codigo     text not null references public.clientes(codigo) on update cascade on delete cascade,
  ruta_codigo        text not null references public.rutas(codigo) on update cascade,
  usuario_id         uuid default auth.uid() references auth.users(id) on delete set null,
  fecha              date not null default (now() at time zone 'America/Lima')::date,
  inicio             timestamptz,
  fin                timestamptz not null default now(),
  efectiva           boolean not null,
  motivo             text,                 -- motivo de no efectiva
  lat                double precision,
  lng                double precision,
  distancia_m        int,
  fde                jsonb,                -- {"RACK":"si","VIS":"no","PREC":"si","POP":"na"}
  skus               jsonb,                -- {"SL500":"si","CC1VR":"no",...}
  n_incumplimientos  int,
  pedido_tuali       boolean,              -- el cliente inició pedido en TUALI
  tuali_instalado    boolean,
  tuali_pedidos      text check (tuali_pedidos in ('auto', 'asist', 'no')),
  incidencias        text[],
  foto_fachada       text,                 -- ruta en Storage (bucket evidencias)
  foto_rack          text,
  foto_edf           text,                 -- evidencia EDF en Storage
  revision           text check (revision in ('pend', 'ok', 'rej')),  -- solo visitas efectivas
  motivo_rechazo     text,
  revisado_por       uuid references auth.users(id) on delete set null,
  revisado_en        timestamptz
);
create index if not exists visitas_ruta_fecha_idx on public.visitas (ruta_codigo, fecha);
create index if not exists visitas_cli_idx on public.visitas (cliente_codigo, fecha desc);
create index if not exists visitas_rev_idx on public.visitas (revision, fin desc) where efectiva;

-- ---------------------------------------------------------------
-- Propuestas de Comercial (Activación)
-- ---------------------------------------------------------------
create table if not exists public.propuestas (
  id               uuid primary key default gen_random_uuid(),
  programa_id      text not null default 'inc' references public.programas(id),
  codigo_cliente   text not null,
  nombre           text not null,
  direccion        text,
  distrito         text,
  region           text,
  sala             text,
  lat              double precision,
  lng              double precision,
  responsable      text,
  telefono         text,
  asesor           text,
  fecha_propuesta  date,
  ruta_codigo      text references public.rutas(codigo) on update cascade on delete set null,
  estado           text not null default 'pend' check (estado in ('pend', 'act', 'noapto')),
  evaluacion       jsonb,
  potencial        text,
  motivos          text,
  compromisos      boolean,
  firma            text,                  -- ruta de la imagen de la firma en Storage
  firma_en         timestamptz,
  tarjeta_codigo   text,
  noef_motivo      text,
  noef_en          timestamptz,
  resuelto_por     uuid references auth.users(id) on delete set null,
  resuelto_en      timestamptz,
  unique (programa_id, codigo_cliente)
);

-- Intentos de visita de activación no efectivos (para descargas)
create table if not exists public.propuesta_intentos (
  id            bigint generated always as identity primary key,
  propuesta_id  uuid not null references public.propuestas(id) on delete cascade,
  usuario_id    uuid default auth.uid() references auth.users(id) on delete set null,
  motivo        text not null,
  creado_en     timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Tarjetas del programa
-- ---------------------------------------------------------------
create table if not exists public.tarjetas (
  codigo           text primary key,
  lote             text,
  fecha_recepcion  date,
  ruta_codigo      text references public.rutas(codigo) on update cascade on delete set null,
  estado           text not null default 'Disponible' check (estado in ('Disponible', 'Asignada', 'Entregada', 'Anulada')),
  cliente_codigo   text,
  entregada_en     timestamptz
);

-- ---------------------------------------------------------------
-- Registro de cargas Excel
-- ---------------------------------------------------------------
create table if not exists public.cargas (
  id          bigint generated always as identity primary key,
  plantilla   text not null,
  archivo     text,
  filas       int not null default 0,
  errores     int not null default 0,
  usuario_id  uuid default auth.uid() references auth.users(id) on delete set null,
  creado_en   timestamptz not null default now()
);

-- =====================================================================
-- TRACK · MVP · Seguridad: quién ve y quién edita qué (RLS)
-- =====================================================================

-- ---------------------------------------------------------------
-- Funciones de apoyo
-- ---------------------------------------------------------------
create or replace function public.mi_rol() returns text
language sql stable security definer set search_path = public as $$
  select rol from public.perfiles where id = auth.uid() and activo
$$;

create or replace function public.mi_ruta() returns text
language sql stable security definer set search_path = public as $$
  select ruta_codigo from public.perfiles where id = auth.uid() and activo
$$;

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.mi_rol() = 'Administrador', false)
$$;

create or replace function public.es_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.mi_rol() in ('Administrador', 'Supervisor', 'Gerencia'), false)
$$;

-- Rutas que el usuario puede ver
create or replace function public.rutas_visibles() returns setof text
language sql stable security definer set search_path = public as $$
  select r.codigo from public.rutas r
  where case public.mi_rol()
    when 'Administrador' then true
    when 'Gerencia' then true
    when 'Supervisor' then r.codigo = public.mi_ruta() or r.ruta_supervisor = public.mi_ruta()
    when 'Desarrollador' then r.codigo = public.mi_ruta()
    else false end
$$;

create or replace function public.puede_ver_ruta(p_ruta text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_ruta is not null and p_ruta in (select public.rutas_visibles())
$$;

-- ---------------------------------------------------------------
-- Activar RLS
-- ---------------------------------------------------------------
alter table public.programas          enable row level security;
alter table public.rutas              enable row level security;
alter table public.perfiles           enable row level security;
alter table public.catalogos          enable row level security;
alter table public.clientes           enable row level security;
alter table public.cliente_cambios    enable row level security;
alter table public.cuotas             enable row level security;
alter table public.avance_volumen     enable row level security;
alter table public.visitas            enable row level security;
alter table public.propuestas         enable row level security;
alter table public.propuesta_intentos enable row level security;
alter table public.tarjetas           enable row level security;
alter table public.cargas             enable row level security;

-- Programas, rutas y catálogos: todos los usuarios conectados leen; solo el administrador escribe
drop policy if exists programas_leer on public.programas;
create policy programas_leer on public.programas for select to authenticated using (true);
drop policy if exists programas_admin on public.programas;
create policy programas_admin on public.programas for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists rutas_leer on public.rutas;
create policy rutas_leer on public.rutas for select to authenticated using (true);
drop policy if exists rutas_admin on public.rutas;
create policy rutas_admin on public.rutas for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists catalogos_leer on public.catalogos;
create policy catalogos_leer on public.catalogos for select to authenticated using (true);
drop policy if exists catalogos_admin on public.catalogos;
create policy catalogos_admin on public.catalogos for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Perfiles: cada uno ve el suyo; el equipo de gestión ve todos.
-- Crear y editar usuarios se hace desde la función segura de Netlify (admin-users).
drop policy if exists perfiles_leer on public.perfiles;
create policy perfiles_leer on public.perfiles for select to authenticated using (id = auth.uid() or public.es_staff());

-- Clientes
drop policy if exists clientes_leer on public.clientes;
create policy clientes_leer on public.clientes for select to authenticated
  using (public.es_admin() or public.puede_ver_ruta(ruta_codigo));
drop policy if exists clientes_admin on public.clientes;
create policy clientes_admin on public.clientes for all to authenticated using (public.es_admin()) with check (public.es_admin());
drop policy if exists clientes_campo on public.clientes;
create policy clientes_campo on public.clientes for update to authenticated
  using (public.mi_rol() = 'Desarrollador' and ruta_codigo = public.mi_ruta())
  with check (public.mi_rol() = 'Desarrollador' and ruta_codigo = public.mi_ruta());

drop policy if exists cambios_leer on public.cliente_cambios;
create policy cambios_leer on public.cliente_cambios for select to authenticated using (public.es_staff());

-- Cuotas y avance
drop policy if exists cuotas_leer on public.cuotas;
create policy cuotas_leer on public.cuotas for select to authenticated
  using (public.es_staff() or exists (select 1 from public.clientes c where c.codigo = cliente_codigo and c.ruta_codigo = public.mi_ruta()));
drop policy if exists cuotas_admin on public.cuotas;
create policy cuotas_admin on public.cuotas for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists avance_leer on public.avance_volumen;
create policy avance_leer on public.avance_volumen for select to authenticated
  using (public.es_staff() or exists (select 1 from public.clientes c where c.codigo = cliente_codigo and c.ruta_codigo = public.mi_ruta()));
drop policy if exists avance_admin on public.avance_volumen;
create policy avance_admin on public.avance_volumen for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Visitas
drop policy if exists visitas_leer on public.visitas;
create policy visitas_leer on public.visitas for select to authenticated using (public.puede_ver_ruta(ruta_codigo));
drop policy if exists visitas_crear on public.visitas;
create policy visitas_crear on public.visitas for insert to authenticated
  with check (public.es_admin() or (public.mi_rol() = 'Desarrollador' and ruta_codigo = public.mi_ruta()));
drop policy if exists visitas_revisar on public.visitas;
create policy visitas_revisar on public.visitas for update to authenticated
  using (public.es_admin() or (public.mi_rol() = 'Supervisor' and public.puede_ver_ruta(ruta_codigo)))
  with check (public.es_admin() or (public.mi_rol() = 'Supervisor' and public.puede_ver_ruta(ruta_codigo)));
drop policy if exists visitas_borrar on public.visitas;
create policy visitas_borrar on public.visitas for delete to authenticated using (public.es_admin());

-- Propuestas (el desarrollador las cierra con la función cerrar_propuesta)
drop policy if exists propuestas_leer on public.propuestas;
create policy propuestas_leer on public.propuestas for select to authenticated
  using (public.es_admin() or public.puede_ver_ruta(ruta_codigo));
drop policy if exists propuestas_admin on public.propuestas;
create policy propuestas_admin on public.propuestas for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists intentos_leer on public.propuesta_intentos;
create policy intentos_leer on public.propuesta_intentos for select to authenticated using (public.es_staff());

-- Tarjetas
drop policy if exists tarjetas_leer on public.tarjetas;
create policy tarjetas_leer on public.tarjetas for select to authenticated
  using (public.es_staff() or ruta_codigo = public.mi_ruta());
drop policy if exists tarjetas_admin on public.tarjetas;
create policy tarjetas_admin on public.tarjetas for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Registro de cargas
drop policy if exists cargas_admin on public.cargas;
create policy cargas_admin on public.cargas for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- ---------------------------------------------------------------
-- Reglas de negocio (triggers)
-- ---------------------------------------------------------------

-- Clientes: en campo solo se edita responsable y teléfono; todo cambio queda en el historial
create or replace function public.tg_clientes_cambios() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_admin boolean := public.es_admin();
  v_origen text := case when v_admin then 'portal' else 'campo' end;
  v_campo text;
  v_old jsonb := to_jsonb(old);
  v_new jsonb;
begin
  if auth.uid() is null then return new; end if;   -- cambios técnicos desde el panel de Supabase
  if not v_admin then
    if (new.codigo, new.nombre, new.direccion, new.distrito, new.region, new.sala, new.lat, new.lng, new.ruta_codigo, new.dia_visita, new.activo, new.programa_id, new.fecha_ingreso)
       is distinct from
       (old.codigo, old.nombre, old.direccion, old.distrito, old.region, old.sala, old.lat, old.lng, old.ruta_codigo, old.dia_visita, old.activo, old.programa_id, old.fecha_ingreso) then
      raise exception 'Desde campo solo se puede editar el responsable del negocio y su teléfono';
    end if;
    if new.telefono is not null and new.telefono !~ '^9[0-9]{8}$' then
      raise exception 'El teléfono debe tener 9 dígitos y empezar con 9';
    end if;
  end if;
  new.actualizado_en := now();
  new.actualizado_por := auth.uid();
  v_new := to_jsonb(new);
  foreach v_campo in array array['nombre', 'direccion', 'distrito', 'region', 'sala', 'lat', 'lng', 'responsable', 'telefono', 'ruta_codigo', 'dia_visita', 'activo'] loop
    if v_old -> v_campo is distinct from v_new -> v_campo then
      insert into public.cliente_cambios (cliente_codigo, campo, anterior, nuevo, usuario_id, origen)
      values (new.codigo, v_campo, v_old ->> v_campo, v_new ->> v_campo, auth.uid(), v_origen);
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists clientes_cambios on public.clientes;
create trigger clientes_cambios before update on public.clientes
  for each row execute function public.tg_clientes_cambios();

-- Visitas: el desarrollador registra solo en su ruta y a su nombre
create or replace function public.tg_visitas_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.es_admin() then
    new.usuario_id := auth.uid();
    if new.ruta_codigo is distinct from public.mi_ruta() then
      raise exception 'La visita no corresponde a tu ruta';
    end if;
    if not exists (select 1 from public.clientes c where c.codigo = new.cliente_codigo and c.ruta_codigo = new.ruta_codigo) then
      raise exception 'El cliente no pertenece a tu ruta';
    end if;
  end if;
  new.revision := case when new.efectiva then 'pend' else null end;
  new.revisado_por := null; new.revisado_en := null; new.motivo_rechazo := null;
  return new;
end $$;

drop trigger if exists visitas_insert on public.visitas;
create trigger visitas_insert before insert on public.visitas
  for each row execute function public.tg_visitas_insert();

-- Visitas: el supervisor solo cambia la revisión de fotos
create or replace function public.tg_visitas_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.es_admin() then
    if (to_jsonb(new) - array['revision', 'motivo_rechazo', 'revisado_por', 'revisado_en'])
       is distinct from (to_jsonb(old) - array['revision', 'motivo_rechazo', 'revisado_por', 'revisado_en']) then
      raise exception 'Solo se puede cambiar la revisión de fotos';
    end if;
  end if;
  if new.revision is distinct from old.revision then
    new.revisado_por := auth.uid();
    new.revisado_en := now();
  end if;
  return new;
end $$;

drop trigger if exists visitas_update on public.visitas;
create trigger visitas_update before update on public.visitas
  for each row execute function public.tg_visitas_update();

-- ---------------------------------------------------------------
-- Almacenamiento de fotos y firmas (bucket privado "evidencias")
-- Estructura: <ruta>/<cliente>/<archivo>.jpg  ·  firmas/<ruta>/<archivo>.png
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('evidencias', 'evidencias', false)
on conflict (id) do nothing;

drop policy if exists evidencias_subir on storage.objects;
create policy evidencias_subir on storage.objects for insert to authenticated
  with check (
    bucket_id = 'evidencias' and (
      public.es_admin()
      or (storage.foldername(name))[1] = public.mi_ruta()
      or ((storage.foldername(name))[1] = 'firmas' and (storage.foldername(name))[2] = public.mi_ruta())
    )
  );

drop policy if exists evidencias_ver on storage.objects;
create policy evidencias_ver on storage.objects for select to authenticated
  using (
    bucket_id = 'evidencias' and (
      public.puede_ver_ruta((storage.foldername(name))[1])
      or ((storage.foldername(name))[1] = 'firmas' and public.puede_ver_ruta((storage.foldername(name))[2]))
    )
  );

-- =====================================================================
-- TRACK · MVP · Vistas y funciones de cálculo
-- =====================================================================

-- Último avance de volumen de cada cliente en el mes en curso
create or replace view public.v_avance_actual with (security_invoker = on) as
select distinct on (a.cliente_codigo) a.cliente_codigo, a.fecha_corte, a.cu
from public.avance_volumen a
where a.fecha_corte >= date_trunc('month', (now() at time zone 'America/Lima'))::date
order by a.cliente_codigo, a.fecha_corte desc;

-- Última visita efectiva de cada cliente
create or replace view public.v_ultima_visita with (security_invoker = on) as
select v.cliente_codigo, max(v.fecha) as fecha
from public.visitas v
where v.efectiva
group by v.cliente_codigo;

-- Fecha del último corte de volumen cargado ("Actualizado al")
create or replace function public.corte_volumen() returns date
language sql stable security definer set search_path = public as $$
  select max(fecha_corte) from public.avance_volumen
$$;

-- Al ingresar: marca el último ingreso y devuelve el perfil con su ruta
create or replace function public.registrar_ingreso()
returns table (id uuid, usuario text, nombre text, rol text, ruta_codigo text, region text, sala text, programas text[], activo boolean)
language plpgsql security definer set search_path = public as $$
begin
  update public.perfiles p set ultimo_ingreso = now() where p.id = auth.uid() and p.activo;
  return query
    select p.id, p.usuario, p.nombre, p.rol, p.ruta_codigo, r.region, r.sala, p.programas, p.activo
    from public.perfiles p left join public.rutas r on r.codigo = p.ruta_codigo
    where p.id = auth.uid();
end $$;

-- ---------------------------------------------------------------
-- Activación: el desarrollador cierra una propuesta
--   p_estado: 'act' (activado) · 'noapto' · 'noef' (visita no efectiva)
-- ---------------------------------------------------------------
create or replace function public.cerrar_propuesta(
  p_id uuid, p_estado text,
  p_evaluacion jsonb default null, p_potencial text default null, p_motivos text default null,
  p_firma text default null, p_tarjeta text default null, p_noef_motivo text default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_p public.propuestas;
  v_t public.tarjetas;
begin
  select * into v_p from public.propuestas where id = p_id for update;
  if not found then raise exception 'Propuesta no encontrada'; end if;
  if not (public.es_admin() or (public.mi_rol() = 'Desarrollador' and v_p.ruta_codigo = public.mi_ruta())) then
    raise exception 'La propuesta no corresponde a tu ruta';
  end if;
  if v_p.estado <> 'pend' then raise exception 'La propuesta ya fue cerrada'; end if;

  if p_estado = 'noef' then
    if coalesce(p_noef_motivo, '') = '' then raise exception 'Falta el motivo'; end if;
    insert into public.propuesta_intentos (propuesta_id, motivo) values (p_id, p_noef_motivo);
    update public.propuestas set noef_motivo = p_noef_motivo, noef_en = now() where id = p_id;
    return 'noef';
  elsif p_estado = 'noapto' then
    if coalesce(p_motivos, '') = '' then raise exception 'Faltan los motivos de no apto'; end if;
    update public.propuestas set estado = 'noapto', evaluacion = p_evaluacion, potencial = p_potencial,
      motivos = p_motivos, resuelto_por = auth.uid(), resuelto_en = now() where id = p_id;
    return 'noapto';
  elsif p_estado = 'act' then
    select * into v_t from public.tarjetas where upper(codigo) = upper(trim(p_tarjeta)) for update;
    if not found then raise exception 'La tarjeta % no existe', p_tarjeta; end if;
    if v_t.estado not in ('Disponible', 'Asignada') then raise exception 'La tarjeta % ya fue entregada o está anulada', v_t.codigo; end if;
    if v_t.ruta_codigo is not null and v_t.ruta_codigo <> v_p.ruta_codigo then raise exception 'La tarjeta % está asignada a otra ruta', v_t.codigo; end if;
    if p_firma is null then raise exception 'Falta la firma del cliente'; end if;
    update public.tarjetas set estado = 'Entregada', cliente_codigo = v_p.codigo_cliente, entregada_en = now(),
      ruta_codigo = coalesce(ruta_codigo, v_p.ruta_codigo) where codigo = v_t.codigo;
    update public.propuestas set estado = 'act', evaluacion = p_evaluacion, potencial = p_potencial, compromisos = true,
      firma = p_firma, firma_en = now(), tarjeta_codigo = v_t.codigo, resuelto_por = auth.uid(), resuelto_en = now() where id = p_id;
    -- el cliente activado entra a la cartera de la ruta (el administrador asigna su día de visita)
    insert into public.clientes (codigo, programa_id, nombre, direccion, distrito, region, sala, lat, lng, responsable, telefono, ruta_codigo, fecha_ingreso)
    values (v_p.codigo_cliente, v_p.programa_id, v_p.nombre, v_p.direccion, v_p.distrito, v_p.region, v_p.sala, v_p.lat, v_p.lng, v_p.responsable, v_p.telefono, v_p.ruta_codigo, (now() at time zone 'America/Lima')::date)
    on conflict (codigo) do nothing;
    return 'act';
  else
    raise exception 'Estado no válido';
  end if;
end $$;

-- ---------------------------------------------------------------
-- Dashboard: indicadores por ruta para un rango de fechas
-- ---------------------------------------------------------------
create or replace function public.dashboard_rutas(p_desde date, p_hasta date)
returns table (
  ruta text, region text, sala text, persona text, clientes int,
  plan int, efectivas int, no_efectivas int, fde_ok int, fotos_pend int,
  evaluadas int, activadas int,
  cuota_total numeric, cuota_esperada numeric, avance numeric,
  tuali_resp int, tuali_inst int, tuali_auto int
)
language sql stable security definer set search_path = public as $$
  with rv as (
    select r.* from public.rutas r
    where r.tipo = 'Desarrollador' and r.activa and r.codigo in (select public.rutas_visibles())
  ),
  hoy as (select (now() at time zone 'America/Lima')::date as d),
  dias as (
    select g::date as d from generate_series(p_desde, least(p_hasta, (select d from hoy)), interval '1 day') g
    where extract(isodow from g) < 7
  ),
  plan as (
    select c.ruta_codigo, count(*)::int as n
    from dias join public.clientes c on c.activo and c.dia_visita = extract(isodow from dias.d)
    where c.ruta_codigo in (select codigo from rv)
    group by c.ruta_codigo
  ),
  dia_cli as (   -- un registro por cliente y día: efectiva si hubo al menos una efectiva
    select v.ruta_codigo, v.cliente_codigo, v.fecha, bool_or(v.efectiva) as ef
    from public.visitas v
    where v.fecha between p_desde and p_hasta and v.ruta_codigo in (select codigo from rv)
    group by v.ruta_codigo, v.cliente_codigo, v.fecha
  ),
  vis as (
    select ruta_codigo, count(*) filter (where ef)::int as ef, count(*) filter (where not ef)::int as noef
    from dia_cli group by ruta_codigo
  ),
  vef as (
    select v.ruta_codigo,
      count(*) filter (where v.n_incumplimientos = 0)::int as fde_ok,
      count(*) filter (where v.revision = 'pend')::int as fotos_pend,
      count(*) filter (where v.tuali_instalado is not null)::int as t_resp,
      count(*) filter (where v.tuali_instalado)::int as t_inst,
      count(*) filter (where v.tuali_pedidos = 'auto')::int as t_auto
    from public.visitas v
    where v.efectiva and v.fecha between p_desde and p_hasta and v.ruta_codigo in (select codigo from rv)
    group by v.ruta_codigo
  ),
  prop as (
    select p.ruta_codigo, count(*)::int as ev, count(*) filter (where p.estado = 'act')::int as act
    from public.propuestas p
    where p.estado <> 'pend' and (p.resuelto_en at time zone 'America/Lima')::date between p_desde and p_hasta
    group by p.ruta_codigo
  ),
  meses as (
    select g::date as m from generate_series(date_trunc('month', p_desde), date_trunc('month', p_hasta), interval '1 month') g
  ),
  corte as (   -- último corte cargado en cada mes, sin pasar la fecha final
    select ms.m, max(a.fecha_corte) as fc
    from meses ms join public.avance_volumen a on a.fecha_corte >= ms.m and a.fecha_corte < (ms.m + interval '1 month') and a.fecha_corte <= p_hasta
    group by ms.m
  ),
  vol as (
    select c.ruta_codigo,
      sum(q.cuota_cu) as cuota_total,
      sum(q.cuota_cu * coalesce(extract(day from co.fc) / extract(day from (q.mes + interval '1 month' - interval '1 day')), 0)) as cuota_esp,
      sum(coalesce((select a.cu from public.avance_volumen a
                    where a.cliente_codigo = q.cliente_codigo and a.fecha_corte >= q.mes and a.fecha_corte <= coalesce(co.fc, q.mes - 1)
                    order by a.fecha_corte desc limit 1), 0)) as avance
    from public.cuotas q
    join meses ms on ms.m = q.mes
    join public.clientes c on c.codigo = q.cliente_codigo and c.ruta_codigo in (select codigo from rv)
    left join corte co on co.m = q.mes
    group by c.ruta_codigo
  ),
  ncli as (
    select ruta_codigo, count(*)::int as n from public.clientes where activo and ruta_codigo in (select codigo from rv) group by ruta_codigo
  ),
  per as (
    select distinct on (p.ruta_codigo) p.ruta_codigo, p.nombre
    from public.perfiles p where p.activo and p.rol = 'Desarrollador' and p.ruta_codigo is not null
    order by p.ruta_codigo, p.creado_en desc
  )
  select rv.codigo, rv.region, rv.sala, per.nombre, coalesce(ncli.n, 0),
    coalesce(plan.n, 0), coalesce(vis.ef, 0), coalesce(vis.noef, 0), coalesce(vef.fde_ok, 0), coalesce(vef.fotos_pend, 0),
    coalesce(prop.ev, 0), coalesce(prop.act, 0),
    coalesce(vol.cuota_total, 0), coalesce(vol.cuota_esp, 0), coalesce(vol.avance, 0),
    coalesce(vef.t_resp, 0), coalesce(vef.t_inst, 0), coalesce(vef.t_auto, 0)
  from rv
  left join plan on plan.ruta_codigo = rv.codigo
  left join vis on vis.ruta_codigo = rv.codigo
  left join vef on vef.ruta_codigo = rv.codigo
  left join prop on prop.ruta_codigo = rv.codigo
  left join vol on vol.ruta_codigo = rv.codigo
  left join ncli on ncli.ruta_codigo = rv.codigo
  left join per on per.ruta_codigo = rv.codigo
  order by rv.codigo
$$;

-- Motivos de no efectiva más frecuentes en un rango
create or replace function public.dashboard_motivos(p_desde date, p_hasta date, p_rutas text[] default null)
returns table (motivo text, n int)
language sql stable security definer set search_path = public as $$
  select coalesce(v.motivo, 'Sin motivo'), count(*)::int
  from public.visitas v
  where not v.efectiva and v.fecha between p_desde and p_hasta
    and v.ruta_codigo in (select public.rutas_visibles())
    and (p_rutas is null or v.ruta_codigo = any (p_rutas))
  group by 1 order by 2 desc
$$;

grant execute on function public.mi_rol, public.mi_ruta, public.es_admin, public.es_staff, public.rutas_visibles, public.puede_ver_ruta,
  public.corte_volumen, public.registrar_ingreso, public.cerrar_propuesta, public.dashboard_rutas, public.dashboard_motivos to authenticated;

-- ---------------------------------------------------------------
-- Permisos explícitos para la Data API (requerido por Supabase desde el 30-oct-2026).
-- La seguridad real la dan las reglas por fila (RLS) definidas arriba.
-- ---------------------------------------------------------------
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on
  public.programas, public.rutas, public.perfiles, public.catalogos, public.clientes, public.cliente_cambios,
  public.cuotas, public.avance_volumen, public.visitas, public.propuestas, public.propuesta_intentos,
  public.tarjetas, public.cargas
  to authenticated, service_role;
grant select on public.v_avance_actual, public.v_ultima_visita to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
