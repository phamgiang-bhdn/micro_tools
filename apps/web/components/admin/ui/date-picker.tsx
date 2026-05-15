"use client";

import * as React from "react";
import { DayPicker, type Matcher } from "react-day-picker";
import { Calendar as CalendarIcon } from "lucide-react";
import { vi } from "date-fns/locale";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "../../../lib/utils";

/**
 * DatePicker primitive. Lưu ra string ISO ("YYYY-MM-DD") để độc lập timezone.
 *
 * Dùng:
 *   <DatePicker value={dateStr} onChange={setDateStr} placeholder="Chọn ngày..." />
 *
 * Tích hợp với react-hook-form: dùng `ControlledDateField` ở controlled-fields.tsx.
 *
 * Style: import CSS gốc của react-day-picker ở admin layout, override màu accent
 * qua CSS var `--rdp-accent-color` ở wrapper.
 */
interface DatePickerProps {
  value?: string | null;
  onChange: (next: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Cho phép xoá (nút "Xoá ngày") — mặc định true. */
  clearable?: boolean;
  /** Disable các ngày trước. */
  fromDate?: Date;
  /** Disable các ngày sau. */
  toDate?: Date;
  id?: string;
  name?: string;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Chọn ngày",
  disabled,
  clearable = true,
  fromDate,
  toDate,
  id,
  name,
  className
}: DatePickerProps): React.ReactElement {
  const selected = value ? parseISODate(value) : undefined;
  const disabledMatcher = React.useMemo<Matcher[] | undefined>(() => {
    const matchers: Matcher[] = [];
    if (fromDate) matchers.push({ before: fromDate });
    if (toDate) matchers.push({ after: toDate });
    return matchers.length === 0 ? undefined : matchers;
  }, [fromDate, toDate]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          className={cn(
            "inline-flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-admin-line bg-admin-surface px-3 text-sm text-admin-ink transition",
            "hover:border-admin-accent/40 focus:border-admin-accent focus:outline-none focus:ring-2 focus:ring-admin-accent/20",
            "disabled:cursor-not-allowed disabled:opacity-60",
            className
          )}
        >
          <span className={cn("flex items-center gap-2", !selected && "text-admin-mute")}>
            <CalendarIcon className="size-4 opacity-60" />
            {selected ? format(selected, "dd/MM/yyyy", { locale: vi }) : placeholder}
          </span>
          {name ? (
            <input
              type="hidden"
              name={name}
              value={value ?? ""}
              readOnly
              aria-hidden
              tabIndex={-1}
            />
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 [--rdp-accent-color:theme(colors.admin.accent)] [--rdp-accent-background-color:theme(colors.admin.accent-soft)]"
        align="start"
      >
        <DayPicker
          mode="single"
          locale={vi}
          selected={selected}
          onSelect={(d) => onChange(d ? formatISODate(d) : null)}
          weekStartsOn={1}
          showOutsideDays
          disabled={disabledMatcher}
          className="p-3"
        />
        {clearable && selected ? (
          <div className="border-t border-admin-line p-2">
            <button
              type="button"
              onClick={() => onChange(null)}
              className="w-full rounded-md px-2 py-1.5 text-xs font-medium text-admin-mute hover:bg-admin-subtle hover:text-admin-ink"
            >
              Xoá ngày
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function parseISODate(s: string): Date | undefined {
  if (!s) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return undefined;
  const [, y, mo, d] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d));
  return Number.isNaN(dt.getTime()) ? undefined : dt;
}

function formatISODate(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}
