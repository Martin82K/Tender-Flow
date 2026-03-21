import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CategoryCard } from "../components/pipelineComponents/CategoryCard";
import type { DemandCategory } from "../types";

const baseCategory: DemandCategory = {
  id: "cat-1",
  title: "Klempířina",
  status: "open",
  budget: "0 Kč",
  sodBudget: 50000,
  planBudget: 40000,
  subcontractorCount: 1,
  description: "",
  deadline: "2026-03-20",
  realizationStart: "2026-03-23",
  realizationEnd: "2026-03-29",
};

describe("CategoryCard", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("otevre detail pri jednoduchem kliku po kratkem zpozdeni", () => {
    vi.useFakeTimers();
    const onClick = vi.fn();

    const { getByRole } = render(
      <CategoryCard
        category={baseCategory}
        bidCount={1}
        priceOfferCount={1}
        contractedCount={0}
        sodBidsCount={0}
        onClick={onClick}
      />,
    );

    fireEvent.click(getByRole("button"));

    expect(onClick).not.toHaveBeenCalled();

    vi.advanceTimersByTime(220);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("otevre editaci pri dvojkliku a zrusi odlozeny prechod do detailu", () => {
    vi.useFakeTimers();
    const onClick = vi.fn();
    const onDoubleClick = vi.fn();

    const { getByRole } = render(
      <CategoryCard
        category={baseCategory}
        bidCount={1}
        priceOfferCount={1}
        contractedCount={0}
        sodBidsCount={0}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
      />,
    );

    fireEvent.click(getByRole("button"));
    fireEvent.doubleClick(getByRole("button"));
    vi.runAllTimers();

    expect(onDoubleClick).toHaveBeenCalledWith(baseCategory);
    expect(onClick).not.toHaveBeenCalled();
  });
});
