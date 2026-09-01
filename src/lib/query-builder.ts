export interface InsertStatement {
  sql: string;
  params: (string | number)[];
}

export class QueryBuilder {
  /**
   * Build a parameterized INSERT statement for multiple rows.
   * Dynamically extracts column names from the first row's object keys.
   * All rows must have the same shape (same keys in same order).
   *
   * @param tableName - Database table name
   * @param rows - Array of objects to insert (must have consistent key order)
   * @param staticFields - Optional object with static columns to prepend (e.g., {symbol: 'BTC'})
   * @returns InsertStatement with sql string and flattened params array
   */
  insertMany<T extends Record<string, any>>(
    tableName: string,
    rows: T[],
    staticFields?: Record<string, string | number>
  ): InsertStatement {
    if (!rows || rows.length === 0) {
      throw new Error('insertMany: rows array cannot be empty');
    }

    // Extract column names: static fields first, then row keys (preserve original order)
    const rowKeys = Object.keys(rows[0]);
    const allKeys = staticFields ? [...Object.keys(staticFields), ...rowKeys] : rowKeys;

    if (allKeys.length === 0) {
      throw new Error('insertMany: no columns found in rows');
    }

    // Build tuple placeholders: (?, ?, ?) for each row
    const placeholdersPerRow = allKeys.length;
    const tuples = rows
      .map(() => `(${Array(placeholdersPerRow).fill('?').join(', ')})`)
      .join(', ');

    const sql = `INSERT INTO ${tableName} (${allKeys.join(', ')}) VALUES ${tuples}`;

    // Flatten params array: all columns in sorted order for each row
    const params: (string | number)[] = [];
    for (const row of rows) {
      for (const key of allKeys) {
        if (staticFields && key in staticFields) {
          params.push(staticFields[key]);
        } else {
          params.push(row[key]);
        }
      }
    }

    return { sql, params };
  }
}
