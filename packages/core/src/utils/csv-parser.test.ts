import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv-parser';

describe('parseCsv', () => {
  it('parses a basic CSV with headers', () => {
    const out = parseCsv('name,sku\nHello Tee,HCS-TEE-S\nBye Tee,HCS-TEE-M\n');
    expect(out).toEqual([
      { name: 'Hello Tee', sku: 'HCS-TEE-S' },
      { name: 'Bye Tee', sku: 'HCS-TEE-M' },
    ]);
  });

  it('handles quoted fields with embedded commas', () => {
    const out = parseCsv('name,tagline\n"Hello, world",simple\n');
    expect(out[0]?.name).toBe('Hello, world');
    expect(out[0]?.tagline).toBe('simple');
  });

  it('handles escaped quotes inside quoted fields', () => {
    const out = parseCsv('name\n"She said ""hi"""\n');
    expect(out[0]?.name).toBe('She said "hi"');
  });

  it('handles CRLF line endings', () => {
    const out = parseCsv('a,b\r\n1,2\r\n3,4\r\n');
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ a: '1', b: '2' });
    expect(out[1]).toEqual({ a: '3', b: '4' });
  });

  it('skips blank lines between rows', () => {
    const out = parseCsv('a\n1\n\n2\n');
    expect(out).toEqual([{ a: '1' }, { a: '2' }]);
  });

  it('supports tab separator', () => {
    const out = parseCsv('name\tsku\nHello\tX-1\n', { separator: '\t' });
    expect(out[0]).toEqual({ name: 'Hello', sku: 'X-1' });
  });

  it('throws on duplicate headers', () => {
    expect(() => parseCsv('a,b,a\n1,2,3\n')).toThrow(/Duplicate CSV header/);
  });

  it('returns [] for empty input', () => {
    expect(parseCsv('')).toEqual([]);
  });
});
