'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/layout/Logo';
import { useStore } from '@/lib/store';
import { useDarkMode } from '@/components/layout/AppLayout';
import { BACKEND_URL, GOOGLE_CLIENT_ID } from '@/lib/backend';

interface GoogleId {
  initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; hd?: string; ux_mode?: string }) => void;
  renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
}
declare global { interface Window { google?: { accounts: { id: GoogleId } } } }

const GIS_SRC = 'https://accounts.google.com/gsi/client';

/** Login hanya dengan akun Gmail (Google Sign-In). Tanpa username/password. */
export default function Login() {
  const { login, user } = useStore();
  const router = useRouter();
  const btn = React.useRef<HTMLDivElement>(null);
  const [err, setErr] = React.useState(GOOGLE_CLIENT_ID ? '' : 'Login belum dikonfigurasi (NEXT_PUBLIC_GOOGLE_CLIENT_ID).');
  const [busy, setBusy] = React.useState(false);

  useDarkMode();
  React.useEffect(() => {
    if (user) router.replace('/dashboard');
  }, [user, router]);

  React.useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const onCredential = async ({ credential }: { credential: string }) => {
      setBusy(true); setErr('');
      try {
        const res = await fetch(`${BACKEND_URL}/api/auth/google`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || `Login gagal (HTTP ${res.status})`);
        login(j.user, j.token);
        router.push('/dashboard');
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Login gagal.');
        setBusy(false);
      }
    };
    const init = () => {
      const g = window.google?.accounts.id;
      if (!g || !btn.current) return;
      g.initialize({ client_id: GOOGLE_CLIENT_ID, callback: onCredential });
      g.renderButton(btn.current, { theme: 'outline', size: 'large', shape: 'rectangular', text: 'signin_with', width: 320, locale: 'id' });
    };
    if (window.google) { init(); return; }
    let el = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (!el) { el = document.createElement('script'); el.src = GIS_SRC; el.async = true; document.head.appendChild(el); }
    el.addEventListener('load', init);
    el.addEventListener('error', () => setErr('Gagal memuat Google Sign-In. Periksa koneksi internet.'));
    return () => el?.removeEventListener('load', init);
  }, [login, router]);

  return (
    <div className="min-h-screen bg-page lg:bg-shell">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* kiri: info */}
        <div className="relative hidden flex-col items-center justify-center px-12 py-16 text-white lg:flex xl:px-20">
          <div className="my-auto flex flex-col items-center text-center max-w-md">
            <Logo variant="full" tone="white" className="h-24 lg:h-28 xl:h-32 w-auto drop-shadow-md mb-8" />
            <div className="text-4xl font-semibold leading-tight tracking-tight">
              Masuk ke TB Guard
            </div>
            <div className="mt-4 text-lg text-white/80">
              Skrining TB berbasis suara & AI.
            </div>
          </div>
        </div>

        {/* kanan: form */}
        <div className="flex h-screen items-center bg-page py-5 lg:my-3 lg:mr-3 lg:h-auto lg:rounded-shell lg:py-0">
          <div className="mx-auto w-full max-w-md rounded-md bg-card px-5 py-8 shadow-box sm:px-8 lg:bg-transparent lg:shadow-none">
            <div className="mb-8 flex items-center lg:hidden">
              <Logo variant="full" tone="primary" className="h-12 sm:h-14 w-auto" />
            </div>
            <h1 className="text-2xl font-bold xl:text-3xl text-foreground">Sign In</h1>
            <p className="mt-2 text-sm text-muted-foreground">Masuk dengan akun Gmail Anda. Tidak perlu username atau password.</p>

            <div className="mt-8 flex min-h-11 justify-start" aria-busy={busy}>
              <div ref={btn} className={busy ? 'pointer-events-none opacity-60' : ''} />
            </div>

            {err && (
              <p role="alert" className="mt-4 text-sm text-danger">
                {err}
              </p>
            )}

            <p className="mt-8 text-sm text-muted-foreground">Hanya akun @gmail.com yang dapat masuk.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
