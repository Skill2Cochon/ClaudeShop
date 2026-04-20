'use server';

import { redirect } from 'next/navigation';
import type { Session } from '@claudeshop/contracts/auth';
import { getCustomerSession } from '@/lib/session';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const TENANT_ID = process.env.STOREFRONT_TENANT_ID ?? 'demo';

interface UserResponse {
  data: {
    id: string;
    tenantId: string;
    email: string;
    role: Session['role'];
    displayName: string | null;
  };
}

interface ApiError {
  error?: { message?: string };
}

export interface AuthFormState {
  status: 'idle' | 'error';
  message?: string;
}

async function writeSessionFromUser(user: UserResponse['data']): Promise<void> {
  const store = await getCustomerSession();
  store.session = {
    userId: user.id,
    tenantId: user.tenantId,
    email: user.email,
    role: user.role,
    displayName: user.displayName,
    issuedAt: Math.floor(Date.now() / 1000),
  };
  await store.save();
}

async function postJson(
  path: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-tenant-id': TENANT_ID,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
}

export async function loginCustomerAction(
  locale: string,
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = (formData.get('email') ?? '').toString().trim();
  const password = (formData.get('password') ?? '').toString();
  if (!email || !password) {
    return { status: 'error', message: 'Email and password are required.' };
  }

  const res = await postJson('/v1/auth/login', { email, password });
  if (!res.ok) {
    if (res.status === 401) {
      return { status: 'error', message: 'Invalid email or password.' };
    }
    const body = (await res.json().catch(() => null)) as ApiError | null;
    return {
      status: 'error',
      message: body?.error?.message ?? `Login failed (${res.status}).`,
    };
  }

  const body = (await res.json()) as UserResponse;
  await writeSessionFromUser(body.data);
  redirect(`/${locale}/account`);
}

export async function registerCustomerAction(
  locale: string,
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = (formData.get('email') ?? '').toString().trim();
  const password = (formData.get('password') ?? '').toString();
  const displayName = (formData.get('displayName') ?? '').toString().trim();
  if (!email || !password) {
    return { status: 'error', message: 'Email and password are required.' };
  }
  if (password.length < 8) {
    return { status: 'error', message: 'Password must be at least 8 characters.' };
  }

  const res = await postJson('/v1/auth/register', {
    email,
    password,
    ...(displayName ? { displayName } : {}),
  });
  if (!res.ok) {
    if (res.status === 409) {
      return { status: 'error', message: 'An account with that email already exists.' };
    }
    const body = (await res.json().catch(() => null)) as ApiError | null;
    return {
      status: 'error',
      message: body?.error?.message ?? `Registration failed (${res.status}).`,
    };
  }

  const body = (await res.json()) as UserResponse;
  await writeSessionFromUser(body.data);
  redirect(`/${locale}/account`);
}

export async function logoutCustomerAction(locale: string): Promise<void> {
  const store = await getCustomerSession();
  store.destroy();
  redirect(`/${locale}`);
}
