import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/session';
import { LoginForm } from './login-form';

export const metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const session = await getCurrentSession();
  if (session) redirect('/dashboard');

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            ClaudeShop Admin
          </p>
          <h1 className="text-3xl font-semibold">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            Phase 5 · iron-session + bcrypt auth. Session cookie issued on success.
          </p>
        </div>

        <LoginForm />

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/" className="hover:underline">
            ← Back
          </Link>
        </p>
      </div>
    </main>
  );
}
