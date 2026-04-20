import { describe, expect, it } from 'vitest';
import { StubEmbeddingProvider } from './stub-embedding-provider';

describe('StubEmbeddingProvider', () => {
  it('produces vectors of the configured dimension', async () => {
    const p = new StubEmbeddingProvider(1024);
    const res = await p.embedOne({ text: 'hello' });
    expect(res.vector).toHaveLength(1024);
    expect(res.dimensions).toBe(1024);
  });

  it('is deterministic — same text → same vector', async () => {
    const p = new StubEmbeddingProvider(128);
    const a = await p.embedOne({ text: 'red cotton tee' });
    const b = await p.embedOne({ text: 'red cotton tee' });
    expect(a.vector).toEqual(b.vector);
  });

  it('different texts produce different vectors', async () => {
    const p = new StubEmbeddingProvider(128);
    const a = await p.embedOne({ text: 'red cotton tee' });
    const b = await p.embedOne({ text: 'blue wool sweater' });
    expect(a.vector).not.toEqual(b.vector);
  });

  it('vectors are unit-normalised (L2 norm ~ 1)', async () => {
    const p = new StubEmbeddingProvider(1024);
    const { vector } = await p.embedOne({ text: 'anything' });
    const norm = Math.sqrt(vector.reduce((acc, x) => acc + x * x, 0));
    expect(norm).toBeGreaterThan(0.999);
    expect(norm).toBeLessThan(1.001);
  });

  it('embedMany returns one vector per input in the same order', async () => {
    const p = new StubEmbeddingProvider(64);
    const res = await p.embedMany({ texts: ['one', 'two', 'three'] });
    expect(res.vectors).toHaveLength(3);
    expect(res.vectors[0]).not.toEqual(res.vectors[1]);
    expect(res.vectors[1]).not.toEqual(res.vectors[2]);
  });

  it('empty string produces a valid normalised vector (not NaN)', async () => {
    const p = new StubEmbeddingProvider(32);
    const { vector } = await p.embedOne({ text: '' });
    expect(vector.every((x) => Number.isFinite(x))).toBe(true);
  });

  it('rejects invalid dimensions', () => {
    expect(() => new StubEmbeddingProvider(4)).toThrow();
    expect(() => new StubEmbeddingProvider(10_000)).toThrow();
  });
});
