'use server';

import { adminFetch } from '@/lib/server-fetch';

export interface LocaleCopy {
  locale: string;
  name: string;
  tagline: string;
  description: string;
  seo: { title: string; description: string };
}

export interface ProductCopyPayload {
  locales: LocaleCopy[];
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens?: number;
  };
}

export type GenerateCopyState =
  | { status: 'idle' }
  | { status: 'ok'; payload: ProductCopyPayload }
  | { status: 'error'; message: string };

interface ApiError {
  error?: { message?: string };
}

export interface ReindexPayload {
  productId: string;
  model: string;
  dimensions: number;
  inputTokens: number;
  searchTextPreview: string;
}

export type ReindexState =
  | { status: 'idle' }
  | { status: 'ok'; payload: ReindexPayload }
  | { status: 'error'; message: string };

export async function reindexProductAction(
  productId: string,
): Promise<ReindexState> {
  try {
    const res = await adminFetch(
      `/v1/admin/products/${encodeURIComponent(productId)}/reindex`,
      { method: 'POST' },
    );
    if (!res.ok) {
      const errBody = (await res.json().catch(() => null)) as ApiError | null;
      return {
        status: 'error',
        message: errBody?.error?.message ?? `Reindex failed (${res.status})`,
      };
    }
    const json = (await res.json()) as { data: ReindexPayload };
    return { status: 'ok', payload: json.data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { status: 'error', message };
  }
}

export async function generateProductCopyAction(
  productId: string,
  _prevState: GenerateCopyState,
  formData: FormData,
): Promise<GenerateCopyState> {
  const seed = (formData.get('seed') ?? '').toString().trim();
  if (seed.length === 0) {
    return { status: 'error', message: 'Seed description is required.' };
  }

  const tone = (formData.get('tone') ?? '').toString();
  const localesRaw = (formData.get('locales') ?? '').toString().trim();
  const locales = localesRaw
    ? localesRaw
        .split(',')
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
    : undefined;

  const body: Record<string, unknown> = { seed };
  if (tone.length > 0) body.tone = tone;
  if (locales && locales.length > 0) body.locales = locales;

  try {
    const res = await adminFetch(
      `/v1/admin/products/${encodeURIComponent(productId)}/ai/copy`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const errBody = (await res.json().catch(() => null)) as ApiError | null;
      return {
        status: 'error',
        message: errBody?.error?.message ?? `Generation failed (${res.status})`,
      };
    }

    const json = (await res.json()) as { data: ProductCopyPayload };
    return { status: 'ok', payload: json.data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { status: 'error', message };
  }
}
