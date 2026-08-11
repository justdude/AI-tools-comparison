import type { LoadOptions } from 'devextreme/common/data';
import type { PagedResult } from './types';

type FilterOperator = '=' | '<>' | '>' | '>=' | '<' | '<=' | 'contains' | 'notcontains' | 'startswith' | 'endswith';

const BINARY_OPERATORS: readonly FilterOperator[] = [
  '=',
  '<>',
  '>',
  '>=',
  '<',
  '<=',
  'contains',
  'notcontains',
  'startswith',
  'endswith',
];

function isBinaryOperator(value: string): value is FilterOperator {
  return (BINARY_OPERATORS as readonly string[]).includes(value);
}

function toComparableString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function getFieldValue<T extends object>(row: T, field: string): unknown {
  let current: unknown = row;
  for (const part of field.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : -1;
  if (b === null || b === undefined) return 1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const aStr = toComparableString(a);
  const bStr = toComparableString(b);
  if (aStr === bStr) return 0;
  return aStr < bStr ? -1 : 1;
}

function matchesBinary<T extends object>(row: T, field: string, op: FilterOperator, expected: unknown): boolean {
  const actual = getFieldValue(row, field);
  switch (op) {
    case '=':
      return compareValues(actual, expected) === 0;
    case '<>':
      return compareValues(actual, expected) !== 0;
    case '>':
      return compareValues(actual, expected) > 0;
    case '>=':
      return compareValues(actual, expected) >= 0;
    case '<':
      return compareValues(actual, expected) < 0;
    case '<=':
      return compareValues(actual, expected) <= 0;
    case 'contains':
      return toComparableString(actual).toLowerCase().includes(toComparableString(expected).toLowerCase());
    case 'notcontains':
      return !toComparableString(actual).toLowerCase().includes(toComparableString(expected).toLowerCase());
    case 'startswith':
      return toComparableString(actual).toLowerCase().startsWith(toComparableString(expected).toLowerCase());
    case 'endswith':
      return toComparableString(actual).toLowerCase().endsWith(toComparableString(expected).toLowerCase());
  }
}

function evaluateFilterNode<T extends object>(row: T, node: unknown): boolean {
  if (Array.isArray(node)) {
    return evaluateFilterArray(row, node as unknown[]);
  }
  throw new Error(`Unsupported filter expression: ${JSON.stringify(node)}`);
}

function evaluateFilterArray<T extends object>(row: T, expr: unknown[]): boolean {
  if (expr.length === 2 && expr[0] === '!') {
    return !evaluateFilterNode(row, expr[1]);
  }

  if (expr.length === 3 && typeof expr[0] === 'string') {
    const op = expr[1];
    if (typeof op !== 'string' || !isBinaryOperator(op)) {
      throw new Error(`Unsupported filter operator: ${toComparableString(op)}`);
    }
    return matchesBinary(row, expr[0], op, expr[2]);
  }

  if (expr.length >= 3 && expr.length % 2 === 1) {
    let result = evaluateFilterNode(row, expr[0]);
    for (let i = 1; i < expr.length; i += 2) {
      const connector = expr[i];
      if (connector !== 'and' && connector !== 'or') {
        throw new Error(`Unsupported filter operator: ${toComparableString(connector)}`);
      }
      const nextResult = evaluateFilterNode(row, expr[i + 1]);
      result = connector === 'and' ? result && nextResult : result || nextResult;
    }
    return result;
  }

  throw new Error(`Unsupported filter expression: ${JSON.stringify(expr)}`);
}

export function matchesFilter<T extends object>(row: T, filter: unknown): boolean {
  if (filter === undefined) return true;
  if (!Array.isArray(filter)) {
    throw new Error(`Unsupported filter expression: ${JSON.stringify(filter)}`);
  }
  return evaluateFilterArray(row, filter as unknown[]);
}

type SortSelector<T> = string | ((row: T) => unknown);

interface NormalizedSort<T> {
  selector: SortSelector<T>;
  desc: boolean;
}

function normalizeSortDescriptors<T>(sort: LoadOptions<T>['sort']): NormalizedSort<T>[] {
  if (sort === undefined) return [];
  const list = Array.isArray(sort) ? sort : [sort];
  return list.map((item) => {
    if (typeof item === 'string' || typeof item === 'function') {
      return { selector: item, desc: false };
    }
    return { selector: item.selector, desc: item.desc ?? false };
  });
}

function resolveSortValue<T extends object>(row: T, selector: SortSelector<T>): unknown {
  return typeof selector === 'function' ? selector(row) : getFieldValue(row, selector);
}

function sortRows<T extends object>(rows: T[], descriptors: NormalizedSort<T>[]): T[] {
  if (descriptors.length === 0) return rows;
  return [...rows].sort((a, b) => {
    for (const { selector, desc } of descriptors) {
      const cmp = compareValues(resolveSortValue(a, selector), resolveSortValue(b, selector));
      if (cmp !== 0) return desc ? -cmp : cmp;
    }
    return 0;
  });
}

export function queryLocal<T extends object>(rows: T[], options: LoadOptions<T>): PagedResult<T> {
  const filter: unknown = options.filter;
  const filtered = filter === undefined ? rows : rows.filter((row) => matchesFilter(row, filter));
  const sorted = sortRows(filtered, normalizeSortDescriptors(options.sort));
  const totalCount = sorted.length;
  const skip = options.skip ?? 0;
  const take = options.take ?? sorted.length;
  return { data: sorted.slice(skip, skip + take), totalCount };
}
