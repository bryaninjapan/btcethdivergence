import { Timestamp } from './timestamp.js';

export const YEAR_RANGE = { min: 2021, max: () => new Date().getUTCFullYear() + 1 };

export function yearOptions() {
  const years = [];
  const maxYear = typeof YEAR_RANGE.max === 'function' ? YEAR_RANGE.max() : YEAR_RANGE.max;
  for (let y = YEAR_RANGE.min; y <= maxYear; y += 1) {
    years.push(y);
  }
  return years;
}

export function monthOptions() {
  const months = [];
  for (let m = 1; m <= 12; m += 1) {
    months.push(m);
  }
  return months;
}

export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function dayOptions(year, month) {
  const days = [];
  const max = daysInMonth(year, month);
  for (let d = 1; d <= max; d += 1) {
    days.push(d);
  }
  return days;
}

export function hourOptions() {
  const hours = [];
  for (let h = 0; h <= 23; h += 1) {
    hours.push(h);
  }
  return hours;
}

export function buildUtcEpoch(year, month, day, hour) {
  return Timestamp.fromMillis(Date.UTC(year, month - 1, day, hour, 0, 0)).toSeconds();
}

export function epochToParts(ts) {
  const d = new Date(ts * 1000);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
  };
}