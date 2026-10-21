'use client';

import * as React from 'react';
import { ChevronLeftIcon, ChevronRightIcon, DotsHorizontalIcon, DoubleArrowLeftIcon, DoubleArrowRightIcon } from '@radix-ui/react-icons';
import { cn } from '@/lib/utils';
import { ButtonProps, buttonVariants } from '@/components/ui/button';

const Pagination = ({ className, ...props }: React.ComponentProps<'nav'>) => (
  <nav role="navigation" aria-label="pagination" className={cn('flex', className)} {...props} />
);
Pagination.displayName = 'Pagination';
const PaginationContent = React.forwardRef<HTMLUListElement, React.ComponentProps<'ul'>>(({ className, ...props }, ref) => (
  <ul ref={ref} className={cn('flex flex-row items-center gap-1', className)} {...props} />
));
PaginationContent.displayName = 'PaginationContent';
const PaginationItem = React.forwardRef<HTMLLIElement, React.ComponentProps<'li'>>(({ className, ...props }, ref) => <li ref={ref} className={cn('', className)} {...props} />);
PaginationItem.displayName = 'PaginationItem';

type PaginationLinkProps = { isActive?: boolean } & Pick<ButtonProps, 'size'> & React.ComponentProps<'button'>;
const PaginationLink = ({ className, isActive, size = 'icon', ...props }: PaginationLinkProps) => (
  <button type="button" aria-current={isActive ? 'page' : undefined}
    className={cn(buttonVariants({ variant: isActive ? 'outline' : 'ghost', size }), 'h-8 w-8', isActive && 'bg-card shadow-box', className)} {...props} />
);
PaginationLink.displayName = 'PaginationLink';
const PaginationFirst = (p: React.ComponentProps<typeof PaginationLink>) => <PaginationLink aria-label="Halaman pertama" {...p}><DoubleArrowLeftIcon className="h-4 w-4" /></PaginationLink>;
const PaginationPrevious = (p: React.ComponentProps<typeof PaginationLink>) => <PaginationLink aria-label="Sebelumnya" {...p}><ChevronLeftIcon className="h-4 w-4" /></PaginationLink>;
const PaginationNext = (p: React.ComponentProps<typeof PaginationLink>) => <PaginationLink aria-label="Berikutnya" {...p}><ChevronRightIcon className="h-4 w-4" /></PaginationLink>;
const PaginationLast = (p: React.ComponentProps<typeof PaginationLink>) => <PaginationLink aria-label="Halaman terakhir" {...p}><DoubleArrowRightIcon className="h-4 w-4" /></PaginationLink>;
const PaginationEllipsis = ({ className, ...props }: React.ComponentProps<'span'>) => (
  <span aria-hidden className={cn('flex h-8 w-8 items-center justify-center', className)} {...props}><DotsHorizontalIcon className="h-4 w-4" /></span>
);

export { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationFirst, PaginationLast };
