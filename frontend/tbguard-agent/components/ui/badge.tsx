'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 [&_svg]:size-3',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-danger text-white',
        success: 'border-transparent bg-success text-white',
        warning: 'border-transparent bg-warning text-slate-900',
        pending: 'border-transparent bg-pending text-white',
        outline: 'text-foreground',
        'soft-success': 'border-transparent bg-success/15 text-[#5b7f0a] dark:text-success',
        'soft-danger': 'border-transparent bg-danger/10 text-danger',
        'soft-warning': 'border-transparent bg-pending/15 text-[#b45c00] dark:text-pending',
        'soft-primary': 'border-transparent bg-primary/10 text-primary dark:text-blue-300',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
