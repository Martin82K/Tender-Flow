import { useEffect, useMemo, useRef, useState } from "react";
import type { ContractDetails, InvestorFinancials, ProjectDetails } from "@/types";
import {
  buildDemandTableData,
  calculateOverviewFinancials,
  getWinningBidTotal,
  getWinningBids,
  type OverviewDemandFilter,
} from "./projectOverviewNewModel";

const DEFAULT_COLUMNS = {
  sod: true,
  plan: true,
  pn_vr: true,
  sod_vr: false,
  nabidky: false,
  smlouvy: false,
};

export type ProjectOverviewVisibleColumns = typeof DEFAULT_COLUMNS;

const DEFAULT_INVESTOR: InvestorFinancials = {
  sodPrice: 0,
  amendments: [],
};

interface InfoFormState {
  investor: string;
  technicalSupervisor: string;
  location: string;
  finishDate: string;
  siteManager: string;
  constructionManager: string;
  constructionTechnician: string;
}

interface InternalFormState {
  plannedCost: number;
}

interface UseProjectOverviewNewControllerInput {
  project: ProjectDetails;
  onUpdate: (updates: Partial<ProjectDetails>) => void;
  userId?: string;
  searchQuery: string;
}

const buildInfoForm = (project: ProjectDetails): InfoFormState => ({
  investor: project.investor || "",
  technicalSupervisor: project.technicalSupervisor || "",
  location: project.location || "",
  finishDate: project.finishDate || "",
  siteManager: project.siteManager || "",
  constructionManager: project.constructionManager || "",
  constructionTechnician: project.constructionTechnician || "",
});

export const useProjectOverviewNewController = ({
  project,
  onUpdate,
  userId,
  searchQuery,
}: UseProjectOverviewNewControllerInput) => {
  const projectIdentity = project.id || `${project.title}:${project.location}`;
  const previousProjectIdentityRef = useRef(projectIdentity);

  const contract = project.contract;
  const investor = project.investorFinancials || DEFAULT_INVESTOR;
  const plannedCost = project.plannedCost || 0;

  const [editingInfo, setEditingInfo] = useState(false);
  const [editingContract, setEditingContract] = useState(false);
  const [editingInvestor, setEditingInvestor] = useState(false);
  const [editingInternal, setEditingInternal] = useState(false);

  const [demandFilter, setDemandFilter] = useState<OverviewDemandFilter>("all");
  const [visibleColumns, setVisibleColumns] =
    useState<ProjectOverviewVisibleColumns>(DEFAULT_COLUMNS);
  const [isLoaded, setIsLoaded] = useState(false);

  const [infoForm, setInfoForm] = useState<InfoFormState>(buildInfoForm(project));
  const [contractForm, setContractForm] = useState<ContractDetails>(
    project.contract || {
      maturity: 30,
      warranty: 0,
      retention: "",
      siteFacilities: 0,
      insurance: 0,
    },
  );
  const [investorForm, setInvestorForm] = useState<InvestorFinancials>(
    project.investorFinancials || DEFAULT_INVESTOR,
  );
  const [internalForm, setInternalForm] = useState<InternalFormState>({
    plannedCost,
  });

  useEffect(() => {
    if (!userId) return;
    const storageKey = `projectOverviewColumns_v1_${userId || "guest"}`;
    const saved = localStorage.getItem(storageKey);

    if (saved) {
      try {
        setVisibleColumns({ ...DEFAULT_COLUMNS, ...JSON.parse(saved) });
      } catch (error) {
        console.error("Failed to parse column settings", error);
      }
    }

    setIsLoaded(true);
  }, [userId]);

  useEffect(() => {
    if (!isLoaded || !userId) return;
    const storageKey = `projectOverviewColumns_v1_${userId || "guest"}`;
    localStorage.setItem(storageKey, JSON.stringify(visibleColumns));
  }, [visibleColumns, isLoaded, userId]);

  useEffect(() => {
    const projectChanged = previousProjectIdentityRef.current !== projectIdentity;

    if (projectChanged) {
      previousProjectIdentityRef.current = projectIdentity;
      setEditingInfo(false);
      setEditingContract(false);
      setEditingInvestor(false);
      setEditingInternal(false);
      setInfoForm(buildInfoForm(project));
      setContractForm(
        project.contract || {
          maturity: 30,
          warranty: 0,
          retention: "",
          siteFacilities: 0,
          insurance: 0,
        },
      );
      setInvestorForm(project.investorFinancials || DEFAULT_INVESTOR);
      setInternalForm({
        plannedCost: project.plannedCost || 0,
      });
      return;
    }

    if (!editingInfo) {
      setInfoForm(buildInfoForm(project));
    }

    if (!editingContract && project.contract) {
      setContractForm(project.contract);
    }

    if (!editingInvestor) {
      if (project.investorFinancials) {
        setInvestorForm(project.investorFinancials);
      } else {
        setInvestorForm(DEFAULT_INVESTOR);
      }
    }

    if (!editingInternal) {
      setInternalForm({
        plannedCost: project.plannedCost || 0,
      });
    }
  }, [project, projectIdentity, editingInfo, editingContract, editingInvestor, editingInternal]);

  const {
    totalBudget,
    totalContractedCost,
    completedTasks,
    plannedBalance,
    progress,
  } = useMemo(
    () => calculateOverviewFinancials(project, plannedCost),
    [project, plannedCost],
  );

  const {
    filteredCategories,
    sodCount,
    openCount,
    closedCount,
    allCount,
  } = useMemo(
    () => buildDemandTableData(project, demandFilter, searchQuery),
    [project, demandFilter, searchQuery],
  );

  const totalSodBudget = useMemo(
    () =>
      project.categories.reduce((acc, category) => acc + (category.sodBudget || 0), 0),
    [project.categories],
  );

  const totalPlanBudget = useMemo(
    () =>
      project.categories.reduce((acc, category) => acc + (category.planBudget || 0), 0),
    [project.categories],
  );

  const totalWinningBidCost = useMemo(
    () =>
      project.categories.reduce(
        (sum, category) => sum + getWinningBidTotal(project, category.id),
        0,
      ),
    [project],
  );

  const totalSodDiff = useMemo(
    () =>
      project.categories.reduce((sum, category) => {
        const winningBids = getWinningBids(project, category.id);
        if (winningBids.length === 0) return sum;
        const subPrice = getWinningBidTotal(project, category.id);
        return sum + ((category.sodBudget || 0) - subPrice);
      }, 0),
    [project],
  );

  const totalPlanDiff = useMemo(
    () =>
      project.categories.reduce((sum, category) => {
        const winningBids = getWinningBids(project, category.id);
        if (winningBids.length === 0) return sum;
        const subPrice = getWinningBidTotal(project, category.id);
        return sum + (category.planBudget - subPrice);
      }, 0),
    [project],
  );

  const handleSaveInfo = () => {
    onUpdate({
      investor: infoForm.investor,
      technicalSupervisor: infoForm.technicalSupervisor,
      location: infoForm.location,
      finishDate: infoForm.finishDate,
      siteManager: infoForm.siteManager,
      constructionManager: infoForm.constructionManager,
      constructionTechnician: infoForm.constructionTechnician,
    });
    setEditingInfo(false);
  };

  const handleSaveContract = () => {
    onUpdate({ contract: contractForm });
    setEditingContract(false);
  };

  const handleSaveInvestor = () => {
    onUpdate({ investorFinancials: investorForm });
    setEditingInvestor(false);
  };

  const handleSaveInternal = () => {
    onUpdate({ plannedCost: internalForm.plannedCost });
    setEditingInternal(false);
  };

  const addAmendment = () => {
    setInvestorForm((prev) => ({
      ...prev,
      amendments: [
        ...prev.amendments,
        {
          id: `a${Date.now()}`,
          label: `Dodatek č.${prev.amendments.length + 1}`,
          price: 0,
        },
      ],
    }));
  };

  const updateAmendment = (
    index: number,
    field: "label" | "price",
    value: string | number,
  ) => {
    const nextAmendments = [...investorForm.amendments];
    nextAmendments[index] = { ...nextAmendments[index], [field]: value };
    setInvestorForm({ ...investorForm, amendments: nextAmendments });
  };

  const removeAmendment = (index: number) => {
    const nextAmendments = investorForm.amendments.filter((_, i) => i !== index);
    setInvestorForm({ ...investorForm, amendments: nextAmendments });
  };

  const toggleColumn = (column: keyof ProjectOverviewVisibleColumns) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [column]: !prev[column],
    }));
  };

  return {
    contract,
    investor,
    plannedCost,
    editingInfo,
    setEditingInfo,
    editingContract,
    setEditingContract,
    editingInvestor,
    setEditingInvestor,
    editingInternal,
    setEditingInternal,
    demandFilter,
    setDemandFilter,
    visibleColumns,
    toggleColumn,
    infoForm,
    setInfoForm,
    contractForm,
    setContractForm,
    investorForm,
    setInvestorForm,
    internalForm,
    setInternalForm,
    totalBudget,
    totalContractedCost,
    completedTasks,
    plannedBalance,
    progress,
    handleSaveInfo,
    handleSaveContract,
    handleSaveInvestor,
    handleSaveInternal,
    addAmendment,
    updateAmendment,
    removeAmendment,
    filteredCategories,
    sodCount,
    openCount,
    closedCount,
    allCount,
    totalSodBudget,
    totalPlanBudget,
    totalWinningBidCost,
    totalSodDiff,
    totalPlanDiff,
  };
};
