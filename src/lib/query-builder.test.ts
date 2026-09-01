import { describe, it, expect } from 'vitest';
import { QueryBuilder } from './query-builder';

describe('QueryBuilder', () => {
  const qb = new QueryBuilder();

  describe('insertMany', () => {
    it('should generate INSERT statement for single row', () => {
      const rows = [{ id: 1, name: 'Alice', age: 30 }];
      const result = qb.insertMany('users', rows);

      expect(result.sql).toContain('INSERT INTO users');
      expect(result.sql).toContain('VALUES');
      // Columns preserve original object key order: id, name, age
      expect(result.sql).toContain('(id, name, age)');
      expect(result.params).toEqual([1, 'Alice', 30]);
    });

    it('should generate INSERT statement for multiple rows', () => {
      const rows = [
        { id: 1, name: 'Alice', age: 30 },
        { id: 2, name: 'Bob', age: 25 },
      ];
      const result = qb.insertMany('users', rows);

      expect(result.sql).toMatch(/INSERT INTO users/);
      expect(result.sql).toContain('(id, name, age)');
      expect(result.sql).toMatch(/VALUES \(\?, \?, \?\), \(\?, \?, \?\)/);
      // Params follow original column order: id, name, age per row
      expect(result.params).toEqual([1, 'Alice', 30, 2, 'Bob', 25]);
    });

    it('should preserve object key order', () => {
      const rows1 = [{ z: 1, a: 2, m: 3 }];
      const rows2 = [{ a: 2, m: 3, z: 1 }];

      const result1 = qb.insertMany('test', rows1);
      const result2 = qb.insertMany('test', rows2);

      // Different key orders produce different SQL (order preserved)
      expect(result1.sql).toContain('(z, a, m)');
      expect(result2.sql).toContain('(a, m, z)');
      expect(result1.params).toEqual([1, 2, 3]);
      expect(result2.params).toEqual([2, 3, 1]);
    });

    it('should handle static fields (prepended columns)', () => {
      const rows = [
        { open_time: 1000, open: 100 },
        { open_time: 2000, open: 200 },
      ];
      const result = qb.insertMany('klines', rows, { symbol: 'BTC' });

      // Static fields prepended, then row keys: symbol, open_time, open
      expect(result.sql).toContain('(symbol, open_time, open)');
      // Static field value (BTC) appears first in each row
      expect(result.params).toEqual(['BTC', 1000, 100, 'BTC', 2000, 200]);
    });

    it('should handle numeric and string values', () => {
      const rows = [
        { time: 12345, value: 'test', count: 42 },
      ];
      const result = qb.insertMany('events', rows);

      // Original column order: time, value, count
      expect(result.sql).toContain('(time, value, count)');
      expect(result.params).toEqual([12345, 'test', 42]);
    });

    it('should throw error on empty rows array', () => {
      expect(() => qb.insertMany('users', [])).toThrow('rows array cannot be empty');
    });

    it('should throw error on rows with no properties', () => {
      const rows = [{}];
      expect(() => qb.insertMany('users', rows)).toThrow('no columns found');
    });

    it('should generate correct SQL for Kline data', () => {
      const rows = [
        { open_time: 1693497600, open: 26000, high: 26100, low: 25900, close: 26050, volume: 1500 },
        { open_time: 1693498200, open: 26050, high: 26200, low: 25950, close: 26100, volume: 1600 },
      ];
      const result = qb.insertMany('klines', rows, { symbol: 'BTC' });

      expect(result.sql).toContain('INSERT INTO klines');
      // Static field first, then row keys in original order
      expect(result.sql).toContain('(symbol, open_time, open, high, low, close, volume)');
      // Params: symbol prepended to each row, then row values in original order
      expect(result.params).toEqual([
        'BTC', 1693497600, 26000, 26100, 25900, 26050, 1500,
        'BTC', 1693498200, 26050, 26200, 25950, 26100, 1600,
      ]);
    });
  });
});
