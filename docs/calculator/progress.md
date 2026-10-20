# Progreso — calculadora de llamadas perdidas

**Tarea:** página `/calculator/` para anuncios. Límites: Javier es contratista en Meta, así que nada de bots de DMs ni de apps de Meta. El precio es Front Desk a €249. Sin datos inventados.

**Salidas:**
- `calculator/index.html`, `calculator/calc.js` (la fórmula se exporta para los tests) y `calculator/calc.css`;
- `test/calculator.test.js`;
- enlaces añadidos en el pie de las 9 páginas, en la portada (bajo la calculadora de ausencias) y en el hero de `/voice/`.

**Completado:**
- construcción y verificación: todo en pase (ver `checks.md`);
- tests: 47 de 47.

**Decisiones:**
- Solo se usan los números del dueño, porque no hay datos fiables para salones.
- Los dos datos externos van citados y enlazados en la sección "Why missed calls matter".
- El enlace va en el pie y no en el menú de arriba: con un séptimo enlace la cabecera se desborda entre 861 y 1120 px.
- Se añadieron parámetros de URL (`missed`, `share`, `book`, `price`) para hacer variantes de anuncio sin tocar código.
- Se cambió la etiqueta del resultado de "bookings" a "revenue" lost, porque la cifra está en euros.

**Fallos abiertos:**
- La página irlandesa del competidor no se pudo leer.
- No hay medición de visitas: falta activar Vercel Web Analytics.
- La portada dice "Most businesses recover the cost… with four or five saved appointments": es una afirmación sin fuente, fuera de este alcance; revisarla.

**Siguiente acción:**
1. Javier hace el push.
2. Activar Vercel Analytics: Project → Analytics → Enable.
3. Lanzar un anuncio de prueba que apunte a `/calculator/?utm_source=...`.
