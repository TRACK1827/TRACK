# TRACK · Guía para desarrolladores

Esta guía explica qué es TRACK, cómo está construido y cómo levantarlo en otra computadora o en una cuenta nueva. Para el uso diario por rol, ver `Manual_TRACK.pdf` en esta misma carpeta.

---

## 1. Qué es TRACK

TRACK es una web para seguir la ejecución en campo de los programas comerciales de Arca Continental Lindley (Perú). Hoy solo está configurado **Incubadoras**. Prospecta, Embajador de Retornabilidad y Embajadores TUALI existen en la tabla `programas` con `activo = false` y se muestran como «Disponible en la siguiente fase».

Todos los usuarios usan **una sola dirección web**, y la pantalla depende del rol:

| Rol | Interfaz | Alcance |
|---|---|---|
| Desarrollador | App de campo (celular) | Solo su ruta: plan de visita, visitas con fotos y GPS, activación de clientes nuevos, cartera y desempeño |
| Supervisor | Portal (escritorio) | Rutas cuya `ruta_supervisor` es su ruta de supervisión: dashboard, revisión de fotos, consulta de clientes y descargas |
| Administrador | Portal | Todo, más usuarios, cargas Excel y edición de clientes |
| Gerencia | Portal | Todo en solo lectura |

### Flujo de negocio

1. El Administrador carga en Excel las rutas, la cartera (clientes con día de visita), las propuestas de Comercial, las cuotas mensuales, el avance de volumen y las tarjetas.
2. El Desarrollador ve por defecto los clientes cuyo `dia_visita` es hoy, puede seleccionar otro día de lunes a sábado para adelantar visitas, y registra la visita: check-in GPS (radio de 50 m), disponibilidad de SKU, FDE (Foto de Éxito), digitalización TUALI, fotos de fachada y rack, evidencia EDF, y cierre. Una visita puede ser no efectiva, con motivo.
3. En **Activación**, el Desarrollador evalúa las propuestas: apto o no apto, compromiso firmado y entrega de tarjeta. Al activarse, el cliente entra a la cartera sin día de visita.
4. El Supervisor aprueba o rechaza las fotos de cada visita efectiva.
5. El dashboard calcula efectividad, ejecución FDE, volumen vs cuota y activaciones por ruta y periodo.

---

## 2. Arquitectura

```
Navegador (React SPA)  ──supabase-js──▶  Supabase
   │                                     ├─ Postgres + RLS (datos y permisos)
   │                                     ├─ Auth (usuario → usuario@track.local)
   │                                     └─ Storage (bucket privado "evidencias")
   │
   └──fetch──▶ Netlify Function  admin-users  ──service_role──▶ Supabase Auth Admin API
```

- **Front:** React 18 + Vite 5, sin router ni librería de UI; estilos propios en `src/styles.css`. Se publica como sitio estático en Netlify.
- **Datos y seguridad:** todo vive en Supabase. **Los permisos están en la base de datos** (RLS, triggers y funciones `security definer`), no en el front: el front solo esconde lo que el rol no puede usar.
- **Función serverless:** crear y editar usuarios requiere la llave `service_role`, que nunca llega al navegador. Por eso existe `netlify/functions/admin-users.mjs`, que valida que quien llama sea un Administrador activo.
- **Librerías:** `@supabase/supabase-js`; `xlsx` (SheetJS) para leer y escribir Excel; `jszip` para el ZIP de fotos. Las dos últimas se cargan bajo demanda.

### Producción actual (referencia)

| Pieza | Valor |
|---|---|
| Sitio | https://ac-track.netlify.app (Netlify, publica desde GitHub `main`) |
| Repositorio | GitHub privado `track-mvp` |
| Supabase | Proyecto en región us-east-1 |

Las llaves **no** están en este paquete. Se piden al responsable o se generan en un proyecto nuevo.

---

## 3. Estructura del repositorio

```
track-mvp/
├─ index.html, vite.config.js, package.json, netlify.toml
├─ .env.example                 Variables de entorno (copiar a .env)
├─ public/                      Logo, íconos PWA, manifest, plantilla Excel de cargas
├─ netlify/functions/
│   └─ admin-users.mjs          Crear y editar usuarios (solo Administrador)
├─ supabase/
│   ├─ 1_instalar.sql           Esquema, RLS, triggers, storage y funciones (idempotente)
│   ├─ 2_primer_administrador.sql  Vincula el primer usuario admin a su perfil
│   ├─ 3_datos_demo_opcional.sql   12 rutas, 720 clientes, 3 semanas de visitas
│   ├─ 4_borrar_datos.sql          Limpia datos operativos (mantiene catálogos)
│   └─ 5_cambiar_skus.sql          Reemplaza la lista de SKU de Disponibilidad
├─ src/
│   ├─ main.jsx, App.jsx        Arranque; sesión → perfil → DevApp o Portal según rol
│   ├─ Login.jsx                Usuario + contraseña (usuario → usuario@track.local)
│   ├─ Icon.jsx, styles.css
│   ├─ lib/
│   │   ├─ supabase.js          Cliente, mensajes de error, paginación, Storage, llamada a la función
│   │   ├─ device.js            GPS, distancia, compresión de fotos (RADIO_M = 50)
│   │   ├─ fmt.js               Fechas y formatos en español
│   │   └─ xlsx-io.js           Lectura y escritura de Excel y normalizadores
│   ├─ dev/                     App de campo (Desarrollador)
│   │   ├─ DevApp.jsx           Menú de programas y pestañas Activación, Plan, Cartera, Desempeño
│   │   ├─ data.js              Carga de datos de la ruta y alertas
│   │   ├─ Visita.jsx           Flujo de visita (check-in → SKU → FDE → TUALI → fotos → cierre)
│   │   ├─ ActFlow.jsx          Flujo de activación (evaluación → compromiso → firma → tarjeta)
│   │   ├─ Ficha.jsx, Mapa.jsx, Desempeno.jsx, ui.jsx
│   └─ portal/                  Portal (Supervisor, Administrador, Gerencia)
│       ├─ Portal.jsx           Menú, filtros (periodo, región, sala, ruta), rutas visibles
│       ├─ Dashboard.jsx        Indicadores (RPC dashboard_rutas / dashboard_motivos)
│       ├─ Fotos.jsx            Revisión de evidencia
│       ├─ Clientes.jsx         Consulta y edición
│       ├─ Usuarios.jsx         Alta y edición vía la función admin-users
│       ├─ Cargas.jsx           Validación y upsert de las plantillas Excel
│       └─ Descargas.jsx        Reportes XLSX y ZIP de fotos
└─ docs/
    ├─ DESARROLLADOR.md         Este documento
    └─ Manual_TRACK.pdf         Manual de uso por rol
```

---

## 4. Modelo de datos (Postgres, esquema `public`)

| Tabla | Clave | Para qué |
|---|---|---|
| `programas` | `id` (`inc`, `pro`, `ret`, `tua`) | Programas; solo `inc` activo |
| `rutas` | `codigo` | Estructura fija. `tipo` = Desarrollador o Supervisión; `ruta_supervisor` apunta a la ruta de supervisión |
| `perfiles` | `id` = `auth.users.id` | Usuario, nombre, `rol`, `ruta_codigo`, `programas[]`, `activo` |
| `catalogos` | (`programa_id`, `tipo`, `codigo`) | Listas configurables: SKU, Ítem FDE, Ítem evaluación, Motivo no efectiva, Motivo no apto, Incidencia, Motivo rechazo foto |
| `clientes` | `codigo` | Cartera: ubicación, responsable, `ruta_codigo`, `dia_visita` (1 = lunes … 6 = sábado), `activo` |
| `cliente_cambios` | `id` | Historial de ediciones (lo llena un trigger) |
| `cuotas` | (`cliente_codigo`, `mes`) | Cuota en CU por cliente y mes (`mes` = día 1) |
| `avance_volumen` | (`cliente_codigo`, `fecha_corte`) | CU acumuladas del mes a la fecha de corte |
| `visitas` | `id` uuid | Una por intento: efectiva o no, GPS, distancia, `skus` y `fde` (jsonb), TUALI, incidencias, rutas de fotos, `revision` (`pend`, `ok`, `rej`) |
| `propuestas` | `id` uuid | Propuestas de Comercial y su resultado (`pend`, `act`, `noapto`), evaluación, firma y tarjeta |
| `propuesta_intentos` | `id` | Visitas de activación no efectivas |
| `tarjetas` | `codigo` | Tarjetas del programa: Disponible, Asignada, Entregada, Anulada |
| `cargas` | `id` | Bitácora de cargas Excel |

**Vistas** (`security_invoker`): `v_avance_actual` (último corte por cliente) y `v_ultima_visita` (última visita efectiva por cliente).

**Storage:** bucket privado `evidencias`.

- Fotos de visita: `{ruta}/{cliente}/{fecha}_{fachada|rack}_{id}.jpg`.
- Firmas: `firmas/{ruta}/{cliente}_{id}.png`.
- Se leen con URLs firmadas de 1 hora.

### Seguridad (RLS y funciones)

- **Funciones auxiliares:**
  - `mi_rol()` y `mi_ruta()`.
  - `es_admin()`.
  - `es_staff()`: Administrador, Gerencia o Supervisor.
  - `rutas_visibles()` y `puede_ver_ruta(ruta)`. El Supervisor ve las rutas con `ruta_supervisor = mi_ruta()`; el Desarrollador ve solo la suya.
- **Triggers:**
  - `tg_visitas_insert` impide registrar en otra ruta o con clientes ajenos, fija `usuario_id` y pone `revision = 'pend'` en las efectivas.
  - `tg_visitas_update` deja cambiar solo los campos de revisión a quien no es admin.
  - `tg_clientes_cambios` escribe el historial en `cliente_cambios`.
- **Política `clientes_campo`:** el Desarrollador solo puede actualizar clientes de su ruta. El front limita la edición a responsable y teléfono.
- **RPC:**
  - `registrar_ingreso()`: perfil y último ingreso.
  - `cerrar_propuesta(...)`: activación transaccional que valida la tarjeta, la marca como Entregada e inserta el cliente.
  - `dashboard_rutas(desde, hasta)`, `dashboard_motivos(...)` y `corte_volumen()`.
- **Grants:** al final de `1_instalar.sql` hay grants explícitos para `authenticated` y `service_role`, que Supabase exige para tablas nuevas desde octubre de 2026.

---

## 5. Autenticación y usuarios

- **Ingreso:** se usa **usuario y contraseña**. El usuario `crios` se guarda en Auth como `crios@track.local` (dominio en `VITE_LOGIN_DOMAIN`). No se envían correos. Si se escribe un texto con «@», se usa tal cual.
- **Usuarios inactivos:** se bloquean con `ban_duration` de unos 100 años en Auth, además de `perfiles.activo = false`.
- **Una ruta, un desarrollador:** al asignar una ruta de Desarrollador a alguien, la función desactiva al anterior y le quita la ruta.
- **Contraseñas:** quedan cifradas en Auth. El portal solo las muestra al crearlas o cambiarlas.
- **Primer administrador:**
  1. Se crea a mano en Supabase: Authentication → Add user, `admin@track.local`, Auto Confirm.
  2. Se ejecuta `2_primer_administrador.sql`.

---

## 6. Reglas de cálculo

| Indicador | Fórmula | Umbral en rojo |
|---|---|---|
| Plan del día | Clientes activos de la ruta con `dia_visita` = día de hoy | — |
| Efectividad de visita | Visitas efectivas ÷ visitas del plan | < 85 % |
| Ejecución FDE | Efectivas con `n_incumplimientos = 0` ÷ efectivas | < 80 % |
| Volumen vs cuota | CU acumuladas al último corte ÷ (cuota × día del corte ÷ días del mes) | < 90 % |
| Alerta «Bajo cuota» | Avance < 85 % de la cuota esperada al corte | — |
| Alerta «Sin visita» | 8 días o más desde la última visita efectiva | — |
| GPS | Check-in válido a ≤ 50 m; si no, se registra igual y se marca | — |

Las fotos se comprimen en el celular a un máximo de 1280 px con calidad JPEG 0.75, unos 200 KB. La zona horaria de negocio es `America/Lima`.

---

## 7. Levantarlo en otra computadora

### Requisitos

- Node.js 20 o superior (Netlify usa 22, ver `netlify.toml`).
- Una cuenta de Supabase (el plan gratuito sirve para desarrollo).
- Opcional: Netlify CLI, para probar la función de usuarios en local.

### Pasos

```bash
# 1. Dependencias
npm install

# 2. Base de datos: crear un proyecto en supabase.com y, en SQL Editor, ejecutar en orden:
#    supabase/1_instalar.sql
#    (crear admin@track.local en Authentication → Users, con Auto Confirm)
#    supabase/2_primer_administrador.sql
#    supabase/3_datos_demo_opcional.sql   ← opcional, para tener datos de prueba

# 3. Variables de entorno
cp .env.example .env
#    VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (publishable), SUPABASE_SERVICE_ROLE_KEY (secret)

# 4. Web en local (todo menos crear y editar usuarios)
npm run dev                # http://localhost:5173

# 5. Web + función de usuarios en local
npx netlify-cli dev        # http://localhost:8888

# 6. Build de producción
npm run build              # genera dist/
```

> Para probar la app de campo en un celular, usa la URL de Netlify o un túnel con HTTPS: el GPS y la cámara solo funcionan en HTTPS o en `localhost`.

### Publicar en una cuenta nueva

1. Sube el repositorio a GitHub.
2. En Netlify: **Import from GitHub**. `netlify.toml` define el build, el directorio de funciones, Node 22 y la redirección de la SPA.
3. Agrega las variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` (marcar esta última como secreta).
4. Deploy. Si cambias variables después, usa **Trigger deploy**.

El paso a paso para alguien no técnico está en `README.md`.

---

## 8. Tareas de mantenimiento frecuentes

| Tarea | Cómo |
|---|---|
| Cambiar la lista de SKU u otros catálogos | `supabase/5_cambiar_skus.sql`, o la hoja `Catalogos` en Cargas Excel (activo «No» oculta un ítem) |
| Cambio en el esquema | Editar `1_instalar.sql` de forma idempotente (`if not exists`, `create or replace`) y volver a ejecutarlo |
| Limpiar datos antes de un piloto | `supabase/4_borrar_datos.sql` y vaciar el bucket `evidencias` |
| Agregar un programa | `programas.activo = true`, sus catálogos con su `programa_id`, y sus pantallas en `src/dev` y `src/portal` (hoy el flujo está hecho para `inc`) |
| Cambiar el radio GPS | `RADIO_M` en `src/lib/device.js` |
| Cambiar los umbrales del dashboard | `src/portal/Dashboard.jsx` y `alertas()` en `src/dev/data.js` |

---

## 9. Problemas ya resueltos (para no repetirlos)

- **«No se pudo completar la operación» al crear usuarios.** En Node 20 la función fallaba porque supabase-js intenta abrir un WebSocket de Realtime. Se resolvió con dos cambios:
  - En la función, `realtime: { transport: NoSocket }`.
  - `NODE_VERSION = "22"` en `netlify.toml`.
- **Variables de Netlify.** Revisar que el nombre sea exacto y el valor completo, sin espacios ni texto extra. Solo `SUPABASE_SERVICE_ROLE_KEY` se marca como secreta, porque las `VITE_` deben estar disponibles en el build.
- **Aviso de Supabase al ejecutar el SQL demo («create table without RLS»).** Es un falso positivo: elegir «Run and enable RLS».

---

## 10. Límites conocidos y siguientes pasos sugeridos

- **Sin modo sin conexión.** Si se cae la señal al cerrar una visita, el usuario reintenta sin salir de la pantalla. Un siguiente paso natural es una cola local con IndexedDB y un service worker.
- **El portal trae los datos completos por páginas de 1000 filas** (`fetchAll`). Con varias decenas de miles de visitas conviene mover más agregados a SQL.
- **Solo Incubadoras está implementado.** Los otros programas comparten el modelo (`programa_id`), pero necesitan sus flujos.
- **Plan de Supabase:** el gratuito incluye 1 GB de Storage, unas 2.500 visitas con 2 fotos. Para operar conviene el plan Pro.
- **No hay pruebas automatizadas.** Se validó de punta a punta de forma manual: login por rol, visita, activación, revisión, cargas, descargas y RLS.
