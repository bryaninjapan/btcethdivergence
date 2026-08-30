export const YEAR_RANGE = { min: 2021, max: 2026 };

export function yearOptions() {
  const years = [];
  for (let y = YEAR_RANGE.min; y <= YEAR_RANGE.max; y += 1) {
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
  return Math.floor(Date.UTC(year, month - 1, day, hour, 0, 0) / 1000);
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