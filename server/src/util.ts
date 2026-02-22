/** Convert a snake_case DB row to camelCase for JSON responses. */
export function toCamel<T = Record<string, unknown>>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = value;
  }
  return out as T;
}

/** Convert an array of snake_case rows to camelCase. */
export function toCamelArray<T = Record<string, unknown>>(rows: Record<string, unknown>[]): T[] {
  return rows.map((row) => toCamel<T>(row));
}

/** Convert a camelCase key to snake_case. */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}
