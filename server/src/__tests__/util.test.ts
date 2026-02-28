import { describe, it, expect } from 'vitest';
import { toCamel, toCamelArray, camelToSnake } from '../util.js';

describe('toCamel', () => {
  it('converts snake_case keys to camelCase', () => {
    const input = { book_id: '123', created_at: '2025-01-01', title: 'Hello' };
    const result = toCamel(input);
    expect(result).toEqual({ bookId: '123', createdAt: '2025-01-01', title: 'Hello' });
  });

  it('handles keys with multiple underscores', () => {
    const input = { main_image_id: 'img-1', sort_order: 5 };
    const result = toCamel(input);
    expect(result).toEqual({ mainImageId: 'img-1', sortOrder: 5 });
  });

  it('leaves keys that are already camelCase untouched', () => {
    const input = { bookId: '123', title: 'Hello' };
    const result = toCamel(input);
    expect(result).toEqual({ bookId: '123', title: 'Hello' });
  });

  it('handles empty objects', () => {
    expect(toCamel({})).toEqual({});
  });

  it('preserves non-string values', () => {
    const input = { is_active: true, count: 42, data: null };
    const result = toCamel(input);
    expect(result).toEqual({ isActive: true, count: 42, data: null });
  });
});

describe('toCamelArray', () => {
  it('converts an array of snake_case objects', () => {
    const input = [
      { book_id: '1', created_at: '2025-01-01' },
      { book_id: '2', created_at: '2025-01-02' },
    ];
    const result = toCamelArray(input);
    expect(result).toEqual([
      { bookId: '1', createdAt: '2025-01-01' },
      { bookId: '2', createdAt: '2025-01-02' },
    ]);
  });

  it('handles empty arrays', () => {
    expect(toCamelArray([])).toEqual([]);
  });
});

describe('camelToSnake', () => {
  it('converts camelCase to snake_case', () => {
    expect(camelToSnake('bookId')).toBe('book_id');
    expect(camelToSnake('createdAt')).toBe('created_at');
    expect(camelToSnake('mainImageId')).toBe('main_image_id');
  });

  it('handles single-word strings (no conversion needed)', () => {
    expect(camelToSnake('title')).toBe('title');
    expect(camelToSnake('id')).toBe('id');
  });

  it('handles empty strings', () => {
    expect(camelToSnake('')).toBe('');
  });
});
