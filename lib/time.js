// Utilidades de fecha y hora con zona horaria (sin dependencias).
// Todo lo que se guarda o se manda a Google va en UTC (Date). Lo que se habla va en hora local del negocio.

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
export const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const partsCache = new Map();
function fmtParts(tz) {
  if (!partsCache.has(tz)) {
    partsCache.set(tz, new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short',
    }));
  }
  return partsCache.get(tz);
}

/** Partes locales de un instante UTC en la zona `tz`. */
export function localParts(tz, date) {
  const o = {};
  for (const p of fmtParts(tz).formatToParts(date)) o[p.type] = p.value;
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday);
  return { y: +o.year, m: +o.month, d: +o.day, hh: +o.hour, mm: +o.minute, ss: +o.second, wd };
}

/** Minutos de diferencia entre la hora local y UTC en ese instante (Dublín: 0 en invierno, 60 en verano). */
export function offsetMin(tz, date) {
  const p = localParts(tz, date);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** Hora local de pared -> instante UTC. Maneja los cambios de horario. */
export function localToUtc(tz, y, m, d, hh = 0, mm = 0) {
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let t = wall - offsetMin(tz, new Date(wall)) * 60000;
  t = wall - offsetMin(tz, new Date(t)) * 60000;
  return new Date(t);
}

export const pad = (n) => String(n).padStart(2, '0');
export const isoDate = (p) => `${p.y}-${pad(p.m)}-${pad(p.d)}`;

/** "YYYY-MM-DD" del día local de `date`. */
export function localDateISO(tz, date) { return isoDate(localParts(tz, date)); }

/** Suma días a una fecha ISO (calendario, sin zona). */
export function addDaysISO(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
export function weekdayOfISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Interpreta lo que el modelo manda como día: "2026-10-23", "today", "tomorrow",
 * "friday", "next friday", "this friday". Devuelve "YYYY-MM-DD" o null.
 */
export function parseDay(input, tz, now = new Date()) {
  if (!input) return null;
  const s = String(input).trim().toLowerCase();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const today = localDateISO(tz, now);
  if (s === 'today' || s === 'tonight') return today;
  if (s === 'tomorrow') return addDaysISO(today, 1);
  if (s === 'day after tomorrow') return addDaysISO(today, 2);
  const m = s.match(/^(next |this |on )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (m) {
    const target = WEEKDAYS.indexOf(m[2]);
    const cur = weekdayOfISO(today);
    let diff = (target - cur + 7) % 7;
    // "friday" / "next friday" = el próximo viernes que viene; si hoy es viernes, "next" salta una semana.
    if (diff === 0 && m[1] === 'next ') diff = 7;
    return addDaysISO(today, diff);
  }
  return null;
}

/** "YYYY-MM-DDTHH:MM" (hora local) -> Date UTC. Acepta también un ISO con zona. */
export function parseLocalDateTime(input, tz) {
  if (!input) return null;
  const s = String(input).trim();
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) { const d = new Date(s); return isNaN(d) ? null : d; }
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})/);
  if (!m) return null;
  return localToUtc(tz, +m[1], +m[2], +m[3], +m[4], +m[5]);
}

/** "HH:MM" -> minutos desde medianoche. */
export const hm = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

/** Forma hablada para la voz: "Thursday 23 October at 2:30pm". */
export function spoken(tz, date) {
  const day = new Intl.DateTimeFormat('en-IE', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(date).replace(',', '');
  return `${day} at ${spokenTime(tz, date)}`;
}
export function spokenTime(tz, date) {
  const p = localParts(tz, date);
  const h12 = ((p.hh + 11) % 12) + 1;
  const ap = p.hh < 12 ? 'am' : 'pm';
  return p.mm ? `${h12}:${pad(p.mm)}${ap}` : `${h12}${ap}`;
}
/** "2026-10-23T14:30" en hora local, para que el modelo lo devuelva tal cual al reservar. */
export function localStamp(tz, date) {
  const p = localParts(tz, date);
  return `${isoDate(p)}T${pad(p.hh)}:${pad(p.mm)}`;
}
