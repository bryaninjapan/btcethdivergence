/**
 * Shared datetime picker helpers — single source of truth for date/time selection
 * Previously duplicated in charts.js and records.js
 */

import { Timestamp } from './timestamp.js';

/**
 * Fill a select element with option values
 */
export function fillSelect(select, values) {
  select.replaceChildren();
  for (const v of values) {
    const opt = document.createElement('option');
    opt.value = String(v);
    opt.textContent = String(v);
    select.appendChild(opt);
  }
}

/**
 * Rebuild day options based on current year/month selection
 * Handles different month lengths and leap years
 */
export function rebuildDays(pickerEl) {
  const yearSel = pickerEl.querySelector('[data-part="year"]');
  const monthSel = pickerEl.querySelector('[data-part="month"]');
  const daySel = pickerEl.querySelector('[data-part="day"]');

  if (!yearSel || !monthSel || !daySel) {
    throw new Error('Time picker missing year/month/day selects');
  }

  const year = Number(yearSel.value);
  const month = Number(monthSel.value);
  const daysInCurrentMonth = new Date(year, month, 0).getDate();
  const previousDayValue = Number(daySel.value) || 1;

  fillSelect(daySel, Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1));
  daySel.value = String(Math.min(previousDayValue, daysInCurrentMonth));
}

/**
 * Set picker from Unix timestamp (seconds)
 */
export function setPickerFromEpoch(pickerEl, ts) {
  const timestamp = new Timestamp(ts);
  const parts = timestamp.toParts();

  const yearSel = pickerEl.querySelector('[data-part="year"]');
  const monthSel = pickerEl.querySelector('[data-part="month"]');
  const daySel = pickerEl.querySelector('[data-part="day"]');
  const hourSel = pickerEl.querySelector('[data-part="hour"]');

  if (!yearSel || !monthSel || !daySel || !hourSel) {
    throw new Error('Time picker missing selects');
  }

  yearSel.value = String(parts.year);
  monthSel.value = String(parts.month);
  hourSel.value = String(parts.hour);
  daySel.value = String(parts.day);

  rebuildDays(pickerEl);
}

/**
 * Extract Unix timestamp from picker (seconds since epoch)
 */
export function pickerEpoch(pickerEl) {
  const yearSel = pickerEl.querySelector('[data-part="year"]');
  const monthSel = pickerEl.querySelector('[data-part="month"]');
  const daySel = pickerEl.querySelector('[data-part="day"]');
  const hourSel = pickerEl.querySelector('[data-part="hour"]');

  if (!yearSel || !monthSel || !daySel || !hourSel) {
    throw new Error('Time picker missing selects');
  }

  const year = Number(yearSel.value);
  const month = Number(monthSel.value);
  const day = Number(daySel.value);
  const hour = Number(hourSel.value);

  return Timestamp.fromParts(year, month, day, hour, 0, 0).toSeconds();
}
