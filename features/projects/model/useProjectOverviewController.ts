import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useContactsQuery } from "@/hooks/queries/useContactsQuery";
import { useOverviewTenantDataQuery } from "@/hooks/queries/useOverviewTenantDataQuery";
import type { Project, ProjectDetails } from "@/types";
import { isUserAdmin } from "@/utils/helpers";
import { buildOverviewAnalytics } from "@/utils/overviewAnalytics";
import { filterSuppliers } from "@/utils/supplierFilters";
import { SECTION_DEFAULTS } from "@/features/projects/ui/OverviewSection";
import {
  buildAverageBudgetDeviation,
  buildSelectedSupplierMonthlySeries,
  buildSelectedSupplierSummary,
  buildStatusCounts,
  buildSupplierRows,
  findExactSelectedSupplier,
  sortSupplierOffersByDate,
} from "./projectOverviewModel";

interface UseProjectOverviewControllerInput {
  projects: Project[];
  projectDetails: Record<string, ProjectDetails | undefined>;
}

export const useProjectOverviewController = ({
  projects,
  projectDetails,
}: UseProjectOverviewControllerInput) => {
  const { user } = useAuth();
  const { data: contacts = [] } = useContactsQuery();
  const {
    data: tenantData,
    isLoading: tenantLoading,
    error: tenantError,
  } = useOverviewTenantDataQuery();

  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "tender" | "realization" | "archived"
  >("all");
  const [scope, setScope] = useState<"tenant" | "project">("tenant");
  const [sections, setSections] = useState(SECTION_DEFAULTS);
  const [showAllSuppliers, setShowAllSuppliers] = useState(false);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierSpecialization, setSupplierSpecialization] = useState("");

  const tenantProjects = tenantData?.projects ?? [];
  const tenantProjectDetails = tenantData?.projectDetails ?? {};
  const availableProjects = tenantProjects.length > 0 ? tenantProjects : projects;
  const availableProjectDetails =
    tenantProjects.length > 0 ? tenantProjectDetails : projectDetails;

  const isAdmin = isUserAdmin(user?.email);
  const showDebugBanner = useMemo(() => {
    if (!isAdmin) return false;
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("debugOverview") === "1";
  }, [isAdmin]);

  useEffect(() => {
    if (scope !== "project") return;
    if (selectedProjectId === "all") return;
    if (availableProjects.length === 0) return;
    const exists = availableProjects.some(
      (project) => project.id === selectedProjectId,
    );
    if (!exists) {
      setSelectedProjectId("all");
    }
  }, [availableProjects, scope, selectedProjectId]);

  const filteredProjectDetails = useMemo(() => {
    if (scope === "tenant") return availableProjectDetails;
    if (selectedProjectId === "all") return availableProjectDetails;
    return { [selectedProjectId]: availableProjectDetails[selectedProjectId] };
  }, [availableProjectDetails, selectedProjectId, scope]);

  const analytics = useMemo(
    () =>
      buildOverviewAnalytics(
        availableProjects,
        filteredProjectDetails,
        statusFilter,
      ),
    [availableProjects, filteredProjectDetails, statusFilter],
  );

  const supplierRows = useMemo(
    () => buildSupplierRows(analytics.suppliers, contacts),
    [analytics.suppliers, contacts],
  );

  const specializationOptions = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach((contact) => {
      (contact.specialization || []).forEach((item) => {
        if (item) set.add(item);
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "cs-CZ"));
  }, [contacts]);

  const filteredSuppliers = useMemo(
    () =>
      filterSuppliers(supplierRows, {
        query: supplierQuery,
        specialization: supplierSpecialization,
      }),
    [supplierRows, supplierQuery, supplierSpecialization],
  );

  const selectedSupplier = useMemo(
    () => findExactSelectedSupplier(filteredSuppliers, supplierQuery),
    [filteredSuppliers, supplierQuery],
  );
  const selectedSupplierOffers = useMemo(
    () => sortSupplierOffersByDate(selectedSupplier),
    [selectedSupplier],
  );
  const selectedSupplierSummary = useMemo(
    () => buildSelectedSupplierSummary(selectedSupplier),
    [selectedSupplier],
  );
  const selectedSupplierMonthlySeries = useMemo(
    () => buildSelectedSupplierMonthlySeries(selectedSupplier),
    [selectedSupplier],
  );

  const topSuppliers = showAllSuppliers
    ? filteredSuppliers
    : filteredSuppliers.slice(0, 6);
  const trendYears = analytics.yearTrends.map((trend) => trend.year);

  const toggleSection = (id: keyof typeof SECTION_DEFAULTS) => {
    setSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const statusCounts = useMemo(
    () => buildStatusCounts(analytics.suppliers),
    [analytics.suppliers],
  );
  const avgBudgetDeviation = useMemo(
    () => buildAverageBudgetDeviation(analytics.suppliers),
    [analytics.suppliers],
  );

  const resetSupplierFilters = () => {
    setSupplierQuery("");
    setSupplierSpecialization("");
  };

  return {
    tenantLoading,
    tenantError,
    tenantProjects,
    tenantProjectDetails,
    availableProjects,
    showDebugBanner,
    selectedProjectId,
    setSelectedProjectId,
    statusFilter,
    setStatusFilter,
    scope,
    setScope,
    sections,
    toggleSection,
    showAllSuppliers,
    setShowAllSuppliers,
    supplierQuery,
    setSupplierQuery,
    supplierSpecialization,
    setSupplierSpecialization,
    specializationOptions,
    supplierRows,
    filteredSuppliers,
    selectedSupplier,
    selectedSupplierOffers,
    selectedSupplierSummary,
    selectedSupplierMonthlySeries,
    topSuppliers,
    trendYears,
    analytics,
    statusCounts,
    avgBudgetDeviation,
    resetSupplierFilters,
  };
};
