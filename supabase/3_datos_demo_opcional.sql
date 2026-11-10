-- =====================================================================
-- TRACK · MVP · Datos de demostración (OPCIONAL)
-- Úsalo solo para probar. Crea 12 rutas, 2 supervisiones, 720 clientes,
-- cuotas, avance, 3 semanas de visitas, propuestas y tarjetas.
-- Para borrar todo y empezar con datos reales ejecuta 4_borrar_datos.sql
-- =====================================================================
select setseed(0.42);

insert into public.rutas (codigo, tipo, region, sala, ruta_supervisor) values
  ('SUP-031', 'Supervisión', 'Lima Norte', 'Comas', null),
  ('SUP-044', 'Supervisión', 'Lima Este', 'Ate', null),
  ('DM-0214', 'Desarrollador', 'Lima Norte', 'Comas', 'SUP-031'),
  ('DM-0215', 'Desarrollador', 'Lima Norte', 'Comas', 'SUP-031'),
  ('DM-0216', 'Desarrollador', 'Lima Norte', 'Comas', 'SUP-031'),
  ('DM-0221', 'Desarrollador', 'Lima Norte', 'Los Olivos', 'SUP-031'),
  ('DM-0222', 'Desarrollador', 'Lima Norte', 'Los Olivos', 'SUP-031'),
  ('DM-0223', 'Desarrollador', 'Lima Norte', 'Los Olivos', 'SUP-031'),
  ('DM-0301', 'Desarrollador', 'Lima Este', 'Ate', 'SUP-044'),
  ('DM-0302', 'Desarrollador', 'Lima Este', 'Ate', 'SUP-044'),
  ('DM-0303', 'Desarrollador', 'Lima Este', 'Ate', 'SUP-044'),
  ('DM-0310', 'Desarrollador', 'Lima Este', 'San Juan de Lurigancho', 'SUP-044'),
  ('DM-0311', 'Desarrollador', 'Lima Este', 'San Juan de Lurigancho', 'SUP-044'),
  ('DM-0312', 'Desarrollador', 'Lima Este', 'San Juan de Lurigancho', 'SUP-044')
on conflict (codigo) do nothing;

-- Clientes: 60 por ruta, 10 por día de visita
with base as (
  select r.codigo as ruta, r.region, r.sala, n,
    (array['Bodega','Minimarket','Abarrotes','Comercial','Market'])[1 + (n % 5)] as pre,
    (array['Rosita','Don Lucho','El Sol','La Esquina','Mi Barrio','Santa Rosa','Los Andes','El Progreso','Doña Mary','San Judas','Las Flores','El Paraíso','Virgen del Carmen','El Triunfo','La Bendición','Don Pepe','El Porvenir','Los Pinos','La Familia','Las Palmeras','San Antonio','La Amistad','Mi Tiendita','Los Girasoles','El Rinconcito','Doña Juana','San Pedro','Las Gardenias','El Mirador','Don Beto'])[1 + ((n * 7 + length(r.codigo) * 3 + ascii(right(r.codigo, 1))) % 30)] as nom,
    (array['Jr. Las Begonias','Av. Túpac Amaru','Calle Los Jazmines','Jr. Huancavelica','Av. Universitaria','Calle Las Retamas','Jr. Los Cedros','Av. Naranjal'])[1 + (n % 8)] as calle,
    (array['Rosa','Luis','María','Jorge','Carmen','Víctor','Elena','Julio','Gladys','Pedro','Norma','César','Lucía','Raúl','Teresa','Hugo'])[1 + floor(random() * 16)::int] || ' ' ||
    (array['Quispe','Huamán','Flores','Mendoza','Rojas','Chávez','Castillo','Vargas','Ramos','Torres','Salazar','Paredes','Cárdenas','Mamani'])[1 + floor(random() * 14)::int] as resp,
    case r.sala when 'Comas' then -11.935 when 'Los Olivos' then -11.975 when 'Ate' then -12.035 else -11.995 end as lat0,
    case r.sala when 'Comas' then -77.055 when 'Los Olivos' then -77.070 when 'Ate' then -76.925 else -77.005 end as lng0
  from public.rutas r cross join generate_series(1, 60) n
  where r.tipo = 'Desarrollador'
)
insert into public.clientes (codigo, nombre, direccion, distrito, region, sala, lat, lng, responsable, telefono, ruta_codigo, dia_visita, fecha_ingreso)
select
  (floor(power(10, 5 + floor(random() * 4)) * (1 + random() * 8.9)))::bigint::text || n,
  pre || ' ' || nom, calle || ' ' || (110 + floor(random() * 880))::int, sala, region, sala,
  round((lat0 + (random() - 0.5) * 0.03)::numeric, 6), round((lng0 + (random() - 0.5) * 0.03)::numeric, 6),
  resp, '9' || lpad(floor(random() * 100000000)::bigint::text, 8, '0'), ruta, 1 + (n % 6),
  (date_trunc('month', current_date) - (floor(random() * 5) || ' months')::interval)::date
from base
on conflict (codigo) do nothing;

-- Cuotas de los últimos 3 meses
insert into public.cuotas (cliente_codigo, mes, cuota_cu)
select c.codigo, m::date, 12 + floor(random() * 30)
from public.clientes c cross join generate_series(date_trunc('month', current_date) - interval '2 months', date_trunc('month', current_date), interval '1 month') m
on conflict do nothing;

-- Avance acumulado: un corte cada 3 días; el mes en curso hasta hace 3 días
insert into public.avance_volumen (cliente_codigo, fecha_corte, cu)
select q.cliente_codigo, d::date,
  round(q.cuota_cu * (extract(day from d) / extract(day from (q.mes + interval '1 month' - interval '1 day'))) * (0.75 + random() * 0.45))
from public.cuotas q
cross join lateral generate_series(q.mes + interval '2 days', least(q.mes + interval '1 month' - interval '1 day', current_date - 3), interval '3 days') d
on conflict do nothing;

-- Visitas de las últimas 3 semanas (hasta ayer)
insert into public.visitas (cliente_codigo, ruta_codigo, fecha, inicio, fin, efectiva, motivo, distancia_m, fde, skus, n_incumplimientos, pedido_tuali, tuali_instalado, tuali_pedidos)
select c.codigo, c.ruta_codigo, c.d::date,
  c.d + interval '8 hours' + (random() * interval '8 hours'), c.d + interval '8 hours 15 minutes' + (random() * interval '8 hours'),
  ef, case when ef then null else (array['Cliente cerrado','Cliente cerrado','Cliente ausente','Volver más tarde','Otro'])[1 + floor(random() * 5)::int] end,
  case when ef then 5 + floor(random() * 45)::int else null end,
  case when ef then jsonb_build_object('RACK', case when random() < 0.9 then 'si' else 'no' end, 'VIS', case when random() < 0.9 then 'si' else 'no' end, 'PREC', case when random() < 0.92 then 'si' else 'no' end, 'POP', 'na') end,
  case when ef then jsonb_build_object('CCIK296','si','CCIK1L', case when random() < 0.85 then 'si' else 'no' end,'SL500','si','SLS625', case when random() < 0.9 then 'si' else 'no' end,'FR350','si') end,
  null, null,
  case when ef then random() < 0.65 end,
  null
from (
  select c.codigo, c.ruta_codigo, d, (random() < 0.88) as ef
  from public.clientes c
  cross join generate_series(current_date - 21, current_date - 1, interval '1 day') d
  where extract(isodow from d) = c.dia_visita
) c;

update public.visitas set
  n_incumplimientos = (select count(*) from jsonb_each_text(fde) where value = 'no') + case when exists (select 1 from jsonb_each_text(skus) where value = 'no') then 1 else 0 end,
  pedido_tuali = exists (select 1 from jsonb_each_text(skus) where value = 'no') and random() < 0.7,
  tuali_pedidos = case when tuali_instalado then (array['auto','asist','no'])[1 + floor(random() * 3)::int] end
where efectiva;

update public.visitas set revision = case when random() < 0.97 then 'ok' else 'rej' end,
  motivo_rechazo = null
where efectiva and fecha < current_date - 2;
update public.visitas set motivo_rechazo = 'Foto borrosa' where revision = 'rej';

-- Propuestas: 6 por ruta (4 por evaluar, 1 activada, 1 no apta)
insert into public.propuestas (codigo_cliente, nombre, direccion, distrito, region, sala, lat, lng, responsable, telefono, asesor, fecha_propuesta, ruta_codigo, estado, motivos, resuelto_en)
select '2045' || lpad((row_number() over ())::text, 5, '0'),
  (array['Bodega Santa Teresita','Minimarket Los Ángeles','Bodega Mi Esperanza','Abarrotes El Buen Vecino','Bodega Doña Rosa','Bodega San Martín'])[n],
  (array['Jr. Los Nogales 318','Av. Túpac Amaru 1452','Calle Las Moras 127','Jr. Ayacucho 905','Calle Los Tulipanes 266','Av. Universitaria 3310'])[n],
  r.sala, r.region, r.sala,
  case r.sala when 'Comas' then -11.935 when 'Los Olivos' then -11.975 when 'Ate' then -12.035 else -11.995 end + (random() - 0.5) * 0.02,
  case r.sala when 'Comas' then -77.055 when 'Los Olivos' then -77.070 when 'Ate' then -76.925 else -77.005 end + (random() - 0.5) * 0.02,
  (array['Teresa Ramos','Julio Paredes','Gladys Huamán','Raúl Cárdenas','Rosa Mamani','Hugo Salazar'])[n],
  '9' || lpad(floor(random() * 100000000)::bigint::text, 8, '0'), 'Asesor ruta ' || (100 + n), current_date - (n % 4),
  r.codigo, case n when 5 then 'act' when 6 then 'noapto' else 'pend' end,
  case n when 6 then 'Sin espacio para rack' end, case when n >= 5 then now() - interval '2 days' end
from public.rutas r cross join generate_series(1, 6) n
where r.tipo = 'Desarrollador';

-- Tarjetas: 20 por ruta
insert into public.tarjetas (codigo, lote, fecha_recepcion, ruta_codigo, estado)
select 'INC-' || lpad((126000 + row_number() over (order by r.codigo, n))::text, 9, '0'), 'L-DEMO', current_date - 10, r.codigo, 'Asignada'
from public.rutas r cross join generate_series(1, 20) n
where r.tipo = 'Desarrollador'
on conflict do nothing;
