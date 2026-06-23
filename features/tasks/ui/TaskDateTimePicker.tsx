import React, { useEffect, useMemo, useRef, useState } from "react";

interface TaskDateTimePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
  disabled?: boolean;
}

const WEEKDAY_LABELS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];
const MONTH_FORMATTER = new Intl.DateTimeFormat("cs-CZ", { month: "long", year: "numeric" });
const TODAY_FORMATTER = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
});
const DISPLAY_FORMATTER = new Intl.DateTimeFormat("cs-CZ", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const pad = (value: number): string => String(value).padStart(2, "0");

const parseLocalValue = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
    0,
  );

  return Number.isNaN(date.getTime()) ? null : date;
};

const formatLocalValue = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

const startOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);

const addMonths = (date: Date, months: number): Date =>
  new Date(date.getFullYear(), date.getMonth() + months, 1);

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const getCalendarDays = (month: Date): Date[] => {
  const first = startOfMonth(month);
  const day = first.getDay() === 0 ? 7 : first.getDay();
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - (day - 1));

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
};

const getValueWithTime = (baseDate: Date, source: Date | null): string => {
  const next = new Date(baseDate);
  next.setHours(source?.getHours() ?? 9, source?.getMinutes() ?? 0, 0, 0);
  return formatLocalValue(next);
};

export const TaskDateTimePicker: React.FC<TaskDateTimePickerProps> = ({
  label,
  value,
  onChange,
  compact = false,
  disabled = false,
}) => {
  const parsedValue = useMemo(() => parseLocalValue(value), [value]);
  const [open, setOpen] = useState(false);
  const [cursorMonth, setCursorMonth] = useState<Date>(() => startOfMonth(parsedValue ?? new Date()));
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (parsedValue) {
      setCursorMonth(startOfMonth(parsedValue));
    }
  }, [parsedValue]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const calendarDays = useMemo(() => getCalendarDays(cursorMonth), [cursorMonth]);
  const today = new Date();
  const todayLabel = TODAY_FORMATTER.format(today);
  const displayValue = parsedValue ? DISPLAY_FORMATTER.format(parsedValue) : "Bez termínu";
  const currentHour = parsedValue?.getHours() ?? 9;
  const currentMinute = parsedValue?.getMinutes() ?? 0;

  const setTimePart = (part: "hour" | "minute", nextValue: number) => {
    const date = parsedValue ?? new Date();
    const next = new Date(date);
    next.setHours(part === "hour" ? nextValue : currentHour, part === "minute" ? nextValue : currentMinute, 0, 0);
    onChange(formatLocalValue(next));
  };

  const setToday = () => {
    const next = new Date();
    next.setSeconds(0, 0);
    onChange(formatLocalValue(next));
    setCursorMonth(startOfMonth(next));
  };

  return (
    <div ref={rootRef} className="relative min-w-0">
      <input
        aria-label={label}
        className="sr-only"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={`${label}: otevřít výběr data a času`}
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex min-w-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white text-left font-medium text-slate-700 shadow-sm transition hover:border-primary/40 hover:bg-orange-50/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 ${
          compact ? "h-8 px-2.5 text-xs" : "h-10 w-full px-3 text-sm"
        }`}
      >
        <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden>
          event
        </span>
        <span className="min-w-0 truncate">{displayValue}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={`${label} kalendář`}
          className="absolute left-0 top-full z-[90] mt-2 w-[328px] rounded-xl border border-orange-200 bg-white p-3 text-slate-900 shadow-2xl shadow-slate-900/15 dark:border-orange-900/60 dark:bg-slate-950 dark:text-slate-100 dark:shadow-black/45"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-bold capitalize">
                {MONTH_FORMATTER.format(cursorMonth)}
              </div>
              <div
                data-help-id="task-date-picker-today"
                className="mt-1 text-xs font-semibold text-orange-700 dark:text-orange-200"
              >
                Dnes je {todayLabel}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="inline-flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-primary/40 hover:bg-orange-50 hover:text-primary dark:border-slate-700 dark:hover:bg-slate-900"
                onClick={() => setCursorMonth((current) => addMonths(current, -1))}
                aria-label="Předchozí měsíc"
                title="Zobrazit předchozí měsíc"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden>
                  chevron_left
                </span>
              </button>
              <button
                type="button"
                className="inline-flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-primary/40 hover:bg-orange-50 hover:text-primary dark:border-slate-700 dark:hover:bg-slate-900"
                onClick={() => setCursorMonth((current) => addMonths(current, 1))}
                aria-label="Další měsíc"
                title="Zobrazit další měsíc"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden>
                  chevron_right
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
            {WEEKDAY_LABELS.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const inMonth = day.getMonth() === cursorMonth.getMonth();
              const selected = parsedValue ? isSameDay(day, parsedValue) : false;
              const current = isSameDay(day, today);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  data-selected={selected ? "true" : "false"}
                  data-today={current ? "true" : "false"}
                  onClick={() => onChange(getValueWithTime(day, parsedValue))}
                  title={`Vybrat datum ${day.toLocaleDateString("cs-CZ")}`}
                  className={`inline-flex h-8 items-center justify-center rounded-lg border text-xs font-semibold transition ${
                    selected
                      ? "border-primary bg-primary text-white shadow-sm"
                      : current
                        ? "border-orange-600 bg-orange-500 text-white shadow-sm hover:bg-orange-600 dark:border-orange-500 dark:bg-orange-500 dark:text-white"
                        : `border-transparent hover:border-orange-200 hover:bg-orange-50 dark:hover:border-orange-900/60 dark:hover:bg-slate-900 ${
                            inMonth ? "text-slate-800 dark:text-slate-100" : "text-slate-400 dark:text-slate-600"
                          }`
                  }`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900">
            <select
              value={currentHour}
              onChange={(event) => setTimePart("hour", Number(event.target.value))}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-950"
              aria-label={`${label} hodina`}
            >
              {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={hour}>
                  {pad(hour)}
                </option>
              ))}
            </select>
            <span className="text-sm font-bold text-slate-500">:</span>
            <select
              value={currentMinute}
              onChange={(event) => setTimePart("minute", Number(event.target.value))}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-950"
              aria-label={`${label} minuta`}
            >
              {Array.from({ length: 60 }, (_, minute) => (
                <option key={minute} value={minute}>
                  {pad(minute)}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-slate-100"
              onClick={() => onChange("")}
              title={`${label}: vymazat datum a čas`}
            >
              Vymazat
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-orange-50 dark:hover:bg-orange-950/30"
                onClick={setToday}
                title={`${label}: nastavit dnešní datum a aktuální čas`}
              >
                Dnes
              </button>
              <button
                type="button"
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-primary/90"
                onClick={() => setOpen(false)}
                title="Zavřít výběr data a času"
              >
                Hotovo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
