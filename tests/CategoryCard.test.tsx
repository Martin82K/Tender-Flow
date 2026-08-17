import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CategoryCard } from "@features/projects/pipeline";
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

  it("zachova klavesnicove ovladani bez cekani na rozliseni dvojkliku", () => {
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

    const card = getByRole("button");
    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });

    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("oddeli akce karty od otevreni detailu", () => {
    vi.useFakeTimers();
    const category = { ...baseCategory, status: "closed" as const };
    const onClick = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const onToggleComplete = vi.fn();
    const { getByTitle } = render(
      <CategoryCard
        category={category}
        bidCount={4}
        priceOfferCount={3}
        contractedCount={2}
        sodBidsCount={2}
        onClick={onClick}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleComplete={onToggleComplete}
      />,
    );

    fireEvent.click(getByTitle("Označit jako otevřenou"));
    fireEvent.click(getByTitle("Upravit"));
    fireEvent.click(getByTitle("Smazat"));
    vi.runAllTimers();

    expect(onToggleComplete).toHaveBeenCalledWith(category);
    expect(onEdit).toHaveBeenCalledWith(category);
    expect(onDelete).toHaveBeenCalledWith(category.id);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("zobrazi stav, viteznou cenu a uplny stav smluv", () => {
    const category = {
      ...baseCategory,
      status: "closed" as const,
      winningPrice: 764055,
    };
    const { getByText } = render(
      <CategoryCard
        category={category}
        bidCount={4}
        priceOfferCount={3}
        contractedCount={2}
        sodBidsCount={2}
        onClick={vi.fn()}
      />,
    );

    expect(getByText("Uzavřeno")).toBeInTheDocument();
    expect(getByText("Vítězná cena")).toBeInTheDocument();
    expect(
      getByText(
        (_content, element) =>
          element?.tagName === "SPAN" &&
          element.textContent === "764 055,00 Kč",
      ),
    ).toBeInTheDocument();
    expect(getByText("4")).toBeInTheDocument();
    expect(getByText("3")).toBeInTheDocument();
    expect(getByText("2/2")).toBeInTheDocument();
    expect(getByText("verified")).toBeInTheDocument();
  });

  it("nezobrazuje dekorativni sipku na kartu", () => {
    const { queryByText } = render(
      <CategoryCard
        category={baseCategory}
        bidCount={1}
        priceOfferCount={1}
        contractedCount={0}
        sodBidsCount={0}
        onClick={vi.fn()}
      />,
    );

    expect(queryByText("arrow_forward")).not.toBeInTheDocument();
  });

  it("po odpojeni komponenty nespusti cekajici klik", () => {
    vi.useFakeTimers();
    const onClick = vi.fn();
    const { getByRole, unmount } = render(
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
    unmount();
    vi.runAllTimers();

    expect(onClick).not.toHaveBeenCalled();
  });
});
