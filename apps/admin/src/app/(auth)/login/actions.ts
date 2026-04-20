'use server';

import { redirect } from 'next/navigation';
import { isAdminRole, type Session } from '@claudeshop/contracts/auth';
import { getAdminSession } from '@/lib/session';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const TENANT_ID = process.env.ADMIN_TENANT_ID ?? 'demo';

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

export interface LoginFormState {
  status: 'idle' | 'error';
  message?: string;
}

export async function loginAction(
  _prev: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const email = (formData.get('email') ?? '').toString().trim();
  const password = (formData.get('password') ?? '').toString();
  if (!email || !password) {
    return { status: 'error', message: 'Email and password are required.' };
  }

  try {
    const res = await fetch(`${API_URL}/v1/auth/login`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-tenant-id': TENANT_ID,
      },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });

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
    const user = body.data;

    if (!isAdminRole(user.role)) {
      return {
        status: 'error',
        message: 'This account does not have admin access.',
      };
    }

    const store = await getAdminSession();
    store.session = {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
      issuedAt: Math.floor(Date.now() / 1000),
    };
    await store.save();
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Unknown error.',
    };
  }

  redirect('/dashboard');
}

export async function logoutAction(): Promise<void> {
  const store = await getAdminSession();
  store.destroy();
  redirect('/login');
}
