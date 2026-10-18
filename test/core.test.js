import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localToUtc, parseDay, parseLocalDateTime, spoken, localStamp, offsetMin } from '../lib/time.js';
import { computeSlots, pickSuggestions, isSlotFree } from '../lib/slots.js';
import { normalizePhone } from '../lib/util.js';
import { findService } from '../lib/tools.js';

const TZ = 'Europe/Dublin';
const biz = {
  timezone: TZ, capacity: 1, slot_step_min: 30, min_notice_min: 60, booking_window_days: 60,
  hours: { mon: [['09:00', '17:00']], tue: [['09:00', '13:00'], ['14:00', '18:00']], sat: [['10:00', '14:00']] },
  closures: ['2026-12-25'],
  services: [{ id: 'relax', name: 'Relaxation Massage', duration_min: 60, price_eur: 75, aliases: ['swedish'] }, { id: 'back', name: 'Back, Neck and Shoulders', duration_min: 30, price_eur: 45, aliases: ['neck'] }],
};

test('Dublin offset: winter 0, summer +60, and DST change days', () => {
  assert.equal(offsetMin(TZ, new Date('2026-01-15T12:00:00Z')), 0);
  assert.equal(offsetMin(TZ, new Date('2026-07-15T12:00:00Z')), 60);
  assert.equal(localToUtc(TZ, 2026, 7, 15, 10, 0).toISOString(), '2026-07-15T09:00:00.000Z');
  assert.equal(localToUtc(TZ, 2026, 1, 15, 10, 0).toISOString(), '2026-01-15T10:00:00.000Z');
  // 25 oct 2026 vuelve la hora de invierno a las 02:00 locales
  assert.equal(localToUtc(TZ, 2026, 10, 25, 10, 0).toISOString(), '2026-10-25T10:00:00.000Z');
  assert.equal(localToUtc(TZ, 2026, 10, 24, 10, 0).toISOString(), '2026-10-24T09:00:00.000Z');
});

test('parseDay understands what callers say', () => {
  const now = new Date('2026-10-16T10:00:00Z'); // viernes
  assert.equal(parseDay('2026-10-20', TZ, now), '2026-10-20');
  assert.equal(parseDay('today', TZ, now), '2026-10-16');
  assert.equal(parseDay('tomorrow', TZ, now), '2026-10-17');
  assert.equal(parseDay('Monday', TZ, now), '2026-10-19');
  assert.equal(parseDay('friday', TZ, now), '2026-10-16');
  assert.equal(parseDay('next friday', TZ, now), '2026-10-23');
  assert.equal(parseDay('whenever', TZ, now), null);
});

test('local datetime parsing and speaking', () => {
  const d = parseLocalDateTime('2026-10-20T14:30', TZ);
  assert.equal(d.toISOString(), '2026-10-20T13:30:00.000Z');
  assert.equal(localStamp(TZ, d), '2026-10-20T14:30');
  assert.equal(spoken(TZ, d), 'Tuesday 20 October at 2:30pm');
  assert.equal(parseLocalDateTime('nonsense', TZ), null);
});

test('slots respect hours, lunch break, notice, closures and existing bookings', () => {
  const now = new Date('2026-10-16T10:00:00Z');
  // martes 20: 9-13 y 14-18, servicio de 60 min cada 30 min
  let s = computeSlots({ biz, dateISO: '2026-10-20', durationMin: 60, busy: [], now }).map((x) => localStamp(TZ, x).slice(11));
  assert.deepEqual(s, ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00']);
  // cita existente 10:00-11:00 bloquea 09:30, 10:00 y 10:30
  const busy = [{ start: parseLocalDateTime('2026-10-20T10:00', TZ), end: parseLocalDateTime('2026-10-20T11:00', TZ) }];
  s = computeSlots({ biz, dateISO: '2026-10-20', durationMin: 60, busy, now }).map((x) => localStamp(TZ, x).slice(11));
  assert.ok(!s.includes('09:30') && !s.includes('10:00') && !s.includes('10:30') && s.includes('09:00') && s.includes('11:00'));
  // con capacidad 2 sí cabe
  s = computeSlots({ biz: { ...biz, capacity: 2 }, dateISO: '2026-10-20', durationMin: 60, busy, now });
  assert.equal(s.length, 14);
  // cerrado miércoles, festivo y pasado
  assert.equal(computeSlots({ biz, dateISO: '2026-10-21', durationMin: 60, busy: [], now }).length, 0);
  assert.equal(computeSlots({ biz, dateISO: '2026-12-25', durationMin: 60, busy: [], now }).length, 0);
  assert.equal(computeSlots({ biz, dateISO: '2026-10-12', durationMin: 60, busy: [], now }).length, 0);
  // aviso mínimo: hoy viernes no hay horario; lunes 19 a las 9:30 locales => solo desde 10:30
  const mon = new Date('2026-10-19T08:30:00Z');
  s = computeSlots({ biz, dateISO: '2026-10-19', durationMin: 60, busy: [], now: mon }).map((x) => localStamp(TZ, x).slice(11));
  assert.equal(s[0], '10:30');
  assert.ok(isSlotFree({ biz, start: parseLocalDateTime('2026-10-20T09:00', TZ), durationMin: 60, busy, now }));
  assert.ok(!isSlotFree({ biz, start: parseLocalDateTime('2026-10-20T10:30', TZ), durationMin: 60, busy, now }));
  assert.ok(!isSlotFree({ biz, start: parseLocalDateTime('2026-10-20T13:00', TZ), durationMin: 60, busy, now }), 'lunch break');
});

test('suggestions: spread out, part of day, nearest to a time', () => {
  const now = new Date('2026-10-16T10:00:00Z');
  const slots = computeSlots({ biz, dateISO: '2026-10-20', durationMin: 60, busy: [], now });
  const hhmm = (a) => a.map((x) => localStamp(TZ, x).slice(11));
  assert.equal(pickSuggestions(slots, TZ).length, 4);
  assert.deepEqual(hhmm(pickSuggestions(slots, TZ, 'afternoon')), ['12:00', '14:30', '15:30', '16:30']);
  assert.ok(hhmm(pickSuggestions(slots, TZ, 'morning')).every((t) => t < '12:00'));
  assert.deepEqual(hhmm(pickSuggestions(slots, TZ, '15:10', 2)), ['15:00', '15:30']);
  assert.deepEqual(hhmm(pickSuggestions(slots, TZ, '3pm', 1)), ['15:00']);
});

test('Irish phone numbers normalise to E.164', () => {
  assert.equal(normalizePhone('087 123 4567'), '+353871234567');
  assert.equal(normalizePhone('+353 87 123 4567'), '+353871234567');
  assert.equal(normalizePhone('00353871234567'), '+353871234567');
  assert.equal(normalizePhone('353871234567'), '+353871234567');
  assert.equal(normalizePhone('(01) 555 1234'), '+35315551234');
  assert.equal(normalizePhone(''), null);
});

test('service matching from what callers say', () => {
  assert.equal(findService(biz, 'relaxation massage').id, 'relax');
  assert.equal(findService(biz, 'a swedish one').id, 'relax');
  assert.equal(findService(biz, 'my neck is killing me').id, 'back');
  assert.equal(findService(biz, 'back'), biz.services[1]);
  assert.equal(findService(biz, 'facial'), null);
});
