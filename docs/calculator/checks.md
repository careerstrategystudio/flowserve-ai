# Verificación — /calculator/ (20 oct 2026)

**Línea base, antes de cambiar nada:**
- commit `71b1708`;
- `node --test test/*.test.js`: 42 de 42 en verde;
- no existían `CLAUDE.md` ni `progress.md`.

**Método:**
- tests de Node para la fórmula;
- Playwright (Chromium headless) sobre una copia local de la web, a 1360 y a 390 px;
- script que revisa los enlaces internos de las 9 páginas.

Es una auto-revisión: no hubo un revisor aparte.

| Requisito | Evidencia | Resultado |
|---|---|---|
| El cálculo es correcto | `test/calculator.test.js`: valores por defecto 8×4,33×60%×50%×€60 = €624; ejemplo a mano 20/75%/40%/€45 = €1.170; entradas malas se recortan y nunca dan NaN | pase (5/5) |
| El cálculo coincide en el navegador | Playwright: por defecto €624 y €7,488 al año; 20/75/40/45 da €1,170 | pase |
| EN y ES | Al cambiar a ES salen el título, el veredicto y "€14.040 al año"; todos los textos tienen `data-en`/`data-es` y los textos dinámicos están en `calc.js` | pase |
| Móvil sin scroll lateral | scrollWidth = 390 con ventana de 390 px | pase |
| Enlaces y CTA a la demo | Los CTA llevan a `/voice/#talk`, `/pilot/` y `/voice/`; el script de enlaces no encuentra ningún enlace roto en las 9 páginas | pase |
| Parámetros de URL para anuncios | `?missed=3&share=50&book=50&price=40` rellena los campos y da €130 con el mensaje "no cubre" | pase |
| Sin datos inventados | La fórmula solo usa los números del dueño; los valores iniciales se presentan como ejemplos; los dos datos externos llevan su fuente enlazada (Quo y YouGov vía Quo); el método se explica en la página | pase |
| No se presenta como resultado de clientes | Texto: "not a result from FlowServe clients" | pase |
| El menú no se rompe | La cabecera mide 65 px en `/`, `/voice/` y `/calculator/`. El enlace va en el pie, no arriba (ver decisión en progress.md) | pase |
| Tests en verde | `node --test test/*.test.js` en el PC de Javier: 47 de 47 | pase |
| Sin errores de JavaScript | Playwright no registra ningún pageerror | pase |
| Publicado | No: el push lo hace Javier | no aplica |
