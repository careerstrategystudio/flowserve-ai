# Tarea: calculadora de llamadas perdidas (20 oct 2026)

- **TASK:** página `/calculator/`, lista para anuncios. Calcula cuánto le cuestan al mes las llamadas no atendidas a un negocio de belleza y bienestar y la compara con Front Desk (€249/mes).
- **OUTPUT:**
  - `calculator/index.html`, `calculator/calc.js` y `calculator/calc.css`;
  - `test/calculator.test.js`;
  - `docs/calculator/checks.md` y `docs/calculator/progress.md`.
- **CHECKS:** ver `checks.md`.
- **SCOPE:** `calculator/`, enlaces desde el pie de todas las páginas, la portada y `/voice/`, y un test nuevo. No se toca nada más.
- **LIMIT:** una sesión. No se publica nada: el push lo hace Javier.

## Fuentes (comprobadas el 20 oct 2026)
- **Quo, "Small business callback statistics":** https://www.quo.com/blog/small-business-callback-statistics/
  - El 69% de las llamadas perdidas no recibe respuesta en 48 h (análisis propio de Quo sobre 16,7 M de llamadas; artículo de agosto de 2026).
  - Solo el 6% dejaría un mensaje de voz. Encuesta de YouGov citada por Quo; la FAQ habla de consumidores del Reino Unido. No conocemos la muestra ni el año.
- **Competidor revisado:** https://360.topdoctors.co.uk/products/ai-phone/
  - La página irlandesa `aiphone.topdoctors.ie/calculator` no se pudo leer: es una app JS, el proxy la bloquea y Chrome no estaba conectado.
- No hay datos públicos fiables de llamadas perdidas específicos de belleza y bienestar. Por eso la calculadora solo usa los números que mete el dueño.
