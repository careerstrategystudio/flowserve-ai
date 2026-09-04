# Flowserve AI — sitio web

Sitio estático. Cuatro archivos HTML autocontenidos (CSS y JS embebidos, sin build).

| Archivo | Qué es |
|---|---|
| `index.html` | Landing. Contiene el contenido ES/EN, los planes, el FAQ y los modales de privacidad y aviso legal. |
| `demo-vibrapositivo.html` · `demo-yoga.html` · `demo-career.html` | Maquetas de propuesta comercial por sector. |
| `assets/` | Logos y marca. |

## Cómo se despliega
Se sube la carpeta (sin `assets/` si no se referencia) a Vercel. El proyecto es `careerstrategystudio/flowserve-ai`.

## Dónde tocar cada cosa en `index.html`
- **Precios** → objeto `PRICING` (bloques `es` y `en`).
- **Contenido por sector** → objeto `CONTENT` (`hosteleria`, `salud`, `servicios`).
- **FAQ** → objeto `FAQ`.
- **Privacidad y aviso legal** → objetos `PRIVACY` y `LEGAL`.
- **Teléfonos** → constantes `PHONE_IE` y `PHONE_ES`.
- **Destino del formulario** → constante `RECIPIENT` (alias de FormSubmit).

## Pendiente
- [ ] **Email de contacto propio.** Hoy el único contacto público son los teléfonos. Hace falta un email en el aviso legal y en la política de privacidad.
- [ ] **Dominio propio.** `.vercel.app` resta credibilidad ante clínicas y restaurantes que evalúan proveedores.
- [ ] **Datos registrales de la sociedad** una vez constituida la Ltd irlandesa: sustituir "entidad en constitución" en `LEGAL` y `PRIVACY`.
- [ ] **Sustituir FormSubmit** por un endpoint propio cuando exista Supabase, para poder afirmar infraestructura europea sin matices.
- [ ] **Logos de los demos** (`logo-vibrapositivo.png`, `logo-yinyoga.png`, `logo-careerclarity.png`) dan 404. Se ocultan solos por `onerror`, pero conviene quitarlos o subirlos.
- [ ] La sección "Por qué esto vende" de los demos está escrita para el equipo comercial, no para el cliente que recibe la propuesta. Revisar antes de enviar un demo a un prospecto.

## Reglas que no se rompen
1. **Ninguna cifra de resultado sin un cliente real detrás.** Nada de "94%", "31%" ni testimonios firmados hasta que existan, con permiso por escrito.
2. **Las maquetas van etiquetadas como maquetas**, arriba y visible.
3. **Un solo precio** en ES, EN y los tres demos.
4. **Aviso de IA** al inicio de cada conversación cuando los agentes estén en vivo (art. 50 del Reglamento de IA, en vigor desde agosto de 2026).
