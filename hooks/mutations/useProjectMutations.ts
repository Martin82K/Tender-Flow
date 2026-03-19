import { useMutation, useQueryClient } from "@tanstack/react-query";
import { dbAdapter } from "../../services/dbAdapter";
import { Project, ProjectDetails, DemandCategory } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { PROJECT_KEYS } from "../queries/useProjectsQuery";
import { PROJECT_DETAILS_KEYS } from "../queries/useProjectDetailsQuery";
import { OVERVIEW_TENANT_DATA_KEY } from "../queries/useOverviewTenantDataQuery";
import { getDemoData, saveDemoData } from "../../services/demoData";
import { invokeAuthedFunction } from "../../services/functionsClient";
import { ensureStructure } from "../../services/fileSystemService";
import { buildHierarchyTree, resolveDocHubStructureV1 } from "../../utils/docHub";
import { cloneTenderToRealization } from "@/features/projects/api/projectCloneApi";

// Helper for DocHub Sync
const syncDocHubCategory = async (projectId: string, action: "upsert" | "archive", categoryId: string, categoryTitle?: string) => {
    try {
        await invokeAuthedFunction("dochub-sync-category", {
            body: { projectId, categoryId, categoryTitle, action },
        });
    } catch (e) {
        console.error("DocHub sync failed", e);
    }
};

export const useAddProjectMutation = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async (newProject: Project) => {
            if (user?.role === "demo") {
                const demoData = getDemoData();
                if (demoData) {
                    demoData.projects = [newProject, ...demoData.projects];
                    demoData.projectDetails[newProject.id] = {
                        id: newProject.id,
                        title: newProject.name,
                        location: newProject.location,
                        categories: []
                    } as any;
                    saveDemoData(demoData);
                }
                return newProject;
            }

            const { error } = await dbAdapter.from("projects").insert({
                id: newProject.id,
                name: newProject.name,
                location: newProject.location,
                status: newProject.status,
                owner_id: user?.id,
            });
            if (error) throw error;
            return newProject;
        },
        onMutate: async (newProject) => {
            await queryClient.cancelQueries({ queryKey: PROJECT_KEYS.list() });
            const previousProjects = queryClient.getQueryData<Project[]>(PROJECT_KEYS.list());
            queryClient.setQueryData<Project[]>(PROJECT_KEYS.list(), (old) => [newProject, ...(old || [])]);
            return { previousProjects };
        },
        onError: (_err, _newProject, context) => {
            queryClient.setQueryData(PROJECT_KEYS.list(), context?.previousProjects);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.list() });
            queryClient.invalidateQueries({ queryKey: OVERVIEW_TENANT_DATA_KEY });
        },
    });
};

export const useDeleteProjectMutation = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async (id: string) => {
            if (user?.role === "demo") {
                const demoData = getDemoData();
                if (demoData) {
                    demoData.projects = demoData.projects.filter(p => p.id !== id);
                    delete demoData.projectDetails[id];
                    saveDemoData(demoData);
                }
                return id;
            }

            const { error } = await dbAdapter.from("projects").delete().eq("id", id);
            if (error) throw error;
            return id;
        },
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: PROJECT_KEYS.list() });
            const previousProjects = queryClient.getQueryData<Project[]>(PROJECT_KEYS.list());
            queryClient.setQueryData<Project[]>(PROJECT_KEYS.list(), (old) => (old || []).filter(p => p.id !== id));
            return { previousProjects };
        },
        onError: (_err, _id, context) => {
            queryClient.setQueryData(PROJECT_KEYS.list(), context?.previousProjects);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.list() });
            queryClient.invalidateQueries({ queryKey: OVERVIEW_TENANT_DATA_KEY });
        },
    });
};

const extractEffectiveBidDisplayPrice = (bid: any): string | null => {
    if (typeof bid?.price === "string" && bid.price.trim() && bid.price !== "?" && bid.price !== "-") {
        return bid.price;
    }

    const priceHistory = bid?.priceHistory;
    if (!priceHistory || typeof priceHistory !== "object") {
        return null;
    }

    const sortedEntries = Object.entries(priceHistory)
        .map(([round, value]) => ({
            round: Number.parseInt(round, 10),
            value: typeof value === "string" ? value.trim() : "",
        }))
        .filter((entry) => Number.isFinite(entry.round) && entry.value.length > 0)
        .sort((a, b) => b.round - a.round);

    return sortedEntries[0]?.value || null;
};

export const useCloneTenderToRealizationMutation = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async (projectId: string) => {
            if (user?.role === "demo") {
                const demoData = getDemoData();
                const sourceProject = demoData?.projects.find((project) => project.id === projectId);
                const sourceDetails = demoData?.projectDetails?.[projectId];

                if (!demoData || !sourceProject || !sourceDetails) {
                    throw new Error("Zdrojový demo projekt nebyl nalezen.");
                }

                if (sourceProject.status !== "tender") {
                    throw new Error("Klonovat do realizace lze pouze projekt ve stavu soutěž.");
                }

                const clonedProjectId = crypto.randomUUID();
                const clonedCategories = (sourceDetails.categories || []).map((category) => ({
                    ...structuredClone(category),
                    id: crypto.randomUUID(),
                    deadline: undefined,
                    realizationStart: undefined,
                    realizationEnd: undefined,
                }));
                const categoryIdMap = new Map(
                    (sourceDetails.categories || []).map((category, index) => [category.id, clonedCategories[index]?.id]),
                );

                const clonedBids = Object.fromEntries(
                    clonedCategories.map((category) => {
                        const sourceCategoryId = [...categoryIdMap.entries()].find(([, newId]) => newId === category.id)?.[0];
                        const sourceCategoryBids = sourceCategoryId
                            ? (sourceDetails.bids?.[sourceCategoryId] || [])
                            : [];
                        const nextBids = sourceCategoryBids
                            .map((bid) => {
                                const effectivePrice = extractEffectiveBidDisplayPrice(bid);
                                if (!effectivePrice) return null;

                                return {
                                    ...structuredClone(bid),
                                    id: crypto.randomUUID(),
                                    status: "contacted" as const,
                                    price: "?",
                                    priceHistory: { 0: effectivePrice },
                                    selectionRound: 0,
                                    updateDate: undefined,
                                    contracted: false,
                                    notes: undefined,
                                };
                            })
                            .filter(Boolean);

                        return [category.id, nextBids];
                    }).filter(([, bids]) => Array.isArray(bids) && bids.length > 0),
                );

                const clonedProject: Project = {
                    ...structuredClone(sourceProject),
                    id: clonedProjectId,
                    status: "realization",
                };

                const clonedDetails: ProjectDetails = {
                    ...structuredClone(sourceDetails),
                    id: clonedProjectId,
                    title: sourceDetails.title,
                    status: "realization",
                    categories: clonedCategories,
                    bids: clonedBids,
                    docHubRootLink: "",
                    docHubRootId: null,
                    docHubRootName: null,
                    docHubDriveId: null,
                    docHubSiteId: null,
                    docHubRootWebUrl: null,
                    docHubStatus: "disconnected",
                    docHubLastError: null,
                    docHubAutoCreateEnabled: false,
                    docHubAutoCreateLastRunAt: null,
                    docHubAutoCreateLastError: null,
                    docHubSettings: null,
                };

                demoData.projects = [clonedProject, ...demoData.projects];
                demoData.projectDetails[clonedProjectId] = clonedDetails;
                saveDemoData(demoData);

                return { projectId: clonedProjectId };
            }

            return cloneTenderToRealization(projectId);
        },
        onSettled: async (_data, _error) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.list() }),
                queryClient.invalidateQueries({ queryKey: PROJECT_DETAILS_KEYS.all }),
                queryClient.invalidateQueries({ queryKey: OVERVIEW_TENANT_DATA_KEY }),
            ]);
        },
    });
};

export const useArchiveProjectMutation = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async ({ id, newStatus }: { id: string; newStatus: "realization" | "archived" }) => {
            if (user?.role === "demo") {
                const demoData = getDemoData();
                if (demoData) {
                    demoData.projects = demoData.projects.map(p => p.id === id ? { ...p, status: newStatus } : p);
                    if (demoData.projectDetails[id]) demoData.projectDetails[id].status = newStatus;
                    saveDemoData(demoData);
                }
                return;
            }

            const { error } = await dbAdapter.from("projects").update({ status: newStatus }).eq("id", id);
            if (error) throw error;
        },
        onMutate: async ({ id, newStatus }) => {
            await queryClient.cancelQueries({ queryKey: PROJECT_KEYS.list() });
            const previousProjects = queryClient.getQueryData<Project[]>(PROJECT_KEYS.list());
            queryClient.setQueryData<Project[]>(PROJECT_KEYS.list(), (old) =>
                (old || []).map(p => p.id === id ? { ...p, status: newStatus } : p)
            );
            return { previousProjects };
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.list() });
            queryClient.invalidateQueries({ queryKey: OVERVIEW_TENANT_DATA_KEY });
        }
    });
};

export const useUpdateProjectDetailsMutation = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    // Helper logic for field mapping omitted for brevity, will assume partial updates work fine except complex nested ones
    // But useAppData had complex Contract/Financials mapping.
    // I should ideally preserve it.

    return useMutation({
        mutationFn: async ({ id, updates }: { id: string, updates: Partial<ProjectDetails> }) => {
            if (user?.role === "demo") {
                const demoData = getDemoData();
                if (demoData) {
                    demoData.projectDetails[id] = { ...demoData.projectDetails[id], ...updates };
                    saveDemoData(demoData);
                }
                return;
            }

            // Supabase Logic
            // Update main project fields
            const projectUpdates: any = {};
            if (updates.investor !== undefined) projectUpdates.investor = updates.investor;
            if (updates.technicalSupervisor !== undefined) projectUpdates.technical_supervisor = updates.technicalSupervisor;
            if (updates.siteManager !== undefined) projectUpdates.site_manager = updates.siteManager;
            if (updates.constructionManager !== undefined) projectUpdates.construction_manager = updates.constructionManager;
            if (updates.constructionTechnician !== undefined) projectUpdates.construction_technician = updates.constructionTechnician;
            if (updates.location !== undefined) projectUpdates.location = updates.location;
            if (updates.finishDate !== undefined) projectUpdates.finish_date = updates.finishDate;
            if (updates.plannedCost !== undefined) projectUpdates.planned_cost = updates.plannedCost;
            if (updates.documentationLink !== undefined) projectUpdates.documentation_link = updates.documentationLink;
            if (updates.documentLinks !== undefined) projectUpdates.document_links = updates.documentLinks;
            if (updates.inquiryLetterLink !== undefined) projectUpdates.inquiry_letter_link = updates.inquiryLetterLink;
            if (updates.materialInquiryTemplateLink !== undefined) projectUpdates.material_inquiry_template_link = updates.materialInquiryTemplateLink;
            if (updates.losersEmailTemplateLink !== undefined) projectUpdates.losers_email_template_link = updates.losersEmailTemplateLink;
            if (updates.priceListLink !== undefined) projectUpdates.price_list_link = updates.priceListLink;
            if (updates.docHubEnabled !== undefined) projectUpdates.dochub_enabled = updates.docHubEnabled;
            if (updates.docHubRootLink !== undefined) projectUpdates.dochub_root_link = updates.docHubRootLink;
            if (updates.docHubProvider !== undefined) projectUpdates.dochub_provider = updates.docHubProvider;
            if (updates.docHubMode !== undefined) projectUpdates.dochub_mode = updates.docHubMode;
            if (updates.docHubRootId !== undefined) projectUpdates.dochub_root_id = updates.docHubRootId;
            if (updates.docHubRootName !== undefined) projectUpdates.dochub_root_name = updates.docHubRootName;
            if (updates.docHubDriveId !== undefined) projectUpdates.dochub_drive_id = updates.docHubDriveId;
            if (updates.docHubSiteId !== undefined) projectUpdates.dochub_site_id = updates.docHubSiteId;
            if (updates.docHubRootWebUrl !== undefined) projectUpdates.dochub_root_web_url = updates.docHubRootWebUrl;
            if (updates.docHubStatus !== undefined) projectUpdates.dochub_status = updates.docHubStatus;
            if (updates.docHubLastError !== undefined) projectUpdates.dochub_last_error = updates.docHubLastError;
            if (updates.docHubStructureV1 !== undefined) projectUpdates.dochub_structure_v1 = updates.docHubStructureV1;
            if (updates.docHubStructureVersion !== undefined) projectUpdates.dochub_structure_version = updates.docHubStructureVersion;
            if (updates.docHubAutoCreateEnabled !== undefined) projectUpdates.dochub_autocreate_enabled = updates.docHubAutoCreateEnabled;
            if (updates.docHubAutoCreateLastRunAt !== undefined) projectUpdates.dochub_autocreate_last_run_at = updates.docHubAutoCreateLastRunAt;
            if (updates.docHubAutoCreateLastError !== undefined) projectUpdates.dochub_autocreate_last_error = updates.docHubAutoCreateLastError;

            if (Object.keys(projectUpdates).length > 0) {
                const { error } = await dbAdapter.from("projects").update(projectUpdates).eq("id", id);

                if (error) {
                    if (
                        error.code === "PGRST204" &&
                        typeof error.message === "string"
                    ) {
                        const compatibilityFields = ["losers_email_template_link", "material_inquiry_template_link"] as const;
                        const fieldsToStrip = compatibilityFields.filter((field) => error.message.includes(field));

                        if (fieldsToStrip.length > 0) {
                            const rest = { ...projectUpdates };
                            fieldsToStrip.forEach((field) => {
                                delete rest[field];
                            });

                            if (Object.keys(rest).length > 0) {
                                const { error: retryError } = await dbAdapter.from("projects").update(rest).eq("id", id);
                                if (retryError) console.error("Error updating project (retry):", retryError);
                            }
                        } else {
                            console.error("Error updating project:", error);
                            throw error;
                        }
                    } else {
                        console.error("Error updating project:", error);
                        throw error;
                    }
                }
            }

            // Update contract
            if (updates.contract) {
                await dbAdapter.from("project_contracts").upsert({
                    project_id: id,
                    maturity_days: updates.contract.maturity,
                    warranty_months: updates.contract.warranty,
                    retention_terms: updates.contract.retention,
                    site_facilities_percent: updates.contract.siteFacilities,
                    insurance_percent: updates.contract.insurance,
                });
            }

            // Update financials
            if (updates.investorFinancials) {
                await dbAdapter.from("project_investor_financials").upsert({
                    project_id: id,
                    sod_price: updates.investorFinancials.sodPrice,
                });

                if (updates.investorFinancials.amendments) {
                    await dbAdapter.from("project_amendments").delete().eq("project_id", id);
                    if (updates.investorFinancials.amendments.length > 0) {
                        await dbAdapter.from("project_amendments").insert(
                            updates.investorFinancials.amendments.map((a) => ({
                                id: a.id,
                                project_id: id,
                                label: a.label,
                                price: a.price,
                            }))
                        );
                    }
                }
            }
        },
        onMutate: async ({ id, updates }) => {
            await queryClient.cancelQueries({ queryKey: PROJECT_DETAILS_KEYS.detail(id) });
            const previousDetails = queryClient.getQueryData<ProjectDetails>(PROJECT_DETAILS_KEYS.detail(id));
            queryClient.setQueryData<ProjectDetails>(PROJECT_DETAILS_KEYS.detail(id), (old) => old ? { ...old, ...updates } : undefined);
            return { previousDetails };
        },
        onError: (_err, { id }, context) => {
            queryClient.setQueryData(PROJECT_DETAILS_KEYS.detail(id), context?.previousDetails);
        },
        onSettled: (_data, _error, { id }) => {
            queryClient.invalidateQueries({ queryKey: PROJECT_DETAILS_KEYS.detail(id) });
            // Also invalidate list if name/status changed
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.list() });
            queryClient.invalidateQueries({ queryKey: OVERVIEW_TENANT_DATA_KEY });
        }
    });
};

export const useAddCategoryMutation = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async ({ projectId, category }: { projectId: string; category: DemandCategory }) => {
            if (user?.role === "demo") {
                // update demo data
                return;
            }
            const { error } = await dbAdapter.from("demand_categories").insert({
                id: category.id,
                project_id: projectId,
                title: category.title,
                budget_display: category.budget,
                sod_budget: category.sodBudget,
                plan_budget: category.planBudget,
                status: category.status,
                description: category.description,
                deadline: category.deadline || null,
                realization_start: category.realizationStart || null,
                realization_end: category.realizationEnd || null,
                work_items: category.workItems || null,
            });
            if (error) throw error;

            // Sync DocHub
            syncDocHubCategory(projectId, "upsert", category.id, category.title);

            // AUTO-CREATE: local provider (Tender Flow Desktop)
            const projectDetails = queryClient.getQueryData<ProjectDetails>(PROJECT_DETAILS_KEYS.detail(projectId));
            if (
                projectDetails &&
                projectDetails.docHubEnabled &&
                projectDetails.docHubProvider === 'onedrive' &&
                projectDetails.docHubRootLink
            ) {
                const structure = resolveDocHubStructureV1(projectDetails.docHubStructureV1 || undefined);
                const hierarchyTree = buildHierarchyTree(structure.extraHierarchy || []);
                const suppliers: Record<string, Array<{ id: string; name: string }>> = {
                    [category.id]: [],
                };

                ensureStructure({
                    rootPath: projectDetails.docHubRootLink,
                    structure,
                    categories: [{ id: category.id, title: category.title }],
                    suppliers,
                    hierarchy: hierarchyTree,
                }).catch(err => {
                    console.error("Local DocHub auto-create failed:", err);
                });
            }
        },
        onMutate: async ({ projectId, category }) => {
            await queryClient.cancelQueries({ queryKey: PROJECT_DETAILS_KEYS.detail(projectId) });
            const previousDetails = queryClient.getQueryData<ProjectDetails>(PROJECT_DETAILS_KEYS.detail(projectId));
            queryClient.setQueryData<ProjectDetails>(PROJECT_DETAILS_KEYS.detail(projectId), (old) => {
                if (!old) return old;
                return { ...old, categories: [...old.categories, category] };
            });
            return { previousDetails };
        },
        onSettled: (_data, _err, { projectId }) => {
            queryClient.invalidateQueries({ queryKey: PROJECT_DETAILS_KEYS.detail(projectId) });
            queryClient.invalidateQueries({ queryKey: OVERVIEW_TENANT_DATA_KEY });
        }
    });
};


export const useEditCategoryMutation = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async ({ projectId, category }: { projectId: string; category: DemandCategory }) => {
            if (user?.role === "demo") {
                const demoData = getDemoData();
                if (demoData?.projectDetails[projectId]) {
                    const cats = demoData.projectDetails[projectId].categories;
                    const idx = cats.findIndex(c => c.id === category.id);
                    if (idx !== -1) {
                        cats[idx] = { ...cats[idx], ...category };
                        saveDemoData(demoData);
                    }
                }
                return;
            }

            const { error } = await dbAdapter.from("demand_categories").update({
                title: category.title,
                budget_display: category.budget,
                sod_budget: category.sodBudget,
                plan_budget: category.planBudget,
                status: category.status,
                description: category.description,
                deadline: category.deadline || null,
                realization_start: category.realizationStart || null,
                realization_end: category.realizationEnd || null,
                work_items: category.workItems || null,
            }).eq("id", category.id).eq("project_id", projectId);

            if (error) throw error;

            // Sync DocHub
            syncDocHubCategory(projectId, "upsert", category.id, category.title);
        },
        onMutate: async ({ projectId, category }) => {
            await queryClient.cancelQueries({ queryKey: PROJECT_DETAILS_KEYS.detail(projectId) });
            const previousDetails = queryClient.getQueryData<ProjectDetails>(PROJECT_DETAILS_KEYS.detail(projectId));
            queryClient.setQueryData<ProjectDetails>(PROJECT_DETAILS_KEYS.detail(projectId), (old) => {
                if (!old) return old;
                return {
                    ...old,
                    categories: old.categories.map(c => c.id === category.id ? category : c)
                };
            });
            return { previousDetails };
        },
        onSettled: (_data, _err, { projectId }) => {
            queryClient.invalidateQueries({ queryKey: PROJECT_DETAILS_KEYS.detail(projectId) });
            queryClient.invalidateQueries({ queryKey: OVERVIEW_TENANT_DATA_KEY });
        }
    });
};

export const useDeleteCategoryMutation = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async ({ projectId, categoryId }: { projectId: string; categoryId: string }) => {
            if (user?.role === "demo") {
                const demoData = getDemoData();
                if (demoData?.projectDetails[projectId]) {
                    demoData.projectDetails[projectId].categories = demoData.projectDetails[projectId].categories.filter(c => c.id !== categoryId);
                    saveDemoData(demoData);
                }
                return;
            }

            const { error } = await dbAdapter.from("demand_categories").delete().eq("id", categoryId).eq("project_id", projectId);
            if (error) throw error;

            // Sync DocHub (Archive)
            syncDocHubCategory(projectId, "archive", categoryId);

        },
        onMutate: async ({ projectId, categoryId }) => {
            await queryClient.cancelQueries({ queryKey: PROJECT_DETAILS_KEYS.detail(projectId) });
            const previousDetails = queryClient.getQueryData<ProjectDetails>(PROJECT_DETAILS_KEYS.detail(projectId));
            queryClient.setQueryData<ProjectDetails>(PROJECT_DETAILS_KEYS.detail(projectId), (old) => {
                if (!old) return old;
                return {
                    ...old,
                    categories: old.categories.filter(c => c.id !== categoryId)
                };
            });
            return { previousDetails };
        },
        onSettled: (_data, _err, { projectId }) => {
            queryClient.invalidateQueries({ queryKey: PROJECT_DETAILS_KEYS.detail(projectId) });
            queryClient.invalidateQueries({ queryKey: OVERVIEW_TENANT_DATA_KEY });
        }
    });
};
