import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_FILTER_STATE } from "@/features/command-center/types";
import type { CalendarEvent } from "@/features/command-center/hooks/useCalendarData";

const calendarMocks = vi.hoisted(() => ({
  events: [] as CalendarEvent[],
}));

vi.mock("@features/command-center/hooks/useCalendarData", () => ({
  useCalendarData: () => calendarMocks.events,
}));

vi.mock("@features/tasks", () => ({
  TaskFormModal: () => null,
}));

vi.mock("@shared/routing/router", () => ({
  navigate: vi.fn(),
}));

import { CalendarModule } from "@/features/command-center/modules/calendar/CalendarModule";

const renderCalendar = () =>
  render(
    <CalendarModule
      settings={{}}
      onSettingsChange={vi.fn()}
      filterState={DEFAULT_FILTER_STATE}
      onFilterChange={vi.fn()}
    />,
  );

describe("CalendarModule month tooltips", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-10T12:00:00+02:00"));
    calendarMocks.events = [
      {
        id: "deadline-cat-1",
        kind: "demand-deadline",
        tone: "red",
        title: "Termín nabídky: Technologie bazénu",
        subtitle: "REKO Bazén Aš",
        date: "2026-05-07T10:00:00+02:00",
        timestamp: new Date("2026-05-07T10:00:00+02:00").getTime(),
      },
      {
        id: "real-end-cat-1",
        kind: "realization-end",
        tone: "green",
        title: "Konec realizace: Lešení",
        subtitle: "REKO Bazén Aš",
        date: "2026-05-30T10:00:00+02:00",
        timestamp: new Date("2026-05-30T10:00:00+02:00").getTime(),
      },
    ];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows event text in the date title and accessible label", () => {
    renderCalendar();

    const eventDay = screen.getByRole("button", {
      name: /Termín nabídky: Technologie bazénu - REKO Bazén Aš/,
    });
    const emptyDay = screen.getByRole("button", { name: "8. 5. 2026" });

    expect(eventDay).toHaveAttribute("title", "Termín nabídky: Technologie bazénu - REKO Bazén Aš");
    expect(emptyDay).not.toHaveAttribute("title");
  });
});
