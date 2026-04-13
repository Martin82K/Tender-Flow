import React, { useEffect, useMemo, useRef, useState } from "react";
import type { DemandCategory, TenderPlanItem } from "@/types";
import {
  createTenderPlan,
  createTenderPlanId,
  getTenderPlans,
  updateCategoryDeadline,
  updateCategoryRealizationWindow,
  updateTenderPlanDates,
} from "@/features/projects/api";
import {
  buildAxis,
  buildRows,
  calculateChartRange,
  diffDaysUtc,
  formatDateLabel,
  parseIsoDate,
  Row,
  startOfDay,
  toIsoDateLocal,
  Zoom,
} from "./projectScheduleModel";

interface EditModalState {
  isOpen: boolean;
  row: Row | null;
  start: string;
  end: string;
  isSaving: boolean;
  error?: string | null;
}

const EMPTY_EDIT_MODAL: EditModalState = {
  isOpen: false,
  row: null,
  start: "",
  end: "",
  isSaving: false,
  error: null,
};

interface UseProjectScheduleControllerInput {
  projectId: string;
  categories: DemandCategory[];
}

export const useProjectScheduleController = ({
  projectId,
  categories,
}: UseProjectScheduleControllerInput) => {
  const [tenderPlans, setTenderPlans] = useState<TenderPlanItem[]>([]);
  const [localCategories, setLocalCategories] = useState<DemandCategory[]>(categories);
  const [isLoading, setIsLoading] = useState(true);
  const [includeRealization, setIncludeRealization] = useState(true);
  const [zoom, setZoom] = useState<Zoom>("month");
  const [isEditMode, setIsEditMode] = useState(false);
  const [editModal, setEditModal] = useState<EditModalState>(EMPTY_EDIT_MODAL);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const didAutoFocusRef = useRef(false);
  const [canScroll, setCanScroll] = useState({ left: false, right: false });
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const loadedPlans = await getTenderPlans(projectId);
        if (cancelled) return;
        setTenderPlans(loadedPlans);
      } catch (error) {
        if (!cancelled) {
          console.error("Unexpected error loading tender plans:", error);
          setTenderPlans([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const rows = useMemo(
    () => buildRows(localCategories, tenderPlans, includeRealization),
    [localCategories, tenderPlans, includeRealization],
  );

  const { rangeStart, rangeEnd } = useMemo(() => calculateChartRange(rows), [rows]);

  const dayWidth = zoom === "month" ? 6 : zoom === "week" ? 16 : 24;
  const totalDays = Math.max(1, diffDaysUtc(rangeStart, rangeEnd) + 1);
  const chartWidth = totalDays * dayWidth;
  const leftWidth = 320;

  const axis = useMemo(() => buildAxis(rangeStart, rangeEnd, zoom), [rangeStart, rangeEnd, zoom]);

  const todayX = useMemo(() => {
    const today = startOfDay(new Date());
    const x = diffDaysUtc(rangeStart, today) * dayWidth + dayWidth / 2;
    return { x, label: formatDateLabel(today) };
  }, [rangeStart, dayWidth]);

  const gridBg = useMemo(() => {
    const step = dayWidth;
    return {
      backgroundImage: `repeating-linear-gradient(to right, rgba(148,163,184,0.18) 0, rgba(148,163,184,0.18) 1px, transparent 1px, transparent ${step}px)`,
    } as React.CSSProperties;
  }, [dayWidth]);

  useEffect(() => {
    if (didAutoFocusRef.current) return;
    if (isLoading || rows.length === 0) return;
    if (todayX.x < 0 || todayX.x > chartWidth) return;

    const element = scrollRef.current;
    if (!element) return;

    didAutoFocusRef.current = true;
    requestAnimationFrame(() => {
      const chartViewportWidth = Math.max(0, element.clientWidth - leftWidth);
      const rawTarget = todayX.x - chartViewportWidth / 2;
      const maxScroll = Math.max(0, element.scrollWidth - element.clientWidth);
      const target = Math.max(0, Math.min(rawTarget, maxScroll));
      element.scrollTo({ left: target, behavior: "auto" });
    });
  }, [isLoading, rows.length, todayX.x, chartWidth, leftWidth]);

  useEffect(() => {
    if (isLoading || rows.length === 0) return;
    if (todayX.x < 0 || todayX.x > chartWidth) return;

    const element = scrollRef.current;
    if (!element) return;

    requestAnimationFrame(() => {
      const chartViewportWidth = Math.max(0, element.clientWidth - leftWidth);
      const rawTarget = todayX.x - chartViewportWidth / 2;
      const maxScroll = Math.max(0, element.scrollWidth - element.clientWidth);
      const target = Math.max(0, Math.min(rawTarget, maxScroll));
      element.scrollTo({ left: target, behavior: "smooth" });
    });
  }, [zoom, isLoading, rows.length, todayX.x, chartWidth, leftWidth]);

  const isRowEditable = (row: Row) => {
    if (!isEditMode) return false;
    if (includeRealization) return row.record.type === "category_realization";
    return (
      row.record.type === "tender_plan" ||
      row.record.type === "tender_plan_new" ||
      row.record.type === "category_deadline"
    );
  };

  const openEditModal = (row: Row) => {
    const start = row.start ? toIsoDateLocal(row.start) : "";
    const end = row.end ? toIsoDateLocal(row.end) : "";
    setEditModal({ isOpen: true, row, start, end, isSaving: false, error: null });
  };

  const closeEditModal = () => {
    setEditModal(EMPTY_EDIT_MODAL);
  };

  const saveEditModal = async () => {
    if (!editModal.row) return;

    const row = editModal.row;
    const start = editModal.start.trim();
    const end = editModal.end.trim();

    const startDate = parseIsoDate(start) ?? null;
    const endDate = parseIsoDate(end) ?? null;

    if (start && !startDate) {
      setEditModal((prev) => ({ ...prev, error: "Neplatné datum Od." }));
      return;
    }

    if (end && !endDate) {
      setEditModal((prev) => ({ ...prev, error: "Neplatné datum Do." }));
      return;
    }

    if (!start && !end) {
      // Empty range is valid and clears the schedule.
    } else if (!start || !end) {
      setEditModal((prev) => ({
        ...prev,
        error: "Vyplňte prosím Od i Do (nebo obě smažte).",
      }));
      return;
    }

    setEditModal((prev) => ({ ...prev, isSaving: true, error: null }));

    try {
      if (row.record.type === "category_realization") {
        const categoryId = row.record.categoryId;
        const nextStart = start || null;
        const nextEnd = end || null;

        setLocalCategories((prev) =>
          prev.map((category) =>
            category.id === categoryId
              ? {
                  ...category,
                  realizationStart: nextStart ?? undefined,
                  realizationEnd: nextEnd ?? undefined,
                }
              : category,
          ),
        );

        await updateCategoryRealizationWindow({
          categoryId,
          realizationStart: nextStart,
          realizationEnd: nextEnd,
        });
      } else if (row.record.type === "tender_plan") {
        const planId = row.record.id;
        const nextFrom = start || null;
        const nextTo = end || null;

        setTenderPlans((prev) =>
          prev.map((plan) =>
            plan.id === planId
              ? { ...plan, dateFrom: nextFrom ?? "", dateTo: nextTo ?? "" }
              : plan,
          ),
        );

        await updateTenderPlanDates(planId, nextFrom, nextTo);
      } else if (row.record.type === "tender_plan_new") {
        const newId = createTenderPlanId();
        const nextFrom = start || null;
        const nextTo = end || null;

        const newItem: TenderPlanItem = {
          id: newId,
          name: row.record.name,
          dateFrom: nextFrom ?? "",
          dateTo: nextTo ?? "",
          categoryId: row.record.categoryId,
        };

        setTenderPlans((prev) => [...prev, newItem]);

        await createTenderPlan({
          id: newId,
          projectId,
          name: row.record.name,
          dateFrom: nextFrom,
          dateTo: nextTo,
          categoryId: row.record.categoryId,
        });
      } else if (row.record.type === "category_deadline") {
        const categoryId = row.record.categoryId;

        if (!start || !end || start !== end) {
          setEditModal((prev) => ({
            ...prev,
            isSaving: false,
            error: "U termínu z VŘ nastavte prosím jedno datum (Od = Do).",
          }));
          return;
        }

        setLocalCategories((prev) =>
          prev.map((category) =>
            category.id === categoryId ? { ...category, deadline: start } : category,
          ),
        );

        await updateCategoryDeadline(categoryId, start);
      }

      closeEditModal();
    } catch (error: any) {
      console.error("Error saving schedule:", error);
      setEditModal((prev) => ({
        ...prev,
        isSaving: false,
        error: error?.message ?? "Nepodařilo se uložit změny.",
      }));
    }
  };

  useEffect(() => {
    const update = () => {
      const element = scrollRef.current;
      if (!element) return;
      const left = element.scrollLeft > 4;
      const right = element.scrollLeft + element.clientWidth < element.scrollWidth - 4;
      setCanScroll({ left, right });
    };

    update();
    const element = scrollRef.current;
    element?.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      element?.removeEventListener("scroll", update as EventListener);
      window.removeEventListener("resize", update);
    };
  }, [chartWidth, rows.length, zoom]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showExportMenu]);

  return {
    tenderPlans,
    setTenderPlans,
    localCategories,
    isLoading,
    includeRealization,
    setIncludeRealization,
    zoom,
    setZoom,
    isEditMode,
    setIsEditMode,
    editModal,
    setEditModal,
    rows,
    rangeStart,
    rangeEnd,
    dayWidth,
    chartWidth,
    axis,
    todayX,
    gridBg,
    leftWidth,
    scrollRef,
    canScroll,
    showExportMenu,
    setShowExportMenu,
    exportMenuRef,
    isRowEditable,
    openEditModal,
    closeEditModal,
    saveEditModal,
  };
};
