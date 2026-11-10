-- =====================================================================
-- TRACK · Crear tu usuario administrador (una sola vez)
-- Antes: Supabase → Authentication → Users → Add user → Create new user
--   Email: admin@track.local · Password: la que elijas · marcar "Auto Confirm User"
-- Luego ejecuta esto (cambia el nombre si quieres). Ingresarás con usuario: admin
-- =====================================================================
insert into public.perfiles (id, usuario, nombre, rol)
select id, 'admin', 'Luis Miguel', 'Administrador'
from auth.users where email = 'admin@track.local'
on conflict (id) do update set rol = 'Administrador', activo = true;

select usuario, nombre, rol from public.perfiles where usuario = 'admin';
