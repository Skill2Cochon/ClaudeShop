'use server';

import { revalidatePath } from 'next/cache';
import { adminFetch } from '@/lib/server-fetch';

interface ApiError {
  error: { code: string; message: string; status: number };
}

async function fetchAdmin(path: string, init: RequestInit): Promise<Response> {
  return adminFetch(path, init);
}

export async function installModuleAction(
  moduleId: string,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const version = formData.get('version');
  const settingsRaw = formData.get('settings');

  let settings: Record<string, unknown> = {};
  if (typeof settingsRaw === 'string' && settingsRaw.length > 0) {
    try {
      settings = JSON.parse(settingsRaw) as Record<string, unknown>;
    } catch {
      return { ok: false, message: 'Invalid settings JSON' };
    }
  }

  // Known modules: build settings from individual form fields when JSON blob absent.
  if (moduleId === '@claudeshop/payment-stripe' && Object.keys(settings).length === 0) {
    const secretKey = formData.get('secretKey');
    const webhookSecret = formData.get('webhookSecret');
    const publishableKey = formData.get('publishableKey');
    const mode = formData.get('mode');
    if (
      typeof secretKey !== 'string' ||
      typeof webhookSecret !== 'string' ||
      typeof publishableKey !== 'string'
    ) {
      return { ok: false, message: 'Missing Stripe keys' };
    }
    settings = {
      secretKey,
      webhookSecret,
      publishableKey,
      mode: typeof mode === 'string' && mode === 'live' ? 'live' : 'test',
      automaticPaymentMethods: true,
    };
  }

  const res = await fetchAdmin(
    `/v1/admin/modules/${encodeURIComponent(moduleId)}/install`,
    {
      method: 'POST',
      body: JSON.stringify({
        version: typeof version === 'string' && version.length > 0 ? version : '0.1.0',
        settings,
      }),
    },
  );

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    return { ok: false, message: body?.error?.message ?? `Install failed (${res.status})` };
  }

  revalidatePath('/modules', 'page');
  revalidatePath(`/modules/${moduleId}`, 'page');
  return { ok: true, message: `Module ${moduleId} installed & activated` };
}

export async function uninstallModuleAction(
  moduleId: string,
): Promise<{ ok: boolean; message: string }> {
  const res = await fetchAdmin(
    `/v1/admin/modules/${encodeURIComponent(moduleId)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    return { ok: false, message: body?.error?.message ?? `Uninstall failed (${res.status})` };
  }
  revalidatePath('/modules', 'page');
  revalidatePath(`/modules/${moduleId}`, 'page');
  return { ok: true, message: `Module ${moduleId} uninstalled` };
}

export async function disableModuleAction(
  moduleId: string,
): Promise<{ ok: boolean; message: string }> {
  const res = await fetchAdmin(
    `/v1/admin/modules/${encodeURIComponent(moduleId)}/disable`,
    { method: 'POST' },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    return { ok: false, message: body?.error?.message ?? `Disable failed (${res.status})` };
  }
  revalidatePath('/modules', 'page');
  return { ok: true, message: `Module ${moduleId} disabled` };
}
