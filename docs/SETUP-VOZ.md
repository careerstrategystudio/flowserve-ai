# FlowServe Voice: guía de montaje paso a paso

Esto deja funcionando la recepcionista por teléfono con el negocio demo (Halden Wellness Studio).

- **Tiempo:** 45–60 minutos en total. El paso 8 (número irlandés) depende de que Twilio apruebe los papeles, que tarda de 1 a 3 días hábiles.
- **Coste:** €0 hasta el paso 8. Después, unos €2/mes por el número, más los minutos que se usen.

> **Regla de oro:** las claves (API keys, contraseñas, el JSON de Google) solo se pegan en **Vercel → Environment Variables**. Nunca en el chat, en GitHub ni en un email.

---

## 1. Supabase: la base de datos (gratis, en la UE)

1. Entra en https://supabase.com y pulsa **Start your project**. Regístrate con tu cuenta de GitHub.
2. Pulsa **New project**:
   - **Name:** `flowserve`
   - **Database Password:** pulsa *Generate* y guárdala en tu gestor de contraseñas.
   - **Region:** `West EU (Ireland)`.
   - Pulsa **Create new project** y espera unos 2 minutos.
3. Menú izquierdo → **SQL Editor** → **New query**. Pega el contenido de `supabase/schema.sql`, entero, y pulsa **Run**. Tiene que salir *Success*.
4. Menú izquierdo → **Authentication** → **URL Configuration**:
   - **Site URL:** `https://flowserve-ai.vercel.app`
   - **Redirect URLs** → **Add URL:** `https://flowserve-ai.vercel.app/app/`
5. Menú izquierdo → **Project Settings** → **API** (o **API Keys**). Deja esa pestaña abierta: en el paso 4 vas a copiar de ahí:
   - **Project URL**
   - la clave **anon / public**
   - la clave **service_role / secret**. Esta es secreta.

## 2. Google: permiso para usar el calendario (gratis)

Sirve para que la recepcionista vea los huecos y apunte citas, sin tocar tu calendario personal.

1. Entra en https://console.cloud.google.com con tu Gmail.
2. Arriba, en el selector de proyecto → **New project** → nombre `flowserve-voice` → **Create**. Luego selecciónalo.
3. Activa la API del calendario:
   - En el buscador de arriba escribe **Google Calendar API**.
   - Ábrela y pulsa **Enable**.
4. Crea la cuenta de servicio:
   - Menú → **IAM & Admin** → **Service Accounts** → **+ Create service account**.
   - Nombre: `flowserve-calendar`.
   - Pulsa **Create and continue**, luego **Done**. No hace falta darle roles.
5. Crea la clave:
   - Pulsa la cuenta que acabas de crear → pestaña **Keys** → **Add key** → **Create new key** → **JSON** → **Create**.
   - Se descarga un archivo `.json`. **Guárdalo bien, es una llave.**
   - Apunta el email de la cuenta. Es algo como `flowserve-calendar@flowserve-voice.iam.gserviceaccount.com`.
6. Crea un calendario nuevo solo para la demo:
   - Ve a https://calendar.google.com.
   - A la izquierda, **Otros calendarios** → **+** → **Crear calendario**.
   - Nombre: `FlowServe Demo`. Pulsa **Crear**.
7. Comparte ese calendario con la cuenta de servicio:
   - Abre la configuración de **FlowServe Demo** → **Compartir con personas específicas** → **Añadir personas**.
   - Pega el email del punto 5 y elige el permiso **Hacer cambios en eventos**.
8. En la misma configuración, baja hasta **Integrar el calendario**. Copia el **ID del calendario**, que termina en `@group.calendar.google.com`.

## 3. Retell AI: la voz (te regalan $10 de prueba)

1. Entra en https://www.retellai.com y regístrate.
2. En el panel, busca **API Keys** (en Settings) y copia tu API key.

## 4. Vercel: pegar las claves

1. Ve a https://vercel.com → proyecto **flowserve-ai** → **Settings** → **Environment Variables**.
2. Añade cada una de estas. Marca *Production* y *Preview* en todas.

| Nombre | Valor |
|---|---|
| `SUPABASE_URL` | Project URL (paso 1.5) |
| `SUPABASE_ANON_KEY` | clave anon (paso 1.5) |
| `SUPABASE_SERVICE_ROLE_KEY` | clave service_role (paso 1.5) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | abre el `.json` del paso 2.5 con el Bloc de notas, copia **todo** y pégalo |
| `RETELL_API_KEY` | la key del paso 3 |
| `TOOL_SECRET` | una cadena larga aleatoria* |
| `WEBHOOK_SECRET` | otra distinta* |
| `ADMIN_SECRET` | otra distinta*. **Guárdala**, la usas en el paso 6 |
| `PUBLIC_BASE_URL` | `https://flowserve-ai.vercel.app` |

\* Para generarlas, entra en https://www.uuidgenerator.net/version4. Cada una tiene que salir distinta.

## 5. Subir el código y datos de la demo

1. En PowerShell, dentro de la carpeta del proyecto:
   ```
   Remove-Item -Force .git\index.lock -ErrorAction SilentlyContinue; git add -A; git commit -m "FlowServe Voice: AI phone receptionist"; git push origin main
   ```
2. Vuelve a Supabase → **Table Editor** → tabla **businesses** → fila `halden-demo`. Cambia:
   - `owner_email`: tu email, donde quieres los avisos.
   - `calendar_id`: el ID del paso 2.8.
3. Comprueba que todo está conectado. Abre `https://flowserve-ai.vercel.app/api/public-config`: en `configured` tiene que salir `true` en supabase, google, retell y secrets. `email` puede salir `false` por ahora.

## 6. Crear la recepcionista

Abre este enlace en el navegador, cambiando `TU_ADMIN_SECRET` por el valor del paso 4:

```
https://flowserve-ai.vercel.app/api/admin/sync-agent?biz=halden-demo&key=TU_ADMIN_SECRET
```

Tiene que salir `"ok": true`. Repite este enlace cada vez que cambies horarios, servicios o textos en Supabase.

## 7. Probarla sin número (gratis)

1. En Retell → **Agents** → **FlowServe · Halden Wellness Studio** → botón de **Test**. Así hablas con ella desde el navegador.
2. Prueba esto:
   - **Reservar:** "I'd like a relaxation massage tomorrow afternoon". Después mira el calendario *FlowServe Demo*: la cita tiene que estar ahí.
   - **Cambiar:** "Can I move it to Friday?"
   - **Cancelar:** "I need to cancel".
   - **Pregunta que no sabe:** "Can I bring my 14-year-old?". Tiene que aparecer en la Bandeja del panel.
3. Si la voz no te gusta, cámbiala en Retell → Agent → Voice. Prueba voces británicas o irlandesas.

## 8. Número irlandés (Twilio, unos €2/mes)

1. Regístrate en https://www.twilio.com. Para uso real hay que pasar la cuenta a *Upgrade* (recarga mínima de unos $20). En prueba solo puedes llamar a números verificados.
2. **Papeles** (los exige el regulador irlandés):
   - Ve a **Phone Numbers** → **Regulatory Compliance** → **Bundles** → **Create bundle** → Ireland → Local → **Business**.
   - Datos de la empresa: nombre legal, **CRO 819469**, dirección con **Eircode** en Dublín, y tú como representante.
   - Envía y espera la aprobación: de 1 a 3 días hábiles.
3. Compra el número: **Phone Numbers** → **Buy a number** → Ireland → Local, con prefijo 01 de Dublín. Elige el bundle aprobado.
4. **Conexión con Retell** (Elastic SIP Trunking):
   - **Elastic SIP Trunking** → **Trunks** → **Create new SIP Trunk** → nombre `retell`.
   - **Termination:**
     - Termination SIP URI: `flowserve-retell` (la dirección completa queda `flowserve-retell.pstn.dublin.twilio.com`).
     - En **Credential Lists** crea un usuario y una contraseña. Guárdalos.
   - **Origination** → **Add new Origination URI**: `sip:sip.retellai.com`.
   - **Numbers** → **Add a number** → elige tu número.
5. Twilio → **Voice** → **Settings** → **Geo permissions**. Activa **Ireland** para *Elastic SIP Trunking*.
6. Importa el número en Retell:
   - Retell → **Phone Numbers** → **Import**.
   - Número: `+3531…`.
   - Termination URI: `flowserve-retell.pstn.dublin.twilio.com`.
   - Usuario y contraseña del paso 4.
   - Pulsa **Test SIP Connection**, luego **Save**.
   - Pon como **Inbound agent** y **Outbound agent** a *FlowServe · Halden Wellness Studio*.
7. En Supabase, en la fila `halden-demo`, rellena `phone_e164` con el número (`+3531…`).
8. Llama desde tu móvil.

## 9. Entrar al panel del dueño

1. Abre `https://flowserve-ai.vercel.app/app/`, pon tu email y pulsa el enlace que te llega.
2. En Supabase → **SQL Editor**, ejecuta esto una vez, con tu email:
   ```sql
   insert into members (business_id, user_id)
   select b.id, u.id from businesses b, auth.users u
   where b.slug = 'halden-demo' and u.email = 'TU_EMAIL';
   ```
3. Recarga el panel. Vas a ver:
   - la **Bandeja**: escribes la respuesta y pulsas *Call them back with this*;
   - las **Llamadas**, con resumen y transcripción;
   - las **Citas**;
   - el **Consumo** de minutos.

Si quieres ver el diseño antes de montar nada, abre `/app/?preview=1`. Usa datos de ejemplo.

## 10. Avisos por email (opcional al principio)

1. Regístrate en https://resend.com → **API Keys** → **Create**.
2. Pega la clave en Vercel como `RESEND_API_KEY`.
3. Con el remitente de prueba (`onboarding@resend.dev`) solo llegan emails a tu propio correo. Para enviar a clientes hace falta un dominio propio (pendiente de comprar).

---

## Cómo funciona por dentro (para referencia)

- **Llamada entrante:** Twilio → Retell (voz y modelo de IA) → herramientas en `/api/voice/tool`. Las herramientas son: ver huecos, reservar, buscar, mover, cancelar, dejar recado y preguntar al dueño. La agenda vive en Google Calendar.
- **Al colgar:** Retell → `/api/voice/webhook` → se guarda la llamada con resumen y transcripción en Supabase.
- **Bandeja:** el dueño responde en `/app/` → `/api/inbox/act` → Retell llama al cliente y le da la respuesta. Solo llama de 9:00 a 20:00.
- **Seguridad:**
  - las herramientas exigen `TOOL_SECRET`, el webhook exige `WEBHOOK_SECRET` y el admin exige `ADMIN_SECRET`;
  - el panel solo lee los datos de tus negocios (RLS);
  - cada cliente solo puede cambiar o cancelar citas hechas con su propio número.
- **Legal:**
  - se presenta como IA en la primera frase (AI Act art. 50) y avisa de que la llamada se transcribe;
  - las llamadas duran como máximo 10 minutos (control de coste).
- **Pruebas:** `npm test` (20 pruebas: horarios, cambio de hora, huecos, reservas dobles, permisos y endpoints).
