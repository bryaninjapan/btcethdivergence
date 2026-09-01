import { describe, expect, it } from 'vitest';
import { DIVERGENCE_TYPES as BACKEND_TYPES, TYPE_LABELS as BACKEND_LABELS } from './divergence';
import {
  DIVERGENCE_TYPES as FRONTEND_TYPES,
  TYPE_LABELS as FRONTEND_LABELS,
} from '../../public/js/divergence.js';

describe('divergence type sync (backend src/domains/divergence.ts ↔ frontend public/js/divergence.js)', () => {
  it('backend and frontend DIVERGENCE_TYPES match byte-for-byte', () => {
    expect(JSON.stringify(FRONTEND_TYPES)).toBe(JSON.stringify(BACKEND_TYPES));
    expect(FRONTEND_TYPES).toEqual([...BACKEND_TYPES]);
  });

  it('backend and frontend DIVERGENCE_TYPES have identical ordering', () => {
    expect([...BACKEND_TYPES]).toEqual([...FRONTEND_TYPES]);
  });

  it('backend and frontend TYPE_LABELS cover exactly the same keys', () => {
    expect(Object.keys(FRONTEND_LABELS).sort()).toEqual(Object.keys(BACKEND_LABELS).sort());
  });

  it('backend and frontend TYPE_LABELS values match byte-for-byte for every type', () => {
    for (const type of BACKEND_TYPES) {
      expect(FRONTEND_LABELS[type]).toBe(BACKEND_LABELS[type]);
    }
  });

  it('every divergence type has a non-empty label in both backends', () => {
    for (const type of BACKEND_TYPES) {
      expect(BACKEND_LABELS[type]).toBeTruthy();
      expect(FRONTEND_LABELS[type]).toBeTruthy();
    }
  });

  it('DIVERGENCE_TYPES contains no duplicates (backend)', () => {
    expect(new Set(BACKEND_TYPES).size).toBe(BACKEND_TYPES.length);
  });
});