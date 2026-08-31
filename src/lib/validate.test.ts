import { describe, it, expect } from 'vitest';
import { ValidationError } from './errors';
import { validatePositiveInteger } from './validate';

describe('validatePositiveInteger', () => {
  describe('valid inputs', () => {
    it.each([
      ['1', 1],
      ['100', 100],
      ['999999', 999999],
    ])('returns %s as the number %i', (input, expected) => {
      expect(validatePositiveInteger(input, 'id')).toBe(expected);
    });
  });

  describe('invalid: non-positive / non-integer strings', () => {
    it.each([['0'], ['-1'], ['1.5'], ['abc']])(
      'throws ValidationError for %s',
      (input) => {
        expect(() => validatePositiveInteger(input, 'id')).toThrow(ValidationError);
      },
    );
  });

  describe('invalid: empty / missing values', () => {
    it.each([[''], ['null'], [undefined]])('throws ValidationError for %s', (input) => {
      expect(() => validatePositiveInteger(input, 'id')).toThrow(ValidationError);
    });
  });

  describe('invalid: special numeric values', () => {
    it('throws ValidationError for Infinity', () => {
      expect(() => validatePositiveInteger('Infinity', 'id')).toThrow(ValidationError);
    });

    it('throws ValidationError for NaN', () => {
      expect(() => validatePositiveInteger('NaN', 'id')).toThrow(ValidationError);
    });

    it('throws ValidationError for scientific notation (1e3)', () => {
      expect(() => validatePositiveInteger('1e3', 'id')).toThrow(ValidationError);
    });

    it('throws ValidationError for hex notation (0x10)', () => {
      expect(() => validatePositiveInteger('0x10', 'id')).toThrow(ValidationError);
    });

    it('throws ValidationError for leading/trailing whitespace ("  1  ")', () => {
      expect(() => validatePositiveInteger('  1  ', 'id')).toThrow(ValidationError);
    });

    it('throws ValidationError for leading plus sign ("+1")', () => {
      expect(() => validatePositiveInteger('+1', 'id')).toThrow(ValidationError);
    });
  });

  describe('error message consistency', () => {
    it('includes the field name and "must be a positive integer" in the message', () => {
      try {
        validatePositiveInteger('abc', 'Record ID');
        expect.unreachable('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).message).toContain('Record ID must be a positive integer');
      }
    });

    it('produces the same error message for every invalid-input branch (regex fail vs <= 0)', () => {
      let regexFailMessage = '';
      let rangeFailMessage = '';
      try {
        validatePositiveInteger('abc', 'id');
      } catch (error) {
        regexFailMessage = (error as ValidationError).message;
      }
      try {
        validatePositiveInteger('0', 'id');
      } catch (error) {
        rangeFailMessage = (error as ValidationError).message;
      }
      expect(regexFailMessage).toBe(rangeFailMessage);
      expect(regexFailMessage).toBe("Validation failed on field 'id': id must be a positive integer");
    });

    it('defaults the field name to "id" when not provided', () => {
      try {
        validatePositiveInteger('abc');
        expect.unreachable('should have thrown');
      } catch (error) {
        expect((error as ValidationError).message).toContain("field 'id'");
      }
    });
  });

  describe('type safety: non-string unknown values', () => {
    it.each([[123], [true], [null], [{}], [[]]])(
      'throws ValidationError for non-string input %o',
      (input) => {
        expect(() => validatePositiveInteger(input as unknown as string, 'id')).toThrow(
          ValidationError,
        );
      },
    );
  });

  describe('invalid: numbers exceeding safe integer range', () => {
    it('rejects number strings exceeding safe integer range (2^53)', () => {
      expect(() => validatePositiveInteger('9007199254740992', 'id')).toThrow(ValidationError);
    });

    it('rejects very large number strings', () => {
      expect(() => validatePositiveInteger('99999999999999999999', 'id')).toThrow(ValidationError);
    });

    it('accepts maximum safe integer (2^53 - 1)', () => {
      expect(validatePositiveInteger('9007199254740991', 'id')).toBe(9007199254740991);
    });
  });
});
