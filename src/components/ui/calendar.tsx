'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker, type DayPickerProps } from 'react-day-picker';
import { vi } from 'react-day-picker/locale';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';

/** Lịch (react-day-picker v10) — tiếng Việt, tuần bắt đầu thứ 2. */
export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: DayPickerProps) {
  return (
    <DayPicker
      locale={vi}
      weekStartsOn={1}
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row gap-4',
        month: 'space-y-3',
        month_caption: 'flex justify-center pt-1 relative items-center h-8',
        caption_label: 'text-sm font-medium capitalize',
        nav: 'absolute inset-x-3 top-3 flex items-center justify-between',
        button_previous: cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 p-0 opacity-60 hover:opacity-100',
        ),
        button_next: cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 p-0 opacity-60 hover:opacity-100',
        ),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'w-8 text-[0.75rem] font-normal text-muted-foreground',
        week: 'flex w-full mt-1',
        day: 'h-8 w-8 p-0 text-center text-sm',
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-8 w-8 p-0 font-normal aria-selected:opacity-100',
        ),
        selected:
          'bg-primary text-primary-foreground rounded-md hover:bg-primary hover:text-primary-foreground',
        today: 'font-semibold underline underline-offset-4',
        outside: 'text-muted-foreground opacity-50',
        disabled: 'text-muted-foreground opacity-40',
        range_middle: 'bg-accent text-accent-foreground rounded-none',
        range_start: 'rounded-r-none',
        range_end: 'rounded-l-none',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
      }}
      {...props}
    />
  );
}
