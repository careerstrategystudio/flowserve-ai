// Calculadora de llamadas perdidas: fórmula, límites y parámetros de URL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute, fromQuery, DEFAULTS, PLAN_PRICE, WEEKS_PER_MONTH } from '../calculator/calc.js';

test('defaults: 8/week × 4.33 × 60% × 50% × €60', () => {
  const r = compute();
  const expected = 8 * (52 / 12) * 0.6 * 0.5 * 60; // 624
  assert.equal(r.lostRevenue, Math.round(expected));
  assert.equal(r.lostRevenue, 624);
  assert.equal(r.missedMonth, 35);
  assert.equal(r.lostBookings, 10.4);
  assert.equal(r.lostYear, Math.round(expected * 12));
  assert.equal(r.breakEven, Math.ceil(PLAN_PRICE / 60)); // 5
  assert.equal(r.covers, true);
  assert.deepEqual(r.inputs, DEFAULTS);
});

test('hand-checked example: 20 calls, 75% booking, 40% convert, €45', () => {
  const r = compute({ missed: 20, bookingShare: 75, wouldBook: 40, price: 45 });
  assert.equal(r.lostRevenue, Math.round(20 * WEEKS_PER_MONTH * 0.75 * 0.4 * 45)); // 1170
  assert.equal(r.breakEven, 6);
});

test('small numbers: says it does not cover the plan', () => {
  const r = compute({ missed: 1, bookingShare: 50, wouldBook: 50, price: 40 });
  assert.equal(r.covers, false); assert.equal(r.lostRevenue, 43);
});

test('bad input is clamped, never NaN or negative', () => {
  const r = compute({ missed: -5, bookingShare: 250, wouldBook: 'abc', price: '' });
  assert.equal(r.inputs.missed, 0); assert.equal(r.inputs.bookingShare, 100); assert.equal(r.inputs.wouldBook, 0);
  assert.equal(r.lostRevenue, 0); assert.ok(Number.isFinite(r.lostYear));
  assert.equal(compute({ price: 0 }).breakEven, null);
});

test('URL parameters prefill the calculator for ads', () => {
  assert.deepEqual(fromQuery('?missed=12&share=70&book=40&price=55&utm_source=meta'), { missed: 12, bookingShare: 70, wouldBook: 40, price: 55 });
  assert.deepEqual(fromQuery('?missed=abc&price='), {});
});
