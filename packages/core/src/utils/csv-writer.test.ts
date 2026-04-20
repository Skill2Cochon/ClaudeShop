import { describe, expect, it } from 'vitest';
import { toCsv } from './csv-writer.js';

describe('toCsv', () => {
  it('emits header + rows with CRLF', () => {
    const out = toCsv([
      { name: 'Hello Tee', sku: 'HCS-TEE-S' },
      { name: 'Bye Tee', sku: 'HCS-TEE-M' },
    ]);
    expect(out).toBe('name,sku\r\nHello Tee,HCS-TEE-S\r\nBye Tee,HCS-TEE-M\r\n');
  });

  it('quotes fields containing the separator', () => {
    const out = toCsv([{ name: 'Hello, world', tagline: 'simple' }]);
    expect(out).toBe('name,tagline\r\n"Hello, world",simple\r\n');
  });

  it('escapes embedded double quotes by doubling them', () => {
    const out = toCsv([{ name: 'She said "hi"' }]);
    expect(out).toBe('name\r\n"She said ""hi"""\r\n');
  });

  it('stringifies numbers, booleans, null, undefined', () => {
    const out = toCsv([
      { a: 1, b: true, c: null, d: undefined },
    ] as unknown as Array<Record<string, unknown>>);
    expect(out).toBe('a,b,c,d\r\n1,true,,\r\n');
  });

  it('respects explicit column order + whitelist', () => {
    const out = toCsv(
      [
        { a: 1, b: 2, c: 3 },
        { a: 4, b: 5, c: 6 },
      ],
      { columns: ['c', 'a'] },
    );
    expect(out).toBe('c,a\r\n3,1\r\n6,4\r\n');
  });

  it('returns empty string for empty input', () => {
    expect(toCsv([])).toBe('');
  });

  it('quotes fields that contain CR or LF', () => {
    const out = toCsv([{ note: 'line1\nline2' }]);
    expect(out).toBe('note\r\n"line1\nline2"\r\n');
  });

  it('round-trips with parseCsv on simple data', async () => {
    const { parseCsv } = await import('./csv-parser.js');
    const rows = [
      { name: 'Hello, world', sku: 'X-1' },
      { name: 'Simple', sku: 'X-2' },
    ];
    const csv = toCsv(rows);
    expect(parseCsv(csv)).toEqual(rows);
  });
});
