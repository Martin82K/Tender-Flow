import type { Bid, DemandCategory, ProjectDetails } from "@/types";

export type OverviewDemandFilter = "all" | "open" | "closed" | "sod";

export const parseMoney = (valueStr: string): number => {
  if (!valueStr || valueStr === "-" || valueStr === "?") return 0;

  const hasM = /M/i.test(valueStr);
  const hasK = /K/i.test(valueStr) && !/Kč/i.test(valueStr);
  const cleanStr = valueStr
    .replace(/\s/g, "")
    .replace(/[^0-9,.-]/g, "")
    .replace(",", ".");

  let value = parseFloat(cleanStr);
  if (hasM) value *= 1_000_000;
  else if (hasK) value *= 1_000;

  return Number.isNaN(value) ? 0 : value;
};

export const formatMoney = (value: number): string => {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(value);
};

export const formatMoneyFull = (value: number): string => {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(value);
};

const getCategoryBids = (project: ProjectDetails, categoryId: string): Bid[] => {
  return project.bids?.[categoryId] || [];
};

export const getWinningBids = (project: ProjectDetails, categoryId: string): Bid[] => {
  return getCategoryBids(project, categoryId).filter((bid) => bid.status === "sod");
};

export const getWinningBidTotal = (project: ProjectDetails, categoryId: string): number => {
  return getWinningBids(project, categoryId).reduce(
    (sum, bid) => sum + parseMoney(bid.price || "0"),
    0,
  );
};

export const hasContractedWinner = (project: ProjectDetails, categoryId: string): boolean => {
  return getCategoryBids(project, categoryId).some(
    (bid) => bid.status === "sod" && Boolean(bid.contracted),
  );
};

export const calculateOverviewFinancials = (
  project: ProjectDetails,
  plannedCost: number,
) => {
  const investor = project.investorFinancials || { sodPrice: 0, amendments: [] };
  const investorSod = investor.sodPrice || 0;
  const investorAmendmentsTotal = investor.amendments.reduce(
    (sum, amendment) => sum + (amendment.price || 0),
    0,
  );
  const totalBudget = investorSod + investorAmendmentsTotal;

  const internalAmendments = project.internalAmendments || [];
  const internalAmendmentsTotal = internalAmendments.reduce(
    (sum, amendment) => sum + (amendment.price || 0),
    0,
  );
  const totalPlannedCost = plannedCost + internalAmendmentsTotal;

  let totalContractedCost = 0;
  let completedTasks = 0;

  project.categories.forEach((category) => {
    const winners = getWinningBids(project, category.id);
    if (winners.length > 0) {
      totalContractedCost += winners.reduce(
        (sum, bid) => sum + parseMoney(bid.price || "0"),
        0,
      );
      completedTasks += 1;
    }
  });

  const plannedBalance = totalPlannedCost > 0 ? totalPlannedCost - totalContractedCost : 0;
  const progress =
    project.categories.length > 0
      ? (completedTasks / project.categories.length) * 100
      : 0;

  return {
    investorSod,
    investorAmendmentsTotal,
    totalBudget,
    internalAmendmentsTotal,
    totalPlannedCost,
    totalContractedCost,
    completedTasks,
    plannedBalance,
    progress,
  };
};

const matchesDemandFilter = (
  category: DemandCategory,
  filter: OverviewDemandFilter,
  project: ProjectDetails,
) => {
  if (filter === "all") return true;
  if (filter === "open") {
    return category.status === "open" && !hasContractedWinner(project, category.id);
  }
  if (filter === "closed") {
    return category.status === "closed" && !hasContractedWinner(project, category.id);
  }
  if (filter === "sod") {
    return hasContractedWinner(project, category.id);
  }
  return true;
};

const matchesSearch = (
  category: DemandCategory,
  query: string,
  project: ProjectDetails,
) => {
  if (!query.trim()) return true;

  const normalizedQuery = query.toLowerCase();
  const winnersNames = getWinningBids(project, category.id)
    .map((winner) => winner.companyName)
    .join(" ")
    .toLowerCase();

  return (
    category.title.toLowerCase().includes(normalizedQuery) ||
    category.description?.toLowerCase().includes(normalizedQuery) ||
    winnersNames.includes(normalizedQuery)
  );
};

export const buildDemandTableData = (
  project: ProjectDetails,
  demandFilter: OverviewDemandFilter,
  searchQuery: string,
) => {
  const filteredCategories = project.categories.filter((category) => {
    return (
      matchesDemandFilter(category, demandFilter, project) &&
      matchesSearch(category, searchQuery, project)
    );
  });

  const sodCount = project.categories.reduce((acc, category) => {
    const contractedSodCount = getCategoryBids(project, category.id).filter(
      (bid) => bid.status === "sod" && Boolean(bid.contracted),
    ).length;
    return acc + contractedSodCount;
  }, 0);

  const openCount = project.categories.filter(
    (category) => category.status === "open" && !hasContractedWinner(project, category.id),
  ).length;

  const closedCount = project.categories.filter(
    (category) => category.status === "closed" && !hasContractedWinner(project, category.id),
  ).length;

  const allCount = project.categories.length;

  return {
    filteredCategories,
    sodCount,
    openCount,
    closedCount,
    allCount,
  };
};
