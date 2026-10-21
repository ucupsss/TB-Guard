'use client';

import * as React from 'react';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationFirst, PaginationItem, PaginationLast, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/** paginasi + ukuran halaman seperti di bawah "Weekly Top Products" */
export function TablePager({ page, pages, onPage, size, onSize, sizes = [5, 10, 25, 50] }: { page: number; pages: number; onPage: (p: number) => void; size: number; onSize: (n: number) => void; sizes?: number[] }) {
  const nums: (number | '…')[] = [];
  for (let p = 1; p <= pages; p++) {
    if (pages > 5 && p !== 1 && p !== pages && Math.abs(p - page) > 1) { if (nums[nums.length - 1] !== '…') nums.push('…'); continue; }
    nums.push(p);
  }
  return (
    <div className="intro-y flex flex-wrap items-center gap-3 sm:flex-nowrap">
      <Pagination className="w-full sm:mr-auto sm:w-auto">
        <PaginationContent>
          <PaginationItem><PaginationFirst onClick={() => onPage(1)} disabled={page === 1} /></PaginationItem>
          <PaginationItem><PaginationPrevious onClick={() => onPage(page - 1)} disabled={page === 1} /></PaginationItem>
          {nums.map((n, i) => n === '…'
            ? <PaginationItem key={'e' + i}><PaginationEllipsis /></PaginationItem>
            : <PaginationItem key={n}><PaginationLink isActive={n === page} onClick={() => onPage(n)}>{n}</PaginationLink></PaginationItem>)}
          <PaginationItem><PaginationNext onClick={() => onPage(page + 1)} disabled={page === pages} /></PaginationItem>
          <PaginationItem><PaginationLast onClick={() => onPage(pages)} disabled={page === pages} /></PaginationItem>
        </PaginationContent>
      </Pagination>
      <Select value={String(size)} onValueChange={(v) => onSize(+v)}>
        <SelectTrigger className="box h-9 w-20 border-0" aria-label="Baris per halaman"><SelectValue /></SelectTrigger>
        <SelectContent>{sizes.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

export function usePaged<T>(rows: T[], initial = 10) {
  const [page, setPage] = React.useState(1);
  const [size, setSize] = React.useState(initial);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const p = Math.min(page, pages);
  return { page: p, pages, size, setPage: (n: number) => setPage(Math.max(1, Math.min(pages, n))), setSize: (n: number) => { setSize(n); setPage(1); }, slice: rows.slice((p - 1) * size, p * size) };
}
