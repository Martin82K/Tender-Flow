import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface DatePickerProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

const WEEKDAYS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];
const MONTH_FORMATTER = new Intl.DateTimeFormat("cs-CZ", {
  month: "long",
  year: "numeric",
});
const DISPLAY_FORMATTER = new Intl.DateTimeFormat("cs-CZ", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const pad = (value: number): string => String(value).padStart(2, "0");
const startOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);
const isSameDay = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const parseIsoDate = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (
    date.getFullYear() !== Number(match[1]) ||
    date.getMonth() !== Number(match[2]) - 1 ||
    date.getDate() !== Number(match[3])
  ) {
    return null;
  }
  return date;
};

const formatIsoDate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const getCalendarDays = (month: Date): Date[] => {
  const first = startOfMonth(month);
  const weekday = first.getDay() === 0 ? 7 : first.getDay();
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - weekday + 1);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
};

const moveMonth = (date: Date, amount: number): Date => {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + amount + 1, 0).getDate();
  return new Date(date.getFullYear(), date.getMonth() + amount, Math.min(date.getDate(), lastDay));
};

export const DatePicker: React.FC<DatePickerProps> = ({
  id,
  value,
  onChange,
  ariaLabel,
  className = "",
  disabled = false,
  placeholder = "dd.mm.rrrr",
}) => {
  const dialogId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const parsedValue = useMemo(() => parseIsoDate(value), [value]);
  const [open, setOpen] = useState(false);
  const [cursorMonth, setCursorMonth] = useState(() => startOfMonth(parsedValue ?? new Date()));
  const [focusedDate, setFocusedDate] = useState(() => parsedValue ?? new Date());
  const [position, setPosition] = useState({ left: 8, top: 8, width: 320 });
  const days = useMemo(() => getCalendarDays(cursorMonth), [cursorMonth]);
  const today = new Date();

  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(320, Math.max(240, window.innerWidth - 16));
    const panelHeight = panelRef.current?.offsetHeight ?? 360;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const below = rect.bottom + 8;
    const top = below + panelHeight <= window.innerHeight
      ? below
      : Math.max(8, rect.top - panelHeight - 8);
    setPosition({ left, top, width });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, cursorMonth]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const handleViewportChange = () => updatePosition();

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const selector = `[data-date="${formatIsoDate(focusedDate)}"]`;
    panelRef.current?.querySelector<HTMLButtonElement>(selector)?.focus();
  }, [focusedDate, cursorMonth, open]);

  const openCalendar = () => {
    const initialDate = parsedValue ?? new Date();
    setFocusedDate(initialDate);
    setCursorMonth(startOfMonth(initialDate));
    setOpen((current) => !current);
  };

  const selectDate = (date: Date) => {
    onChange(formatIsoDate(date));
    setOpen(false);
    triggerRef.current?.focus();
  };

  const shiftMonth = (amount: number) => {
    const next = moveMonth(focusedDate, amount);
    setFocusedDate(next);
    setCursorMonth(startOfMonth(next));
  };

  const handleDayKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, date: Date) => {
    const offsets: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    const offset = offsets[event.key];
    if (offset === undefined) return;

    event.preventDefault();
    const next = new Date(date);
    next.setDate(date.getDate() + offset);
    setFocusedDate(next);
    setCursorMonth(startOfMonth(next));
  };

  const calendar = open ? createPortal(
    <div
      ref={panelRef}
      id={dialogId}
      role="dialog"
      aria-label={`${ariaLabel} kalendář`}
      className="fixed z-[200] rounded-xl border border-[var(--tf-skin-line-2)] bg-[var(--tf-skin-surface)] p-3 text-[var(--tf-skin-text)] shadow-2xl"
      style={position}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <strong className="text-sm capitalize">{MONTH_FORMATTER.format(cursorMonth)}</strong>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="flex size-8 items-center justify-center rounded-lg border border-[var(--tf-skin-line)] text-[var(--tf-skin-muted)] transition hover:bg-[var(--tf-skin-surface-muted)] hover:text-[var(--tf-skin-accent)]"
            aria-label="Předchozí měsíc"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>chevron_left</span>
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="flex size-8 items-center justify-center rounded-lg border border-[var(--tf-skin-line)] text-[var(--tf-skin-muted)] transition hover:bg-[var(--tf-skin-surface-muted)] hover:text-[var(--tf-skin-accent)]"
            aria-label="Další měsíc"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>chevron_right</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-[var(--tf-skin-muted)]">
        {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((date) => {
          const isoDate = formatIsoDate(date);
          const selected = parsedValue ? isSameDay(date, parsedValue) : false;
          const current = isSameDay(date, today);
          const inMonth = date.getMonth() === cursorMonth.getMonth();
          return (
            <button
              key={isoDate}
              type="button"
              data-date={isoDate}
              data-selected={selected ? "true" : "false"}
              data-today={current ? "true" : "false"}
              tabIndex={isSameDay(date, focusedDate) ? 0 : -1}
              onClick={() => selectDate(date)}
              onKeyDown={(event) => handleDayKeyDown(event, date)}
              title={`Vybrat datum ${date.toLocaleDateString("cs-CZ")}`}
              className={`flex h-8 items-center justify-center rounded-lg border text-xs font-semibold transition ${
                selected
                  ? "border-[var(--tf-skin-accent)] bg-[var(--tf-skin-accent)] text-white"
                  : current
                    ? "border-[var(--tf-skin-accent)] text-[var(--tf-skin-accent)]"
                    : `border-transparent hover:bg-[var(--tf-skin-surface-muted)] ${
                        inMonth ? "text-[var(--tf-skin-text)]" : "text-[var(--tf-skin-muted-2)]"
                      }`
              }`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-[var(--tf-skin-line)] pt-3">
        <button
          type="button"
          onClick={() => { onChange(""); setOpen(false); }}
          className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--tf-skin-muted)] transition hover:bg-[var(--tf-skin-surface-muted)] hover:text-[var(--tf-skin-text)]"
        >
          Vymazat
        </button>
        <button
          type="button"
          onClick={() => selectDate(new Date())}
          className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--tf-skin-accent)] transition hover:bg-[var(--tf-skin-surface-muted)]"
        >
          Dnes
        </button>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        onClick={openCalendar}
        className={`flex items-center justify-between gap-3 text-left ${className}`}
      >
        <span className={parsedValue ? "text-[var(--tf-skin-text)]" : "text-[var(--tf-skin-muted)]"}>
          {parsedValue ? DISPLAY_FORMATTER.format(parsedValue) : placeholder}
        </span>
        <span className="material-symbols-outlined text-[18px] text-[var(--tf-skin-accent)]" aria-hidden>
          calendar_month
        </span>
      </button>
      {calendar}
    </>
  );
};
