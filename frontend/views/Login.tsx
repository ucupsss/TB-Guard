'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Logo } from '@/components/layout/Logo';
import { useStore } from '@/lib/store';
import { useDarkMode } from '@/components/layout/AppLayout';

function Illustration() {
  // ilustrasi orisinal: paru-paru, gelombang batuk, dan penanda lokasi
  return (
    <svg viewBox="0 0 420 320" className="-intro-x w-1/2" aria-hidden="true">
      <ellipse cx="210" cy="296" rx="140" ry="14" fill="#000" opacity=".15" />
      <g fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="2">
        <path d="M58 220c-46-42-46-124 0-166" /><path d="M86 200c-30-28-30-80 0-108" />
        <path d="M362 220c46-42 46-124 0-166" /><path d="M334 200c30-28 30-80 0-108" />
      </g>
      <path d="M210 40v86" stroke="#fff" strokeWidth="16" strokeLinecap="round" />
      <path d="M210 120c-14 0-26 10-32 24M210 120c14 0 26 10 32 24" stroke="#fff" strokeWidth="11" strokeLinecap="round" fill="none" />
      <path d="M178 90c-56-8-96 54-96 144 0 32 18 50 46 50 36 0 52-24 52-60V100z" fill="#93b4f5" />
      <path d="M242 90c56-8 96 54 96 144 0 32-18 50-46 50-36 0-52-24-52-60V100z" fill="#93b4f5" />
      <g transform="translate(126 218)" stroke="#1C3FAA" strokeWidth="3.5" strokeLinecap="round">
        <path d="M0 0h10M14 -8v16M20 -18v36M26 -10v20M32 -24v48M38 -12v24M44 -6v12M50 0h10" />
      </g>
      <g transform="translate(290 214)">
        <circle r="26" fill="#fff" /><circle r="15" fill="none" stroke="#1C3FAA" strokeWidth="3" /><circle r="5" fill="#FBC500" />
      </g>
    </svg>
  );
}

export default function Login() {
  const { login, user } = useStore();
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [pass, setPass] = React.useState('');
  const [role, setRole] = React.useState('Admin');
  const [err, setErr] = React.useState('');
  useDarkMode();
  React.useEffect(() => { if (user) router.replace('/'); }, [user, router]);

  const enter = (mail: string) => {
    const name = mail.split('@')[0].replace(/[._\d]+/g, ' ').trim() || role;
    login({ email: mail, role, name: name.replace(/\b\w/g, (c) => c.toUpperCase()) });
    router.push('/');
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setErr('Format email belum benar.');
    if (pass.length < 6) return setErr('Password minimal 6 karakter.');
    setErr('');
    enter(email); // DEMO: sambungkan ke POST /api/auth/login nanti
  };

  return (
    <div className="min-h-screen bg-page lg:bg-shell">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* kiri: info */}
        <div className="relative hidden flex-col px-12 pb-16 pt-10 text-white lg:flex xl:px-20">
          <div className="flex items-center gap-3"><Logo className="h-8 w-8" /><span className="text-lg font-medium">TB Guard</span></div>
          <div className="my-auto">
            <Illustration />
            <div className="mt-10 text-4xl font-medium leading-tight">Beberapa klik lagi untuk <br />masuk ke akun Anda.</div>
            <div className="mt-5 text-lg text-white/70">Skrining tuberkulosis di ruang publik dengan AI Acoustic Sensing dan Computer Vision.</div>
          </div>
        </div>
        {/* kanan: form */}
        <div className="flex h-screen items-center bg-page py-5 lg:my-3 lg:mr-3 lg:h-auto lg:rounded-shell lg:py-0">
          <form onSubmit={submit} className="mx-auto w-full max-w-md rounded-md bg-card px-5 py-8 shadow-box sm:px-8 lg:bg-transparent lg:shadow-none">
            <div className="mb-8 flex items-center gap-3 lg:hidden"><Logo className="h-8 w-8" tone="primary" /><span className="text-lg font-medium">TB Guard</span></div>
            <h1 className="text-2xl font-bold xl:text-3xl">Sign In</h1>
            <p className="mt-2 text-muted-foreground">Masuk ke panel admin TB Guard.</p>
            <div className="mt-8 grid gap-4">
              <Input aria-label="Email" type="email" autoComplete="username" placeholder="Email" className="h-12 px-4 text-base" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input aria-label="Password" type="password" autoComplete="current-password" placeholder="Password" className="h-12 px-4 text-base" value={pass} onChange={(e) => setPass(e.target.value)} />
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="h-12 px-4 text-base" aria-label="Masuk sebagai"><SelectValue /></SelectTrigger>
                <SelectContent>{['Admin', 'Dokter', 'Perawat', 'Petugas IT'].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="mt-4 flex items-center text-sm text-muted-foreground">
              <label className="mr-auto flex items-center gap-2"><Checkbox id="remember" /><Label htmlFor="remember" className="font-normal">Ingat saya</Label></label>
              <button type="button" className="hover:text-foreground" onClick={() => toast.info('Tautan reset password akan dikirim ke email (belum aktif di demo).')}>Lupa password?</button>
            </div>
            {err && <p role="alert" className="mt-3 text-sm text-danger">{err}</p>}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button type="submit" className="h-11 sm:w-32">Login</Button>
              <Button type="button" variant="outline" className="h-11 sm:w-48" onClick={() => enter('admin.tbguard@gmail.com')}>Masuk dengan Google</Button>
            </div>
            <p className="mt-8 text-sm text-muted-foreground">Demo: email apa saja + password minimal 6 karakter.</p>
          </form>
        </div>
      </div>
    </div>
  );
}
