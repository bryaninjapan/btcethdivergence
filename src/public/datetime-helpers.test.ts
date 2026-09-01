/**
 * datetime-helpers.js tests
 * Tests fillSelect, rebuildDays, setPickerFromEpoch, and pickerEpoch
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { fillSelect, rebuildDays, setPickerFromEpoch, pickerEpoch } from '../../public/js/datetime-helpers';
import { Timestamp } from '../../public/js/timestamp';

describe('datetime-helpers', () => {
  let pickerEl: HTMLElement;

  beforeEach(() => {
    // Create a minimal picker element with required selects
    pickerEl = document.createElement('div');
    pickerEl.setAttribute('data-picker', 'start');

    const yearSel = document.createElement('select');
    yearSel.setAttribute('data-part', 'year');

    const monthSel = document.createElement('select');
    monthSel.setAttribute('data-part', 'month');

    const daySel = document.createElement('select');
    daySel.setAttribute('data-part', 'day');

    const hourSel = document.createElement('select');
    hourSel.setAttribute('data-part', 'hour');

    pickerEl.appendChild(yearSel);
    pickerEl.appendChild(monthSel);
    pickerEl.appendChild(daySel);
    pickerEl.appendChild(hourSel);

    document.body.appendChild(pickerEl);
  });

  describe('fillSelect', () => {
    it('should populate select with option values', () => {
      const select = pickerEl.querySelector('[data-part="year"]') as HTMLSelectElement;
      const values = [2022, 2023, 2024, 2025];

      fillSelect(select, values);

      const options = select.querySelectorAll('option');
      expect(options.length).toBe(4);
      expect(options[0].value).toBe('2022');
      expect(options[0].textContent).toBe('2022');
      expect(options[3].value).toBe('2025');
      expect(options[3].textContent).toBe('2025');
    });

    it('should clear existing options before populating', () => {
      const select = pickerEl.querySelector('[data-part="year"]') as HTMLSelectElement;

      // Add initial options
      fillSelect(select, [2024]);
      expect(select.querySelectorAll('option').length).toBe(1);

      // Replace with new values
      fillSelect(select, [2025, 2026]);
      expect(select.querySelectorAll('option').length).toBe(2);
      expect(select.querySelector('option:first-child')?.value).toBe('2025');
    });

    it('should handle empty values array', () => {
      const select = pickerEl.querySelector('[data-part="year"]') as HTMLSelectElement;
      fillSelect(select, []);

      expect(select.querySelectorAll('option').length).toBe(0);
    });

    it('should convert values to strings', () => {
      const select = pickerEl.querySelector('[data-part="year"]') as HTMLSelectElement;
      const values = ['Jan', 'Feb', 'Mar'];

      fillSelect(select, values);

      const options = select.querySelectorAll('option');
      expect(options[0].value).toBe('Jan');
      expect(options[0].textContent).toBe('Jan');
    });
  });

  describe('rebuildDays', () => {
    it('should rebuild day options based on year and month', () => {
      const daySel = pickerEl.querySelector('[data-part="day"]') as HTMLSelectElement;
      const yearSel = pickerEl.querySelector('[data-part="year"]') as HTMLSelectElement;
      const monthSel = pickerEl.querySelector('[data-part="month"]') as HTMLSelectElement;

      fillSelect(yearSel, [2024]);
      fillSelect(monthSel, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

      yearSel.value = '2024';
      monthSel.value = '1'; // January has 31 days

      rebuildDays(pickerEl);

      expect(daySel.querySelectorAll('option').length).toBe(31);
    });

    it('should clamp day value when selecting a shorter month', () => {
      const daySel = pickerEl.querySelector('[data-part="day"]') as HTMLSelectElement;
      const yearSel = pickerEl.querySelector('[data-part="year"]') as HTMLSelectElement;
      const monthSel = pickerEl.querySelector('[data-part="month"]') as HTMLSelectElement;

      fillSelect(yearSel, [2024]);
      fillSelect(monthSel, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

      yearSel.value = '2024';
      monthSel.value = '1'; // January (31 days)
      rebuildDays(pickerEl);
      fillSelect(daySel, Array.from({ length: 31 }, (_, i) => i + 1));
      daySel.value = '31';

      // Switch to February (leap year 2024, 29 days)
      monthSel.value = '2';
      rebuildDays(pickerEl);

      // Day should be clamped to 29 (or less)
      const dayValue = Number(daySel.value);
      expect(dayValue).toBeLessThanOrEqual(29);
    });

    it('should throw error if required selects are missing', () => {
      const emptyPicker = document.createElement('div');
      document.body.appendChild(emptyPicker);

      expect(() => rebuildDays(emptyPicker)).toThrow('Time picker missing year/month/day selects');
    });
  });

  describe('setPickerFromEpoch', () => {
    it('should set picker values from Unix timestamp', () => {
      const yearSel = pickerEl.querySelector('[data-part="year"]') as HTMLSelectElement;
      const monthSel = pickerEl.querySelector('[data-part="month"]') as HTMLSelectElement;
      const daySel = pickerEl.querySelector('[data-part="day"]') as HTMLSelectElement;
      const hourSel = pickerEl.querySelector('[data-part="hour"]') as HTMLSelectElement;

      // Populate with year, months, days, and hours to simulate real picker
      fillSelect(yearSel, [2024]);
      fillSelect(monthSel, Array.from({ length: 12 }, (_, i) => i + 1));
      fillSelect(daySel, Array.from({ length: 31 }, (_, i) => i + 1));
      fillSelect(hourSel, Array.from({ length: 24 }, (_, i) => i));

      // Create Timestamp for 2024-06-15 14:00:00 UTC
      const ts = Timestamp.fromParts(2024, 6, 15, 14, 0, 0);
      setPickerFromEpoch(pickerEl, ts.toSeconds());

      expect(yearSel.value).toBe('2024');
      expect(monthSel.value).toBe('6');
      expect(hourSel.value).toBe('14');
      // Day should be 15 after rebuildDays is called
      expect(daySel.value).toBe('15');
    });

    it('should throw error if required selects are missing', () => {
      const emptyPicker = document.createElement('div');
      document.body.appendChild(emptyPicker);

      const ts = Timestamp.fromParts(2024, 1, 1, 0, 0, 0);
      expect(() => setPickerFromEpoch(emptyPicker, ts.toSeconds())).toThrow('Time picker missing selects');
    });
  });

  describe('pickerEpoch', () => {
    it('should extract Unix timestamp from picker', () => {
      const yearSel = pickerEl.querySelector('[data-part="year"]') as HTMLSelectElement;
      const monthSel = pickerEl.querySelector('[data-part="month"]') as HTMLSelectElement;
      const daySel = pickerEl.querySelector('[data-part="day"]') as HTMLSelectElement;
      const hourSel = pickerEl.querySelector('[data-part="hour"]') as HTMLSelectElement;

      // Populate and set values
      fillSelect(yearSel, [2024]);
      fillSelect(monthSel, Array.from({ length: 12 }, (_, i) => i + 1));
      fillSelect(daySel, Array.from({ length: 31 }, (_, i) => i + 1));
      fillSelect(hourSel, Array.from({ length: 24 }, (_, i) => i));

      yearSel.value = '2024';
      monthSel.value = '6';
      daySel.value = '15';
      hourSel.value = '14';

      const epoch = pickerEpoch(pickerEl);
      const ts = new Timestamp(epoch);
      const parts = ts.toParts();

      expect(parts.year).toBe(2024);
      expect(parts.month).toBe(6);
      expect(parts.day).toBe(15);
      expect(parts.hour).toBe(14);
    });

    it('should round-trip through setPickerFromEpoch', () => {
      const yearSel = pickerEl.querySelector('[data-part="year"]') as HTMLSelectElement;
      const monthSel = pickerEl.querySelector('[data-part="month"]') as HTMLSelectElement;
      const daySel = pickerEl.querySelector('[data-part="day"]') as HTMLSelectElement;
      const hourSel = pickerEl.querySelector('[data-part="hour"]') as HTMLSelectElement;

      // Populate selects
      fillSelect(yearSel, [2024]);
      fillSelect(monthSel, Array.from({ length: 12 }, (_, i) => i + 1));
      fillSelect(daySel, Array.from({ length: 31 }, (_, i) => i + 1));
      fillSelect(hourSel, Array.from({ length: 24 }, (_, i) => i));

      // Set initial values
      yearSel.value = '2024';
      monthSel.value = '3';
      daySel.value = '20';
      hourSel.value = '11';

      // Get epoch from picker
      const epoch1 = pickerEpoch(pickerEl);

      // Set picker from that epoch
      setPickerFromEpoch(pickerEl, epoch1);

      // Get epoch again
      const epoch2 = pickerEpoch(pickerEl);

      // Should be the same
      expect(epoch1).toBe(epoch2);
    });

    it('should throw error if required selects are missing', () => {
      const emptyPicker = document.createElement('div');
      document.body.appendChild(emptyPicker);

      expect(() => pickerEpoch(emptyPicker)).toThrow('Time picker missing selects');
    });
  });
});
