import { describe, expect, it } from 'vitest';
import {
  DIVERGENCE_TYPES as backendTypes,
  TYPE_LABELS as backendLabels,
} from './divergence';
import {
  DIVERGENCE_TYPES as frontendTypes,
  TYPE_LABELS as frontendLabels,
} from '../../public/js/divergence';

/**
 * Guard the backend↔frontend divergence type sync.
 *
 * `src/domains/divergence.ts` is the single source of truth; the browser
 * mirror `public/js/divergence.js` must never drift from it. These tests
 * fail loudly if someone edits one side without the other.
 */
describe('divergence type sync (backend ↔ frontend)', () => {
  it('backend and frontend DIVERGENCE_TYPES match byte-for-byte (same order)', () => {
    expect(frontendTypes).toEqual([...backendTypes]);
  });

  it('backend and frontend TYPE_LABELS have identical key sets', () => {
    expect(Object.keys(frontendLabels).sort()).toEqual(Object.keys(backendLabels).sort());
  });

  it('every divergence type has a label in both backend and frontend', () => {
    for (const type of backendTypes) {
      expect(backendLabels[type]).toBeTruthy();
      expect(frontendLabels[type]).toBeTruthy();
    }
  });

  it('backend TYPE_LABELS values match the frontend labels exactly', () => {
    for (const type of backendTypes) {
      expect(frontendLabels[type]).toBe(backendLabels[type]);
    }
  });
});
