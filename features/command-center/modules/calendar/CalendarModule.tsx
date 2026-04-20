import React, { useMemo, useState } from "react";
import type { ModuleProps } from "@features/command-center/types";
import { useCalendarData, type CalendarEvent } from "@features/command-center/hooks/useCalendarData";
import { navigate } from "@shared/routing/router";
import { TaskFormModal, type Task } from "@features/tasks";

type CalendarViewMode = "month" | "week" | "day";

const WEEKDAY_LABELS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];
const WEEKDAY_LABELS_LONG = ["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota", "Neděle"];
const MONTH_LABELS = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
];
const MONTH_LABELS_GENITIVE = [
  "ledna", "února", "března", "dubna", "května", "června",
  "července", "srpna", "září", "října", "listopadu", "prosince",
];

interface DayCell {
  date: Date;
  iso: string;
  inCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}

const toIsoDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const startOfWeek = (d: Date): Date => {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const weekday = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - weekday);
  return copy;
};

const buildMonthGrid = (anchor: Date, eventsByDay: Map<string, CalendarEvent[]>): DayCell[] => {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - firstWeekday);
  const todayIso = toIsoDate(new Date());

  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    const iso = toIsoDate(date);
    cells.push({
      date,
      iso,
      inCurrentMonth: date.getMonth() === month,
      isToday: iso === todayIso,
      events: eventsByDay.get(iso) ?? [],
    });
  }
  const lastWeek = cells.slice(35, 42);
  if (lastWeek.every((c) => !c.inCurrentMonth)) {
    return cells.slice(0, 35);
  }
  return cells;
};

const buildWeekDays = (anchor: Date, eventsByDay: Map<string, CalendarEvent[]>): DayCell[] => {
  const start = startOfWeek(anchor);
  const todayIso = toIsoDate(new Date());
  const cells: DayCell[] = [];
  for (let i = 0; i < 7; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const iso = toIsoDate(date);
    cells.push({
      date,
      iso,
      inCurrentMonth: true,
      isToday: iso === todayIso,
      events: eventsByDay.get(iso) ?? [],
    });
  }
  return cells;
};

const formatDayLabel = (iso: string): string => {
  const date = new Date(iso);
  const todayIso = toIsoDate(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = toIsoDate(tomorrow);
  if (iso === todayIso) return "Dnes";
  if (iso === tomorrowIso) return "Zítra";
  return date.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", weekday: "short" });
};

const formatDayFull = (date: Date): string => {
  const weekday = WEEKDAY_LABELS_LONG[(date.getDay() + 6) % 7];
  return `${weekday}, ${date.getDate()}. ${MONTH_LABELS_GENITIVE[date.getMonth()]} ${date.getFullYear()}`;
};

const formatWeekRange = (anchor: Date): string => {
  const start = startOfWeek(anchor);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}. – ${end.getDate()}. ${MONTH_LABELS_GENITIVE[start.getMonth()]} ${end.getFullYear()}`;
  }
  return `${start.getDate()}. ${MONTH_LABELS_GENITIVE[start.getMonth()]} – ${end.getDate()}. ${MONTH_LABELS_GENITIVE[end.getMonth()]} ${end.getFullYear()}`;
};

export const CalendarModule: React.FC<ModuleProps> = ({ filterState }) => {
  const events = useCalendarData(filterState);
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [anchor, setAnchor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const iso = toIsoDate(new Date(ev.date));
      const arr = map.get(iso) ?? [];
      arr.push(ev);
      map.set(iso, arr);
    }
    return map;
  }, [events]);

  const monthCells = useMemo(() => buildMonthGrid(anchor, eventsByDay), [anchor, eventsByDay]);
  const weekCells = useMemo(() => buildWeekDays(anchor, eventsByDay), [anchor, eventsByDay]);
  const dayIso = useMemo(() => toIsoDate(anchor), [anchor]);
  const dayEvents = useMemo(() => eventsByDay.get(dayIso) ?? [], [eventsByDay, dayIso]);

  const upcomingEvents = useMemo(() => {
    if (selectedIso) return eventsByDay.get(selectedIso) ?? [];
    const todayMs = new Date().setHours(0, 0, 0, 0);
    return events.filter((e) => e.timestamp >= todayMs).slice(0, 20);
  }, [events, eventsByDay, selectedIso]);

  const shiftAnchor = (direction: -1 | 1) => {
    setAnchor((prev) => {
      const d = new Date(prev);
      if (viewMode === "month") d.setMonth(d.getMonth() + direction);
      else if (viewMode === "week") d.setDate(d.getDate() + 7 * direction);
      else d.setDate(d.getDate() + direction);
      return d;
    });
    setSelectedIso(null);
  };

  const goPrev = () => shiftAnchor(-1);
  const goNext = () => shiftAnchor(1);
  const goToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setAnchor(d);
    setSelectedIso(null);
  };

  const handleEventClick = (ev: CalendarEvent) => {
    if (ev.kind === "task" && ev.sourceTask) {
      setEditingTask(ev.sourceTask);
    } else if (ev.actionUrl) {
      navigate(ev.actionUrl);
    }
  };

  const handleDayClick = (cell: DayCell) => {
    if (cell.events.length === 0) {
      setSelectedIso(null);
      return;
    }
    setSelectedIso(selectedIso === cell.iso ? null : cell.iso);
  };

  const handleDayDrillIn = (cell: DayCell) => {
    setAnchor(new Date(cell.date));
    setViewMode("day");
    setSelectedIso(null);
  };

  const todayLabel = useMemo(() => {
    const d = new Date();
    const weekday = d.toLocaleDateString("cs-CZ", { weekday: "short" });
    return `${weekday.replace(".", "")} ${d.getDate()}. ${MONTH_LABELS[d.getMonth()].toLowerCase()} ${d.getFullYear()}`;
  }, []);

  const navLabel = useMemo(() => {
    if (viewMode === "month") return `${MONTH_LABELS[anchor.getMonth()]} ${anchor.getFullYear()}`;
    if (viewMode === "week") return formatWeekRange(anchor);
    return formatDayFull(anchor);
  }, [anchor, viewMode]);

  const navAriaPrev = viewMode === "month" ? "Předchozí měsíc" : viewMode === "week" ? "Předchozí týden" : "Předchozí den";
  const navAriaNext = viewMode === "month" ? "Další měsíc" : viewMode === "week" ? "Další týden" : "Další den";

  return (
    <div className="cc-panel">
      <div className="cc-panel__head">
        <span className="cc-panel__title cc-panel__title--blue">
          Kalendář
          <button
            type="button"
            className="cc-cal__today-chip"
            onClick={goToday}
            title="Skočit na dnešní datum"
          >
            Dnes · {todayLabel}
          </button>
        </span>
        <div className="cc-cal__view-switch" role="tablist" aria-label="Zobrazení kalendáře">
          {(["month", "week", "day"] as CalendarViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={viewMode === mode}
              className={`cc-cal__view-btn${viewMode === mode ? " cc-cal__view-btn--active" : ""}`}
              onClick={() => {
                setViewMode(mode);
                setSelectedIso(null);
              }}
            >
              {mode === "month" ? "Měsíc" : mode === "week" ? "Týden" : "Den"}
            </button>
          ))}
        </div>
      </div>

      <div className="cc-cal__subhead">
        <div className="cc-cal__nav">
          <button type="button" className="cc-cal__nav-btn" onClick={goPrev} aria-label={navAriaPrev}>‹</button>
          <button type="button" className="cc-cal__nav-label" onClick={goToday} title="Skočit na dnes">
            {navLabel}
          </button>
          <button type="button" className="cc-cal__nav-btn" onClick={goNext} aria-label={navAriaNext}>›</button>
        </div>
      </div>

      <div className="cc-panel__body cc-panel__body--flush">
        {viewMode === "month" && (
          <div className="cc-cal">
            <div className="cc-cal__weekdays">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="cc-cal__weekday">{label}</div>
              ))}
            </div>
            <div className="cc-cal__grid">
              {monthCells.map((cell) => {
                const tones = Array.from(new Set(cell.events.map((e) => e.tone))).slice(0, 3);
                const isSelected = selectedIso === cell.iso;
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    className={`cc-cal__cell${cell.inCurrentMonth ? "" : " cc-cal__cell--out"}${cell.isToday ? " cc-cal__cell--today" : ""}${isSelected ? " cc-cal__cell--selected" : ""}${cell.events.length > 0 ? " cc-cal__cell--has" : ""}`}
                    onClick={() => handleDayClick(cell)}
                    onDoubleClick={() => handleDayDrillIn(cell)}
                    aria-label={`${cell.date.toLocaleDateString("cs-CZ")}${cell.events.length > 0 ? ` (${cell.events.length} událostí)` : ""}`}
                  >
                    <span className="cc-cal__cell-num">{cell.date.getDate()}</span>
                    {tones.length > 0 && (
                      <span className="cc-cal__cell-dots">
                        {tones.map((tone) => (
                          <span key={tone} className={`cc-cal__dot cc-cal__dot--${tone}`} aria-hidden />
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === "week" && (
          <div className="cc-cal__week">
            {weekCells.map((cell) => (
              <div
                key={cell.iso}
                className={`cc-cal__weekday-row${cell.isToday ? " cc-cal__weekday-row--today" : ""}`}
              >
                <button
                  type="button"
                  className="cc-cal__weekday-head"
                  onClick={() => handleDayDrillIn(cell)}
                  title="Přejít na detail dne"
                >
                  <span className="cc-cal__weekday-dow">{WEEKDAY_LABELS[(cell.date.getDay() + 6) % 7]}</span>
                  <span className="cc-cal__weekday-num">{cell.date.getDate()}.</span>
                </button>
                {cell.events.length === 0 ? (
                  <div className="cc-cal__weekday-empty">—</div>
                ) : (
                  <ul className="cc-cal__events cc-cal__events--inline">
                    {cell.events.map((ev) => (
                      <li key={ev.id} className="cc-cal__event">
                        <button
                          type="button"
                          className="cc-cal__event-btn"
                          onClick={() => handleEventClick(ev)}
                        >
                          <span className={`cc-cal__event-dot cc-cal__dot--${ev.tone}`} aria-hidden />
                          <div className="cc-cal__event-body">
                            <div className="cc-cal__event-title">{ev.title}</div>
                            {ev.subtitle && <div className="cc-cal__event-sub">{ev.subtitle}</div>}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {viewMode === "day" && (
          <div className="cc-cal__day">
            <div className="cc-cal__day-head">
              {dayIso === toIsoDate(new Date()) ? "Dnes" : formatDayLabel(dayIso)}
              <span className="cc-cal__day-count">{dayEvents.length} událostí</span>
            </div>
            {dayEvents.length === 0 ? (
              <div className="cc-panel__empty">Žádné události.</div>
            ) : (
              <ul className="cc-cal__events cc-cal__events--day">
                {dayEvents.map((ev) => (
                  <li key={ev.id} className="cc-cal__event">
                    <button
                      type="button"
                      className="cc-cal__event-btn"
                      onClick={() => handleEventClick(ev)}
                    >
                      <span className={`cc-cal__event-dot cc-cal__dot--${ev.tone}`} aria-hidden />
                      <div className="cc-cal__event-body">
                        <div className="cc-cal__event-title">{ev.title}</div>
                        {ev.subtitle && <div className="cc-cal__event-sub">{ev.subtitle}</div>}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {viewMode === "month" && (
          <div className="cc-cal__list">
            <div className="cc-cal__list-head">
              <span>{selectedIso ? formatDayLabel(selectedIso) : "Nadcházející"}</span>
              {selectedIso && (
                <button
                  type="button"
                  className="cc-cal__list-clear"
                  onClick={() => setSelectedIso(null)}
                >
                  Vše
                </button>
              )}
            </div>
            {upcomingEvents.length === 0 ? (
              <div className="cc-panel__empty">Žádné události.</div>
            ) : (
              <ul className="cc-cal__events">
                {upcomingEvents.map((ev) => (
                  <li key={ev.id} className="cc-cal__event">
                    <button
                      type="button"
                      className="cc-cal__event-btn cc-cal__event-btn--upcoming"
                      onClick={() => handleEventClick(ev)}
                    >
                      <span className="cc-cal__event-date">{formatDayLabel(toIsoDate(new Date(ev.date)))}</span>
                      <div className="cc-cal__event-body">
                        <div className="cc-cal__event-title">{ev.title}</div>
                        {ev.subtitle && <div className="cc-cal__event-sub">{ev.subtitle}</div>}
                      </div>
                      <span className={`cc-cal__event-dot cc-cal__dot--${ev.tone}`} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <TaskFormModal
        isOpen={Boolean(editingTask)}
        onClose={() => setEditingTask(null)}
        task={editingTask ?? undefined}
      />
    </div>
  );
};
