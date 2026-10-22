'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Logo } from '@/components/layout/Logo';
import { useStore } from '@/lib/store';
import { useDarkMode } from '@/components/layout/AppLayout';



export default function Login() {
  const { login, user } = useStore();
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [pass, setPass] = React.useState('');
  const [role] = React.useState('Admin');
  const [err, setErr] = React.useState('');

  useDarkMode();
  React.useEffect(() => {
    if (user) router.replace('/dashboard');
  }, [user, router]);

  const enter = (mail: string) => {
    const name = mail.split('@')[0].replace(/[._\d]+/g, ' ').trim() || role;
    login({ email: mail, role, name: name.replace(/\b\w/g, (c) => c.toUpperCase()) });
    router.push('/dashboard');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setErr('Format email belum benar.');
    if (pass.length < 6) return setErr('Password minimal 6 karakter.');
    setErr('');
    enter(email);
  };

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
          <form
            onSubmit={submit}
            className="mx-auto w-full max-w-md rounded-md bg-card px-5 py-8 shadow-box sm:px-8 lg:bg-transparent lg:shadow-none"
          >
            <div className="mb-8 flex items-center lg:hidden">
              <Logo variant="full" tone="primary" className="h-12 sm:h-14 w-auto" />
            </div>
            <h1 className="text-2xl font-bold xl:text-3xl text-foreground">Sign In</h1>
            

            <div className="mt-8 grid gap-4">
              <Input
                aria-label="Email"
                type="email"
                autoComplete="username"
                placeholder="Email"
                className="h-12 px-4 text-base"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                aria-label="Password"
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                className="h-12 px-4 text-base"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                required
              />

              {/* Role selector - Dikomentarkan karena belum dimulai */}
              {/*
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="h-12 px-4 text-base" aria-label="Masuk sebagai">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['Admin', 'Dokter', 'Perawat', 'Petugas IT'].map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              */}
            </div>

            <div className="mt-4 flex items-center text-sm text-muted-foreground">
              <label className="mr-auto flex items-center gap-2 cursor-pointer">
                <Checkbox id="remember" defaultChecked />
                <Label htmlFor="remember" className="font-normal cursor-pointer">
                  Ingat saya
                </Label>
              </label>
              <button
                type="button"
                className="hover:text-foreground"
                onClick={() =>
                  toast.info('Tautan reset password akan dikirim ke email (belum aktif di demo).')
                }
              >
                Lupa password?
              </button>
            </div>

            {err && (
              <p role="alert" className="mt-3 text-sm text-danger">
                {err}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button type="submit" className="h-11 w-full sm:w-36">
                Login
              </Button>
            </div>

            <p className="mt-8 text-sm text-muted-foreground">
              Demo: email bebas · password ≥ 6 karakter
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
