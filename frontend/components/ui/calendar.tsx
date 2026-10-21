'use client';

import * as React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { DayPicker } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-1', className)}
      classNames={{
        root: 'w-full',
        months: 'relative flex flex-col gap-4 sm:flex-row',
        month: 'w-full space-y-4',
        nav: 'absolute inset-x-0 top-0 flex items-center justify-between',
        button_previous: cn(buttonVariants({ variant: 'ghost' }), 'h-8 w-8 p-0 z-10'),
        button_next: cn(buttonVariants({ variant: 'ghost' }), 'h-8 w-8 p-0 z-10'),
        month_caption: 'flex h-8 items-center justify-center',
        caption_label: 'text-sm font-medium',
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'flex-1 text-center text-xs font-medium text-muted-foreground',
        week: 'mt-1 flex w-full',
        day: 'flex-1 p-0 text-center text-sm',
        day_button: cn(buttonVariants({ variant: 'ghost' }), 'mx-auto h-8 w-8 p-0 font-normal'),
        selected: '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button:hover]:bg-primary',
        today: '[&>button]:font-semibold [&>button]:text-primary dark:[&>button]:text-blue-300',
        outside: 'text-muted-foreground opacity-50',
        disabled: 'text-muted-foreground opacity-50',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: c }) => orientation === 'left' ? <ChevronLeftIcon className={cn('h-4 w-4', c)} /> : <ChevronRightIcon className={cn('h-4 w-4', c)} />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
