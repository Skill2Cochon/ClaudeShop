'use server';

import { revalidatePath } from 'next/cache';
import { adminFetch } from '@/lib/server-fetch';

export interface ApiKeyRow {
  id: string;
  tenantId: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

interface ApiError {
  error?: { message?: string };
}

async function readError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as ApiError | null;
  return body?.error?.message ?? fallback;
}

export async function listApiKeys(): Promise<ApiKeyRow[]> {
  const res = await adminFetch('/v1/admin/api-keys');
  if (!res.ok) return [];
  const body = (await res.json()) as { data: ApiKeyRow[] };
  return body.data;
}

export type MintState =
  | { status: 'idle' }
  | { status: 'ok'; row: ApiKeyRow; rawKey: string }
  | { status: 'error'; message: string };

export async function mintApiKeyAction(
  _prev: MintState,
  formData: FormData,
): Promise<MintState> {
  const name = (formData.get('name') ?? '').toString().trim();
  const scopesRaw = (formData.get('scopes') ?? '').toString().trim();
  const scopes = scopesRaw
    ? scopesRaw.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
    : undefined;

  if (name.length === 0) {
    return { status: 'error', message: 'Name is required.' };
  }

  const body: Record<string, unknown> = { name };
  if (scopes && scopes.length > 0) body.scopes = scopes;

  const res = await adminFetch('/v1/admin/api-keys', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    return { status: 'error', message: await readError(res, `Mint failed (${res.status})`) };
  }

  const body2 = (await res.json()) as { data: { row: ApiKeyRow; rawKey: string } };
  revalidatePath('/settings/api-keys');
  return { status: 'ok', row: body2.data.row, rawKey: body2.data.rawKey };
}

export async function revokeApiKeyAction(id: string): Promise<void> {
  const res = await adminFetch(
    `/v1/admin/api-keys/${encodeURIComponent(id)}/revoke`,
    { method: 'POST' },
  );
  if (!res.ok) {
    throw new Error(await readError(res, `Revoke failed (${res.status})`));
  }
  revalidatePath('/settings/api-keys');
}
