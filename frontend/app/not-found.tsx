import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-page p-6 text-center">
      <div><div className="text-6xl font-medium text-primary">404</div><p className="mt-3 text-muted-foreground">Halaman tidak ditemukan.</p>
        <Link href="/" className="mt-5 inline-block rounded-md bg-primary px-4 py-2 text-white">Kembali ke Dashboard</Link></div>
    </main>
  );
}
