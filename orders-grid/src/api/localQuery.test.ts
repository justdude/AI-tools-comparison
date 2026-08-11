import { describe, expect, it } from 'vitest';
import { matchesFilter, queryLocal } from './localQuery';

interface Row {
  id: number;
  name: string;
  age: number;
  active: boolean;
}

const rows: Row[] = [
  { id: 1, name: 'Alice', age: 30, active: true },
  { id: 2, name: 'bob', age: 25, active: false },
  { id: 3, name: 'Charlie', age: 40, active: true },
  { id: 4, name: 'Dave', age: 22, active: false },
  { id: 5, name: 'eve', age: 35, active: true },
];

describe('matchesFilter', () => {
  it('matches equality', () => {
    expect(matchesFilter(rows[0], ['age', '=', 30])).toBe(true);
    expect(matchesFilter(rows[0], ['age', '=', 31])).toBe(false);
  });

  it('matches contains case-insensitively', () => {
    expect(matchesFilter(rows[0], ['name', 'contains', 'LIC'])).toBe(true);
    expect(matchesFilter(rows[1], ['name', 'contains', 'LIC'])).toBe(false);
  });

  it('matches startswith case-insensitively', () => {
    expect(matchesFilter(rows[1], ['name', 'startswith', 'BO'])).toBe(true);
    expect(matchesFilter(rows[1], ['name', 'startswith', 'AL'])).toBe(false);
  });

  it('combines criteria with an and group', () => {
    expect(matchesFilter(rows[0], [['age', '>', 20], 'and', ['active', '=', true]])).toBe(true);
    expect(matchesFilter(rows[1], [['age', '>', 20], 'and', ['active', '=', true]])).toBe(false);
  });

  it('combines criteria with an or group', () => {
    expect(matchesFilter(rows[1], [['age', '>', 100], 'or', ['active', '=', false]])).toBe(true);
    expect(matchesFilter(rows[0], [['age', '>', 100], 'or', ['active', '=', false]])).toBe(false);
  });

  it('negates a criterion with !', () => {
    expect(matchesFilter(rows[0], ['!', ['active', '=', false]])).toBe(true);
    expect(matchesFilter(rows[1], ['!', ['active', '=', false]])).toBe(false);
  });

  it('treats an undefined filter as always true', () => {
    expect(matchesFilter(rows[0], undefined)).toBe(true);
    expect(matchesFilter(rows[3], undefined)).toBe(true);
  });

  it('throws on an unknown operator', () => {
    expect(() => matchesFilter(rows[0], ['age', 'between', 30])).toThrow('Unsupported filter operator: between');
  });
});

describe('queryLocal', () => {
  it('applies skip/take while reporting the unpaged totalCount', () => {
    const result = queryLocal(rows, { skip: 1, take: 2 });
    expect(result.totalCount).toBe(5);
    expect(result.data).toHaveLength(2);
    expect(result.data.map((row) => row.id)).toEqual([2, 3]);
  });

  it('sorts descending', () => {
    const result = queryLocal(rows, { sort: [{ selector: 'age', desc: true }] });
    expect(result.data.map((row) => row.age)).toEqual([40, 35, 30, 25, 22]);
  });

  it('filters before paging', () => {
    const result = queryLocal(rows, { filter: ['active', '=', true], skip: 0, take: 2 });
    expect(result.totalCount).toBe(3);
    expect(result.data.map((row) => row.id)).toEqual([1, 3]);
  });
});
