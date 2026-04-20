'use server';

import { adminFetch } from '@/lib/server-fetch';

export type PaletteResultType =
  | 'product'
  | 'order'
  | 'customer'
  | 'segment'
  | 'campaign'
  | 'supplier'
  | 'page'
  | 'promotion'
  | 'module';

export interface PaletteResult {
  type: PaletteResultType;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

interface ApiResponse {
  data: PaletteResult[];
  meta: { query: string; totalReturned: number };
}

interface ApiError {
  error?: { message?: string };
}

export async function paletteSearchAction(query: string): Promise<{
  results: PaletteResult[];
  error?: string;
}> {
  const q = query.trim();
  if (q.length === 0) return { results: [] };

  try {
    const params = new URLSearchParams({ q, limit: '12' });
    const res = await adminFetch(`/v1/admin/search?${params.toString()}`);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as ApiError | null;
      return {
        results: [],
        error: body?.error?.message ?? `Search failed (${res.status})`,
      };
    }
    const body = (await res.json()) as ApiResponse;
    return { results: body.data };
  } catch (err) {
    return {
      results: [],
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
