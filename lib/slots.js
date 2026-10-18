// Cálculo de huecos libres. Función pura: no llama a nada externo, así se puede probar.
import { WEEKDAY_KEYS, weekdayOfISO, localToUtc, hm, localDateISO, addDaysISO, localParts } from './time.js';

/**
 * @param {object} o
 * @param {object} o.biz       negocio: hours, closures, capacity, slot_step_min, min_notice_min, buffer_min, booking_window_days, timezone
 * @param {string} o.dateISO   día local "YYYY-MM-DD"
 * @param {number} o.durationMin
 * @param {{start:Date,end:Date}[]} o.busy  eventos ocupados de ese día (cualquier evento del calendario cuenta)
 * @param {Date} o.now
 * @returns {Date[]} inicios disponibles (UTC)
 */
export function computeSlots({ biz, dateISO, durationMin, busy, now }) {
  const tz = biz.timezone || 'Europe/Dublin';
  const closures = new Set(biz.closures || []);
  if (closures.has(dateISO)) return [];

  const today = localDateISO(tz, now);
  const windowDays = biz.booking_window_days ?? 60;
  if (dateISO < today || dateISO > addDaysISO(today, windowDays)) return [];

  const ranges = (biz.hours || {})[WEEKDAY_KEYS[weekdayOfISO(dateISO)]] || [];
  const step = biz.slot_step_min || 15;
  const capacity = Math.max(1, biz.capacity || 1);
  const notice = (biz.min_notice_min ?? 60) * 60000;
  const buffer = (biz.buffer_min || 0) * 60000;
  const [y, m, d] = dateISO.split('-').map(Number);
  const out = [];

  for (const [open, close] of ranges) {
    for (let t = hm(open); t + durationMin <= hm(close); t += step) {
      const start = localToUtc(tz, y, m, d, Math.floor(t / 60), t % 60);
      const end = new Date(start.getTime() + durationMin * 60000);
      if (start.getTime() < now.getTime() + notice) continue;
      // cuántas citas se solapan (con margen entre citas)
      const overlapping = busy.filter((b) => b.start.getTime() < end.getTime() + buffer && b.end.getTime() + buffer > start.getTime()).length;
      if (overlapping < capacity) out.push(start);
    }
  }
  return out;
}

/** ¿Este inicio concreto sigue libre? (se revisa justo antes de reservar) */
export function isSlotFree({ biz, start, durationMin, busy, now }) {
  const tz = biz.timezone || 'Europe/Dublin';
  const dateISO = localDateISO(tz, start);
  return computeSlots({ biz, dateISO, durationMin, busy, now }).some((s) => s.getTime() === start.getTime());
}

/**
 * Elige pocas opciones para decir por teléfono (la voz no puede leer 30 horas).
 * preferred: "morning" | "afternoon" | "evening" | "HH:MM" | undefined
 */
export function pickSuggestions(slots, tz, preferred, max = 4) {
  if (!slots.length) return [];
  let pool = slots;
  const minutes = (s) => { const p = localParts(tz, s); return p.hh * 60 + p.mm; };
  if (preferred) {
    const p = String(preferred).toLowerCase();
    const at = p.match(/(\d{1,2}):(\d{2})/) || p.match(/^(\d{1,2})\s*(am|pm)?$/);
    if (p.includes('morning')) pool = slots.filter((s) => minutes(s) < 12 * 60);
    else if (p.includes('afternoon')) pool = slots.filter((s) => minutes(s) >= 12 * 60 && minutes(s) < 17 * 60);
    else if (p.includes('evening')) pool = slots.filter((s) => minutes(s) >= 17 * 60);
    else if (at) {
      let h = +at[1]; const mm = at[2] && /^\d+$/.test(at[2]) ? +at[2] : 0;
      if (at[2] === 'pm' && h < 12) h += 12;
      const target = h * 60 + mm;
      pool = [...slots].sort((a, b) => Math.abs(minutes(a) - target) - Math.abs(minutes(b) - target));
      return pool.slice(0, max).sort((a, b) => a - b);
    }
    if (!pool.length) pool = slots; // si no hay en esa franja, se ofrece lo que haya
  }
  if (pool.length <= max) return pool;
  // repartidas a lo largo del día, no las 4 primeras seguidas
  const stepIdx = (pool.length - 1) / (max - 1);
  const picks = [];
  for (let i = 0; i < max; i++) picks.push(pool[Math.round(i * stepIdx)]);
  return [...new Set(picks)];
}
