---
phase: 5
title: "Records Filtering & UTC Pickers — Implementation Notes"
date: 2026-08-31
---

# Phase 5 Implementation Notes

Technical reference for filtering, datetime handling, and dropdown picker patterns.

---

## Filtering Implementation

### Backend: Parameterized WHERE Clauses

```typescript
// src/lib/db.ts
interface ListRecordsFilter {
  type?: string;
  tag?: string;
}

export async function listRecords(
  db: D1Database,
  filters?: ListRecordsFilter
): Promise<DivergenceRecord[]> {
  let query = 'SELECT * FROM divergence_records WHERE 1=1';
  const params: any[] = [];
  
  if (filters?.type) {
    query += ' AND type = ?';
    params.push(filters.type);
  }
  
  if (filters?.tag) {
    query += ' AND tags LIKE ?';
    params.push(`%${filters.tag}%`);
  }
  
  query += ' ORDER BY start_time DESC';
  
  return await db.prepare(query).bind(...params).all();
}
```

**Why `LIKE` for tags:**
- `tags` is stored as delimited text (or JSON in future)
- Substring match allows partial search: "btc" matches "bitcoin", "btc-usd", etc.
- `LIKE` is case-insensitive by default in SQLite

**Why parameterized:**
- SQL injection prevention: `bind(value)` escapes special chars
- Never concat user input into SQL strings

### Frontend: Query String Builder

```javascript
// public/js/records.js
function buildFilterParams() {
  const params = new URLSearchParams();
  
  if (typeFilter) {
    params.append('type', typeFilter);
  }
  
  if (tagFilter) {
    params.append('tag', tagFilter);
  }
  
  return params.toString();  // "?type=time_lag&tag=btc"
}

async function loadRecords() {
  const queryString = buildFilterParams();
  const url = queryString ? `/api/records?${queryString}` : '/api/records';
  const records = await api(url);
  renderTable(records);
}
```

### Debouncing Filter Input

```javascript
let filterDebounceTimer;

document.getElementById('tag-filter').addEventListener('input', (e) => {
  clearTimeout(filterDebounceTimer);
  tagFilter = e.target.value;
  
  filterDebounceTimer = setTimeout(() => {
    loadRecords();
  }, 250);  // Wait 250ms after user stops typing before fetching
});
```

**Why debounce:**
- User types "btc" (3 keystrokes) → without debounce: 3 requests
- With 250ms debounce: 1 request (after user stops typing)
- Reduces server load significantly

---

## Datetime Module: Pure UTC Helpers

### Core Functions

```javascript
// public/js/datetime.js

// Option generators (no DOM)
export const yearOptions = () => {
  const now = new Date().getUTCFullYear();
  return Array.from({ length: 50 }, (_, i) => ({
    value: now - i,
    label: `${now - i}`
  }));
};

export const monthOptions = () => 
  Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: String(i + 1).padStart(2, '0')  // "01", "02", ...
  }));

export const hourOptions = () =>
  Array.from({ length: 24 }, (_, i) => ({
    value: i,
    label: String(i).padStart(2, '0')  // "00", "01", ...
  }));

// Leap year calculation (key logic)
const isLeapYear = (year) => {
  // Leap if:
  // - divisible by 4 AND not divisible by 100
  // - OR divisible by 400
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
};

export const daysInMonth = (year, month) => {
  const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  
  if (month === 1 && isLeapYear(year)) {
    return 29;  // February in leap year
  }
  
  return daysPerMonth[month];
};

export const dayOptions = (year, month) =>
  Array.from({ length: daysInMonth(year, month) }, (_, i) => ({
    value: i + 1,
    label: String(i + 1).padStart(2, '0')
  }));

// Convert picker values to unix timestamp
export const buildUtcEpoch = (year, month, day, hour, minute = 0) => {
  const date = new Date(Date.UTC(year, month, day, hour, minute, 0, 0));
  return Math.floor(date.getTime() / 1000);  // Seconds since epoch
};

// Convert unix timestamp to picker values
export const epochToParts = (epochSeconds) => {
  const date = new Date(epochSeconds * 1000);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),        // 0-11
    day: date.getUTCDate(),           // 1-31
    hour: date.getUTCHours(),         // 0-23
    minute: date.getUTCMinutes()      // 0-59
  };
};
```

### Why Pure Functions (No DOM)?

```javascript
// ✅ GOOD: Test this without DOM
const epoch = buildUtcEpoch(2024, 0, 15, 12);
expect(epoch).toBe(1705324800);

// ❌ HARD TO TEST: Mixes logic with DOM
function buildEpochAndUpdateField() {
  const year = document.getElementById('year').value;
  // ... harder to test in isolation
}
```

**Benefits:**
- Can test all logic in `vitest` without jsdom
- Reusable in any context (Worker, Node script, etc.)
- Easy to reason about (input → output, no side effects)

---

## Leap Year Tests

### Test Cases

```typescript
// public/js/datetime.test.ts
describe('daysInMonth', () => {
  it('February in leap year (2024) has 29 days', () => {
    expect(daysInMonth(2024, 1)).toBe(29);
  });
  
  it('February in non-leap year (2023) has 28 days', () => {
    expect(daysInMonth(2023, 1)).toBe(28);
  });
  
  it('century year divisible by 400 (2000) is leap', () => {
    expect(daysInMonth(2000, 1)).toBe(29);
  });
  
  it('century year not divisible by 400 (1900) is not leap', () => {
    expect(daysInMonth(1900, 1)).toBe(28);
  });
  
  it('30-day months (April, June, Sept, Nov)', () => {
    expect(daysInMonth(2024, 3)).toBe(30);  // April
    expect(daysInMonth(2024, 5)).toBe(30);  // June
    expect(daysInMonth(2024, 8)).toBe(30);  // September
    expect(daysInMonth(2024, 10)).toBe(30); // November
  });
  
  it('31-day months (Jan, Mar, May, Jul, Aug, Oct, Dec)', () => {
    [0, 2, 4, 6, 7, 9, 11].forEach(month => {
      expect(daysInMonth(2024, month)).toBe(31);
    });
  });
});
```

### Leap Year Rules

| Condition | Leap? | Example |
|-----------|-------|---------|
| Divisible by 4, NOT by 100 | YES | 2024, 2020, 2016 |
| Divisible by 400 | YES | 2000 |
| Divisible by 100, NOT by 400 | NO | 1900, 1800 |

---

## Frontend Picker Integration

### HTML Structure

```html
<div class="time-picker-group">
  <label>開始時間 (UTC)</label>
  <div class="time-picker" data-picker="start">
    <select data-part="year" id="start-year"></select>
    <select data-part="month" id="start-month"></select>
    <select data-part="day" id="start-day"></select>
    <select data-part="hour" id="start-hour"></select>
  </div>
</div>
```

### Initialization

```javascript
// public/js/records.js
import {
  yearOptions,
  monthOptions,
  dayOptions,
  hourOptions,
  buildUtcEpoch,
  epochToParts,
  daysInMonth
} from './datetime.js';

function initPickers() {
  // Populate year/month/hour (static options)
  const yearSelect = document.getElementById('start-year');
  yearOptions().forEach(opt => {
    const el = document.createElement('option');
    el.value = opt.value;
    el.textContent = opt.label;
    yearSelect.appendChild(el);
  });
  
  // Similar for month and hour
  
  // Day options are dynamic (depend on year/month)
  populateDays('start');
  
  // Wire change listeners
  document.getElementById('start-year').addEventListener('change', () => {
    populateDays('start');
  });
  document.getElementById('start-month').addEventListener('change', () => {
    populateDays('start');
  });
}

function populateDays(prefix) {
  const year = parseInt(document.getElementById(`${prefix}-year`).value);
  const month = parseInt(document.getElementById(`${prefix}-month`).value);
  
  const daySelect = document.getElementById(`${prefix}-day`);
  daySelect.innerHTML = '';
  
  dayOptions(year, month).forEach(opt => {
    const el = document.createElement('option');
    el.value = opt.value;
    el.textContent = opt.label;
    daySelect.appendChild(el);
  });
}

function getPickerValue(prefix) {
  const year = parseInt(document.getElementById(`${prefix}-year`).value);
  const month = parseInt(document.getElementById(`${prefix}-month`).value);
  const day = parseInt(document.getElementById(`${prefix}-day`).value);
  const hour = parseInt(document.getElementById(`${prefix}-hour`).value);
  
  return buildUtcEpoch(year, month, day, hour);
}

function setPickerValue(prefix, epochSeconds) {
  const parts = epochToParts(epochSeconds);
  
  document.getElementById(`${prefix}-year`).value = parts.year;
  document.getElementById(`${prefix}-month`).value = parts.month;
  populateDays(prefix);  // Rebuild day options
  document.getElementById(`${prefix}-day`).value = parts.day;
  document.getElementById(`${prefix}-hour`).value = parts.hour;
}
```

---

## Testing Filter Behavior

### Backend Route Contract Tests

```typescript
// src/routes/records.test.ts
describe('GET /api/records (filtering)', () => {
  beforeEach(() => {
    db.reset();
    db.insert('divergence_records', [
      { id: 1, start_time: 100, end_time: 200, type: 'time_lag', tags: ['btc'] },
      { id: 2, start_time: 300, end_time: 400, type: 'sentiment_divergence', tags: ['eth'] },
      { id: 3, start_time: 500, end_time: 600, type: 'time_lag', tags: ['btc', 'usdt'] }
    ]);
  });
  
  it('type filter isolates one type', async () => {
    const res = await app.request(
      new Request('http://localhost/api/records?type=time_lag')
    );
    const data = await res.json();
    expect(data.data.length).toBe(2);
    expect(data.data.every(r => r.type === 'time_lag')).toBe(true);
  });
  
  it('tag filter partial-matches (LIKE)', async () => {
    const res = await app.request(
      new Request('http://localhost/api/records?tag=btc')
    );
    const data = await res.json();
    expect(data.data.length).toBe(2);  // ids 1 and 3
  });
  
  it('combined type + tag filters (AND)', async () => {
    const res = await app.request(
      new Request('http://localhost/api/records?type=time_lag&tag=usdt')
    );
    const data = await res.json();
    expect(data.data.length).toBe(1);  // id 3 only
    expect(data.data[0].id).toBe(3);
  });
  
  it('invalid type enum → 400', async () => {
    const res = await app.request(
      new Request('http://localhost/api/records?type=bogus')
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.ok).toBe(false);
  });
});
```

---

**Last Updated:** 2026-08-31
