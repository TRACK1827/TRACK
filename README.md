# TRACK · MVP web

Web para dar seguimiento a la ejecución en campo de los programas comerciales de Arca Continental Lindley. Hoy está configurado **Incubadoras**; Prospecta, Embajador de Retornabilidad y Embajadores TUALI aparecen como «Disponible en la siguiente fase».

Una sola dirección web para todos. Según quién ingresa:

| Rol | Qué ve |
|---|---|
| Desarrollador | Web del celular: Activación, Plan de visita por día, Cartera y Desempeño de su ruta |
| Supervisor | Portal: dashboard, verificación de fotos, clientes y descargas de sus rutas |
| Administrador | Portal completo: además, Usuarios y Cargas Excel |
| Gerencia | Portal en solo lectura |

**Piezas:**

- **GitHub** guarda el código.
- **Netlify** publica la web y la función segura de usuarios.
- **Supabase** guarda los datos, los accesos y las fotos.

---

## Publicarlo paso a paso (≈ 40 minutos, una sola vez)

### Paso 1 · Supabase (base de datos)

1. Entra a [supabase.com](https://supabase.com), crea una cuenta y luego **New project**:
   - **Nombre:** `track`.
   - **Región:** la más cercana (por ejemplo *São Paulo*).
   - **Database password:** una contraseña que guardes.
2. Cuando termine de crearse, ve a **SQL Editor → New query**. Abre el archivo `supabase/1_instalar.sql`, copia **todo** su contenido, pégalo y presiona **Run**. Debe terminar sin errores en rojo.
3. *(Opcional, para probar con datos de ejemplo)* Haz lo mismo con `supabase/3_datos_demo_opcional.sql`. Crea:
   - 12 rutas y 2 supervisiones.
   - 720 clientes.
   - 3 semanas de visitas.
   - Propuestas y tarjetas.

   Cuando vayas a cargar datos reales, ejecuta `supabase/4_borrar_datos.sql`.
4. Crea tu usuario administrador:
   1. Ve a **Authentication → Users → Add user → Create new user**.
   2. **Email:** `admin@track.local`.
   3. **Password:** la tuya.
   4. Marca **Auto Confirm User** y presiona **Create user**.
   5. Vuelve al **SQL Editor** y ejecuta `supabase/2_primer_administrador.sql`. Si quieres, cambia antes el nombre «Luis Miguel».
   6. Tu usuario para ingresar será **admin**.
5. Copia tus llaves en **Project Settings → API Keys**. Las necesitarás en el paso 3:
   - **Project URL** (algo como `https://abcd1234.supabase.co`). Está en **Project Settings → Data API** o en el botón **Connect**.
   - **Publishable key** (`sb_publishable_…`). Si tu proyecto muestra las llaves *legacy*, usa la **anon public**.
   - **Secret key** (`sb_secret_…`). Si son legacy, usa la **service_role**.
   - **La llave secreta nunca se comparte ni se pone en el código.**

### Paso 2 · GitHub (código)

1. Entra a [github.com](https://github.com), crea una cuenta y luego **New repository**:
   - **Nombre:** `track-mvp`.
   - **Visibilidad:** **Private**.
   - Créalo vacío.
2. En la página del repositorio vacío elige **uploading an existing file**.
3. Descomprime el zip de TRACK y **arrastra el contenido de la carpeta** (no la carpeta misma): `src`, `public`, `supabase`, `netlify`, `index.html`, `package.json`, `package-lock.json`, `netlify.toml`, `vite.config.js`, `.gitignore` y `README.md`.
4. Presiona **Commit changes**.

> Si `.gitignore` no aparece al arrastrar, no pasa nada: no es obligatorio.

### Paso 3 · Netlify (publicación)

1. Entra a [netlify.com](https://www.netlify.com) con tu cuenta de GitHub.
2. Ve a **Add new project → Import an existing project → GitHub** y elige `track-mvp`.
3. Netlify lee la configuración sola desde `netlify.toml`:
   - **Build command:** `npm run build`.
   - **Publish directory:** `dist`.
   - **Functions:** `netlify/functions`.

   No cambies nada.
4. Antes de publicar (o luego en **Project configuration → Environment variables**), agrega estas 3 variables:

| Variable | Valor |
|---|---|
| `VITE_SUPABASE_URL` | Tu Project URL |
| `VITE_SUPABASE_ANON_KEY` | Tu Publishable key (o anon public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Tu Secret key (o service_role). Marca la opción de valor secreto si aparece |

5. Presiona **Deploy**. En 1–2 minutos tendrás una dirección como `https://track-xxxx.netlify.app`. Puedes cambiarla en **Domain management**, por ejemplo a `track-incubadoras.netlify.app`.
6. Si agregaste o cambiaste variables después del primer deploy, ve a **Deploys → Trigger deploy → Deploy site** para que tomen efecto.

### Paso 4 · Primer uso

1. Abre tu dirección de Netlify e ingresa con **admin** y tu contraseña.
2. Si no usaste los datos de ejemplo, ve a **Cargas Excel** y sube tus datos en este orden:
   1. **Rutas**.
   2. Catálogos (ya vienen cargados).
   3. **Cartera**.
   4. **Propuestas**.
   5. **Cuotas**.
   6. **Avance de volumen**.
   7. **Tarjetas**.

   El botón **Plantilla** descarga el Excel modelo, y puedes subir ese mismo archivo completo: el portal lee la hoja que corresponde.
3. En **Usuarios → Nuevo usuario** crea a cada desarrollador con su ruta:
   1. Presiona **Generar** para crear la contraseña.
   2. Presiona **Crear usuario**.
   3. Usa **Copiar acceso** para enviársela por WhatsApp.
4. El desarrollador abre la misma dirección en su celular e ingresa. Para tenerla como app, en Chrome usa **⋮ → Agregar a pantalla principal**; en iPhone, **Compartir → Agregar a inicio**.

---

## Cómo funcionan los accesos

- Cada persona ingresa con **usuario y contraseña**. Por dentro, el usuario `crios` se guarda como `crios@track.local`. No se envían correos.
- **Las contraseñas se guardan cifradas.** Nadie puede verlas después, ni el administrador. Se ven solo al crearlas o cambiarlas, para compartirlas en ese momento. Si alguien la olvida, usa **Usuarios → Editar → Cambiar contraseña**.
- **Una ruta tiene un solo desarrollador activo.** Si asignas la ruta a otra persona, la anterior queda inactiva y ya no puede ingresar. La cartera, cuotas e historial siguen en la ruta.
- **Usuario inactivo** = no puede ingresar. Se reactiva desde Editar.
- La seguridad está en la base de datos:
  - Un desarrollador solo puede leer y registrar en su ruta.
  - Un supervisor solo ve las rutas que supervisa.
  - Desde campo solo se edita el responsable del negocio y su teléfono.
  - Todo cambio en clientes queda en el historial.

## Reglas que conviene saber

- **Plan del día:** clientes activos de la ruta cuyo **día de visita** es hoy (lunes a sábado).
- **Efectividad de visita:** visitas efectivas ÷ visitas del plan.
- **Volumen:** CU acumuladas ÷ cuota esperada a la fecha del último corte («Actualizado al»).
- **GPS:** la visita se valida a 50 m del cliente. Si está más lejos o sin GPS, igual se registra y se marca en rojo en **Verificar fotos**.
- **Fotos:** se comprimen en el celular antes de subir (≈ 200 KB). Se revisan en **Verificar fotos** y se descargan en ZIP.
- **Cliente activado:** entra a la cartera de la ruta **sin día de visita**. En **Clientes**, el botón «Sin día de visita» muestra los que debes completar.
- **Necesita internet:** si se cae la señal al cerrar la visita, sale un mensaje y basta con volver a presionar «Cerrar visita». Las fotos no se pierden mientras no se salga de la pantalla.

## Límites del plan gratuito (referencia)

- Supabase Free: 500 MB de base de datos y 1 GB de archivos.
- Con fotos de ≈ 200 KB, 1 GB alcanza para unas 2.500 visitas con 2 fotos cada una. Para operar en serio conviene el **plan Pro de Supabase**.
- Netlify Free alcanza para este uso.

## Actualizar la web

1. Cambia los archivos en GitHub (**Add file → Upload files** reemplaza los que subas).
2. Netlify vuelve a publicar solo en 1–2 minutos.
3. Si cambia la base de datos, vuelve a ejecutar `supabase/1_instalar.sql`. Se puede repetir sin perder datos.

## Para un programador

```bash
npm install
cp .env.example .env   # completar las llaves
npm run dev            # web local (la función de usuarios requiere `netlify dev`)
```

- **Front:** React + Vite.
- **Datos:** Supabase (Postgres con RLS, Auth y Storage, bucket privado `evidencias`).
- **Función:** `netlify/functions/admin-users.mjs`. Crea y edita usuarios con la llave secreta y solo atiende a un Administrador.
- **Cálculo del dashboard:** `dashboard_rutas(desde, hasta)` en SQL.
