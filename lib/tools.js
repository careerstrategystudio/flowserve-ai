// Lógica de las herramientas que usa la recepcionista durante la llamada.
// Cada función recibe (biz, args, call, deps) y devuelve un objeto corto que el modelo lee en voz.
// deps = { gcal, db, notify, now } para poder probarlo sin servicios reales.
import { parseDay, parseLocalDateTime, localToUtc, addDaysISO, spoken, spokenTime, localStamp, localDateISO } from './time.js';
import { computeSlots, isSlotFree, pickSuggestions } from './slots.js';
import { normalizePhone, clip } from './util.js';

const tzOf = (biz) => biz.timezone || 'Europe/Dublin';
const cc = (biz) => biz.default_country_code || '353';

export function findService(biz, wanted) {
  const list = biz.services || [];
  if (!wanted) return list.length === 1 ? list[0] : null;
  const w = String(wanted).toLowerCase().trim();
  return list.find((s) => s.id === w) || list.find((s) => s.name.toLowerCase() === w)
    || list.find((s) => s.name.toLowerCase().includes(w) || w.includes(s.name.toLowerCase()))
    || list.find((s) => (s.aliases || []).some((a) => w.includes(a.toLowerCase()))) || null;
}
const serviceList = (biz) => (biz.services || []).map((s) => `${s.name} (${s.duration_min} min, €${s.price_eur})`).join('; ');

function dayBounds(tz, dateISO) {
  const [y, m, d] = dateISO.split('-').map(Number);
  const start = localToUtc(tz, y, m, d, 0, 0);
  const [y2, m2, d2] = addDaysISO(dateISO, 1).split('-').map(Number);
  return { start, end: localToUtc(tz, y2, m2, d2, 0, 0) };
}
async function busyFor(biz, deps, dateISO) {
  const { start, end } = dayBounds(tzOf(biz), dateISO);
  return deps.gcal.busy(biz.calendar_id, start, end);
}
const callerPhone = (biz, args, call) => normalizePhone(args.client_phone || args.caller_phone || call?.from_number, cc(biz));
const dayLabel = (tz, dateISO) => {
  const [y, m, d] = dateISO.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IE', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(localToUtc(tz, y, m, d, 12, 0)).replace(',', '');
};

/** Comprueba que la cita pertenece a quien llama (por su número). */
function ownsEvent(ev, phone) { return !!phone && ev.props?.fs_phone === phone; }

export const tools = {
  async check_availability(biz, args, call, deps) {
    const tz = tzOf(biz);
    const svc = findService(biz, args.service);
    if (!svc) return { ok: false, say: `Ask which treatment they want. Options: ${serviceList(biz)}.` };
    const dateISO = parseDay(args.day, tz, deps.now);
    if (!dateISO) return { ok: false, say: 'Ask the caller which day they would like (for example "tomorrow" or "Friday").' };

    const busy = await busyFor(biz, deps, dateISO);
    const slots = computeSlots({ biz, dateISO, durationMin: svc.duration_min, busy, now: deps.now });
    if (slots.length) {
      const picks = pickSuggestions(slots, tz, args.preferred_time);
      return { ok: true, service: svc.name, day: dayLabel(tz, dateISO), options: picks.map((s) => ({ start: localStamp(tz, s), say: spokenTime(tz, s) })), more_available: slots.length > picks.length };
    }
    // nada ese día: busca el siguiente día con hueco (máx. 14 días)
    for (let i = 1; i <= 14; i++) {
      const next = addDaysISO(dateISO, i);
      const b = await busyFor(biz, deps, next);
      const s = computeSlots({ biz, dateISO: next, durationMin: svc.duration_min, busy: b, now: deps.now });
      if (s.length) {
        const picks = pickSuggestions(s, tz, args.preferred_time, 3);
        return { ok: true, service: svc.name, requested_day_full: dayLabel(tz, dateISO), day: dayLabel(tz, next), options: picks.map((x) => ({ start: localStamp(tz, x), say: spokenTime(tz, x) })), note: 'Requested day is full or closed. Offer these instead.' };
      }
    }
    return { ok: false, say: 'No availability in the next two weeks. Offer to take a message so the owner can call back.' };
  },

  async book_appointment(biz, args, call, deps) {
    const tz = tzOf(biz);
    const svc = findService(biz, args.service);
    if (!svc) return { booked: false, say: `Confirm the treatment first. Options: ${serviceList(biz)}.` };
    const start = parseLocalDateTime(args.start, tz);
    if (!start) return { booked: false, say: 'Check availability first and use one of the returned start times.' };
    const name = clip(args.client_name, 80);
    if (!name) return { booked: false, say: "Ask for the client's name before booking." };
    const phone = callerPhone(biz, args, call);
    if (!phone) return { booked: false, say: 'Ask for a mobile number to send the confirmation to.' };

    const dateISO = localDateISO(tz, start);
    const busy = await busyFor(biz, deps, dateISO);
    if (!isSlotFree({ biz, start, durationMin: svc.duration_min, busy, now: deps.now })) {
      const alt = await tools.check_availability(biz, { service: svc.id, day: dateISO, preferred_time: localStamp(tz, start).slice(11) }, call, deps);
      return { booked: false, reason: 'That time was just taken or is outside opening hours.', alternatives: alt.options || [] };
    }
    const end = new Date(start.getTime() + svc.duration_min * 60000);
    const ev = await deps.gcal.create(biz.calendar_id, {
      summary: `${name} — ${svc.name}`,
      description: [`Booked by phone (FlowServe AI receptionist).`, `Phone: ${phone}`, args.notes ? `Notes: ${clip(args.notes, 500)}` : null].filter(Boolean).join('\n'),
      start, end, tz, props: { fs: '1', fs_phone: phone, fs_service: svc.id, fs_biz: biz.id },
    });
    await deps.db.insert('appointments', {
      business_id: biz.id, gcal_event_id: ev.id, client_name: name, client_phone: phone, service_id: svc.id, service_name: svc.name,
      starts_at: start.toISOString(), ends_at: end.toISOString(), status: 'booked', retell_call_id: call?.call_id || null,
    }).catch((e) => console.error('appointments insert', e.message));
    await deps.notify.booking(biz, 'New booking', { client_name: name, client_phone: phone, service: svc.name, when: spoken(tz, start) }).catch(() => {});
    return { booked: true, appointment_id: ev.id, when: spoken(tz, start), service: svc.name, say_next: biz.booking_confirmation_note || null };
  },

  async find_appointments(biz, args, call, deps) {
    const tz = tzOf(biz);
    const phone = callerPhone(biz, args, call);
    if (!phone) return { found: 0, say: 'Ask for the mobile number the booking was made with.' };
    const evs = await deps.gcal.byPhone(biz.calendar_id, phone, deps.now);
    if (!evs.length) return { found: 0, say: 'No upcoming booking under this number. Ask if it might be under another number, or offer to take a message.' };
    return { found: evs.length, appointments: evs.map((e) => ({ appointment_id: e.id, what: e.summary?.split(' — ')[1] || e.summary, when: spoken(tz, e.start), start: localStamp(tz, e.start) })) };
  },

  async reschedule_appointment(biz, args, call, deps) {
    const tz = tzOf(biz);
    const phone = callerPhone(biz, args, call);
    const ev = await deps.gcal.get(biz.calendar_id, args.appointment_id).catch(() => null);
    if (!ev || !ownsEvent(ev, phone)) return { moved: false, say: 'Could not find that booking for this caller. Use find_appointments first.' };
    const start = parseLocalDateTime(args.new_start, tz);
    if (!start) return { moved: false, say: 'Check availability for the new day first and use a returned start time.' };
    const durationMin = Math.round((ev.end - ev.start) / 60000);
    const busy = (await busyFor(biz, deps, localDateISO(tz, start))).filter((b) => b.id !== ev.id);
    if (!isSlotFree({ biz, start, durationMin, busy, now: deps.now })) return { moved: false, reason: 'That new time is not free. Check availability again.' };
    const end = new Date(start.getTime() + durationMin * 60000);
    await deps.gcal.move(biz.calendar_id, ev.id, { start, end, tz });
    await deps.db.update('appointments', `gcal_event_id=eq.${encodeURIComponent(ev.id)}`, { starts_at: start.toISOString(), ends_at: end.toISOString(), status: 'booked', updated_at: new Date().toISOString() }).catch(() => {});
    await deps.notify.booking(biz, 'Moved', { client_name: ev.summary?.split(' — ')[0] || phone, client_phone: phone, service: ev.summary?.split(' — ')[1], when: `${spoken(tz, ev.start)} → ${spoken(tz, start)}` }).catch(() => {});
    return { moved: true, from: spoken(tz, ev.start), to: spoken(tz, start) };
  },

  async cancel_appointment(biz, args, call, deps) {
    const tz = tzOf(biz);
    const phone = callerPhone(biz, args, call);
    const ev = await deps.gcal.get(biz.calendar_id, args.appointment_id).catch(() => null);
    if (!ev || !ownsEvent(ev, phone)) return { cancelled: false, say: 'Could not find that booking for this caller. Use find_appointments first.' };
    const hoursBefore = (ev.start - deps.now) / 3600000;
    const late = hoursBefore < (biz.cancel_policy_hours ?? 24);
    await deps.gcal.cancel(biz.calendar_id, ev.id);
    await deps.db.update('appointments', `gcal_event_id=eq.${encodeURIComponent(ev.id)}`, { status: 'cancelled', updated_at: new Date().toISOString() }).catch(() => {});
    await deps.notify.booking(biz, 'Cancelled', { client_name: ev.summary?.split(' — ')[0] || phone, client_phone: phone, service: ev.summary?.split(' — ')[1], when: spoken(tz, ev.start) }).catch(() => {});
    return { cancelled: true, when: spoken(tz, ev.start), late_cancellation: late, policy: late ? (biz.late_cancel_note || 'This is inside the cancellation window; the deposit may be kept per the studio policy.') : null };
  },

  async take_message(biz, args, call, deps) {
    const item = await deps.db.insert('inbox_items', {
      business_id: biz.id, kind: 'message', retell_call_id: call?.call_id || null,
      caller_name: clip(args.caller_name, 80), caller_phone: callerPhone(biz, args, call),
      summary: clip(args.message, 1500), urgency: ['low', 'normal', 'urgent'].includes(args.urgency) ? args.urgency : 'normal', status: 'open',
    });
    await deps.notify.inbox(biz, item).catch(() => {});
    return { saved: true, say: 'Tell the caller the message has been passed on and someone will get back to them.' };
  },

  async ask_owner(biz, args, call, deps) {
    const item = await deps.db.insert('inbox_items', {
      business_id: biz.id, kind: 'escalation', retell_call_id: call?.call_id || null,
      caller_name: clip(args.caller_name, 80), caller_phone: callerPhone(biz, args, call),
      question: clip(args.question, 600), summary: clip(args.context || args.question, 1500), urgency: 'normal', status: 'open',
    });
    await deps.notify.inbox(biz, item).catch(() => {});
    return { saved: true, say: 'Tell the caller you have asked the owner and you will call them back with an answer. Do not promise a specific time.' };
  },
};

export const TOOL_NAMES = Object.keys(tools);
