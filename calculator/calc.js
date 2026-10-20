// Calculadora de llamadas perdidas (/calculator/). La fórmula es pura y se prueba en test/calculator.test.js.
// Todos los números de entrada son del propio negocio; la página no inventa resultados de clientes.

export const WEEKS_PER_MONTH = 52 / 12; // 4,33
export const PLAN_PRICE = 249;           // FlowServe Front Desk, €/mes sin IVA (mismo precio que la portada)
export const DEFAULTS = { missed: 8, bookingShare: 60, wouldBook: 50, price: 60 };
export const LIMITS = { missed: [0, 500], bookingShare: [0, 100], wouldBook: [0, 100], price: [0, 2000] };

const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, Number.isFinite(+v) ? +v : 0));

/** Devuelve las cifras mensuales a partir de las respuestas del dueño. */
export function compute(input = {}) {
  const v = {};
  for (const k of Object.keys(DEFAULTS)) v[k] = clamp(input[k] ?? DEFAULTS[k], LIMITS[k]);
  const missedMonth = v.missed * WEEKS_PER_MONTH;
  const lostBookings = missedMonth * (v.bookingShare / 100) * (v.wouldBook / 100);
  const lostRevenue = lostBookings * v.price;
  const breakEven = v.price > 0 ? Math.ceil(PLAN_PRICE / v.price) : null; // reservas al mes para cubrir el plan
  return {
    inputs: v,
    missedMonth: Math.round(missedMonth),
    lostBookings: Math.round(lostBookings * 10) / 10,
    lostRevenue: Math.round(lostRevenue),
    lostYear: Math.round(lostRevenue * 12),
    breakEven,
    covers: lostRevenue >= PLAN_PRICE,
  };
}

/** Lee los valores de la URL (?missed=8&share=60&book=50&price=60) para enlazar desde anuncios. */
export function fromQuery(search) {
  const p = new URLSearchParams(search || '');
  const map = { missed: 'missed', share: 'bookingShare', book: 'wouldBook', price: 'price' };
  const out = {};
  for (const [q, k] of Object.entries(map)) if (p.has(q) && p.get(q) !== '' && Number.isFinite(+p.get(q))) out[k] = +p.get(q);
  return out;
}

/* ---------- Página ---------- */
if (typeof document !== 'undefined') {
  const T = {
    en: {
      missedMonth: (n) => `${n} missed calls a month`,
      lostBookings: (n) => `≈ ${n} bookings lost`,
      covers: (be) => `Front Desk costs €${PLAN_PRICE}/month. At your prices it pays for itself with ${be} saved booking${be === 1 ? '' : 's'} a month.`,
      notCovers: (be) => `At these numbers your missed calls cost less than Front Desk (€${PLAN_PRICE}/month). It pays for itself from ${be} saved booking${be === 1 ? '' : 's'} a month — the free pilot shows you the real number.`,
      zero: 'Enter your numbers above to see the estimate.',
      year: (v) => `${v} a year`,
    },
    es: {
      missedMonth: (n) => `${n} llamadas perdidas al mes`,
      lostBookings: (n) => `≈ ${n} reservas perdidas`,
      covers: (be) => `Front Desk cuesta €${PLAN_PRICE}/mes. Con tus precios se paga solo con ${be} reserva${be === 1 ? '' : 's'} salvada${be === 1 ? '' : 's'} al mes.`,
      notCovers: (be) => `Con estos números tus llamadas perdidas cuestan menos que Front Desk (€${PLAN_PRICE}/mes). Se paga solo a partir de ${be} reserva${be === 1 ? '' : 's'} salvada${be === 1 ? '' : 's'} al mes — el piloto gratis te da la cifra real.`,
      zero: 'Pon tus números arriba para ver la estimación.',
      year: (v) => `${v} al año`,
    },
  };
  const L = () => T[document.documentElement.lang === 'es' ? 'es' : 'en'];
  const eur = (n) => `€${Number(n).toLocaleString(document.documentElement.lang === 'es' ? 'es-IE' : 'en-IE')}`;
  const $ = (id) => document.getElementById(id);
  const ids = { missed: 'k-missed', bookingShare: 'k-share', wouldBook: 'k-book', price: 'k-price' };

  const start = { ...DEFAULTS, ...fromQuery(location.search) };
  for (const [k, id] of Object.entries(ids)) $(id).value = start[k];

  function render() {
    const raw = Object.fromEntries(Object.entries(ids).map(([k, id]) => [k, $(id).value]));
    const r = compute(raw);
    $('k-out').textContent = eur(r.lostRevenue);
    $('k-year').textContent = L().year(eur(r.lostYear));
    $('k-detail').textContent = `${L().missedMonth(r.missedMonth)} · ${L().lostBookings(r.lostBookings)}`;
    $('k-verdict').textContent = r.breakEven == null || r.missedMonth === 0 ? L().zero : (r.covers ? L().covers(r.breakEven) : L().notCovers(r.breakEven));
    for (const id of ['k-share', 'k-book']) $(`${id}-v`).textContent = `${$(id).value}%`;
  }
  Object.values(ids).forEach((id) => $(id).addEventListener('input', render));
  document.addEventListener('flowserve:lang', render);
  render();
}
