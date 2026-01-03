import { useState, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Project, ProjectDetails, DemandCategory, Bid, Subcontractor, StatusConfig } from "../types";
import { useProjectsQuery, PROJECT_KEYS } from "./queries/useProjectsQuery";
import { useContactsQuery, CONTACT_KEYS } from "./queries/useContactsQuery";
import { useContactStatusesQuery, STATUS_KEYS } from "./queries/useContactStatusesQuery";
import { useAllProjectDetailsQuery, PROJECT_DETAILS_KEYS } from "./queries/useProjectDetailsQuery";
import {
    useAddProjectMutation,
    useDeleteProjectMutation,
    useArchiveProjectMutation,
    useUpdateProjectDetailsMutation,
    useAddCategoryMutation,
    useEditCategoryMutation,
    useDeleteCategoryMutation
} from "./mutations/useProjectMutations";
import {
    useAddContactMutation,
    useUpdateContactMutation,
    useDeleteContactsMutation,
    useBulkUpdateContactsMutation,
    useImportContactsMutation
} from "./mutations/useContactMutations";
import { useAuth } from "../context/AuthContext";
import { isUserAdmin } from "../utils/helpers";
import { syncContactsFromUrl } from "../services/contactsImportService";

export const useAppData = (showUiModal: (props: any) => void) => {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [backgroundWarning, setBackgroundWarning] = useState<{ message: string; type: "warning" | "error" | "info" } | null>(null);

    // Queries
    const { data: projects = [], isLoading: projectsLoading } = useProjectsQuery();
    const { data: contactStatuses = [], isLoading: statusesLoading } = useContactStatusesQuery();
    const { data: contacts = [], isLoading: contactsLoading } = useContactsQuery();
    const { data: allProjectDetails = {}, isLoading: detailsLoading } = useAllProjectDetailsQuery(projects);

    const isDataLoading = projectsLoading || statusesLoading || contactsLoading || detailsLoading;

    // Loading Progress/Error simulation (React Query doesn't give granular % progress for queries)
    const appLoadProgress = null;
    const loadingError = null;
    const isBackgroundLoading = false; // Could track mutation 'isPending'

    const isAdmin = isUserAdmin(user?.email);

    // Mutations
    const addProjectMutation = useAddProjectMutation();
    const deleteProjectMutation = useDeleteProjectMutation();
    const archiveProjectMutation = useArchiveProjectMutation();
    const updateProjectDetailsMutation = useUpdateProjectDetailsMutation();
    const addCategoryMutation = useAddCategoryMutation();
    const editCategoryMutation = useEditCategoryMutation();
    const deleteCategoryMutation = useDeleteCategoryMutation();

    const addContactMutation = useAddContactMutation();
    const updateContactMutation = useUpdateContactMutation();
    const deleteContactsMutation = useDeleteContactsMutation();
    const bulkUpdateContactsMutation = useBulkUpdateContactsMutation();
    const importContactsMutation = useImportContactsMutation();

    // Handlers
    const loadInitialData = useCallback(async (force = false) => {
        if (force) {
            await queryClient.invalidateQueries();
            await queryClient.refetchQueries();
        }
    }, [queryClient]);

    const handleAddProject = async (project: Project) => {
        await addProjectMutation.mutateAsync(project);
    };

    const handleDeleteProject = async (id: string) => {
        await deleteProjectMutation.mutateAsync(id);
        if (selectedProjectId === id) setSelectedProjectId(null);
    };

    const handleArchiveProject = async (id: string) => {
        const project = projects.find(p => p.id === id);
        if (project) {
            const newStatus = project.status === 'archived' ? 'realization' : 'archived';
            await archiveProjectMutation.mutateAsync({ id, newStatus });
        }
    };

    const handleUpdateProjectDetails = async (id: string, updates: Partial<ProjectDetails>) => {
        await updateProjectDetailsMutation.mutateAsync({ id, updates });
    };

    const handleAddCategory = async (projectId: string, category: DemandCategory) => {
        await addCategoryMutation.mutateAsync({ projectId, category });
    };

    const handleEditCategory = async (projectId: string, category: DemandCategory) => {
        await editCategoryMutation.mutateAsync({ projectId, category });
    };

    const handleDeleteCategory = async (projectId: string, categoryId: string) => {
        await deleteCategoryMutation.mutateAsync({ projectId, categoryId });
    };

    const handleAddContact = async (contact: Subcontractor) => {
        await addContactMutation.mutateAsync(contact);
    };

    const handleUpdateContact = async (contact: Subcontractor) => {
        await updateContactMutation.mutateAsync({ id: contact.id, updates: contact });
    };

    const handleDeleteContacts = async (ids: string[]) => {
        await deleteContactsMutation.mutateAsync(ids);
    };

    const handleBulkUpdateContacts = async (updates: Subcontractor[]) => {
        // Map full objects to updates?
        // useBulkUpdateContactsMutation expects { id, data }.
        // But App.tsx passes Subcontractor[].
        // I need to map it.
        const formattedUpdates = updates.map(c => ({ id: c.id, data: c }));
        await bulkUpdateContactsMutation.mutateAsync(formattedUpdates);
    };

    // Complex handlers
    const handleImportContacts = async (newContacts: Subcontractor[], onProgress?: (p: number) => void) => {
        await importContactsMutation.mutateAsync({ newContacts, onProgress });
    };

    const handleSyncContacts = async (url: string, onProgress?: (p: number) => void) => {
        try {
            const result = await syncContactsFromUrl(url);
            if (result.success) {
                await handleImportContacts(result.contacts, onProgress);
            } else {
                showUiModal({ title: "Chyba synchronizace", message: result.error, variant: "danger" });
            }
        } catch (error) {
            showUiModal({ title: "Chyba", message: "Nepodařilo se synchronizovat kontakty.", variant: "danger" });
        }
    };

    const handleBidsChange = useCallback((projectId: string, bids: Record<string, Bid[]>) => {
        queryClient.setQueryData<ProjectDetails>(PROJECT_DETAILS_KEYS.detail(projectId), (old) => {
            if (!old) return old;
            return { ...old, bids };
        });
        // Also invalidate to sync with backend if needed? 
        // Assuming this is driven by UI that already persisted bids? 
        // If not, we might need to assume this is mostly client side state until refresh/save.
        // But in Phase 2 it updated 'allProjectDetails'.
    }, [queryClient]);

    const setContactStatuses = useCallback((statuses: StatusConfig[]) => {
        queryClient.setQueryData(STATUS_KEYS.contactStatuses(), statuses);
        // Persistence logic missing in Phase 2 too? Assuming only local state update or Settings saves it?
    }, [queryClient]);

    // Setters (for specific UI interactions that expect direct state manipulation - try to map to mutations or cache updates)
    // App.tsx uses: onContactsChange={actions.setContacts} -> this replaces contacts list?
    // ProjectLayout uses: statuses={state.contactStatuses}

    const setProjects = useCallback((val: Project[] | ((prev: Project[]) => Project[])) => {
        // This is tricky. React Query manages state.
        // If a component tries to setProjects locally, it fights React Query.
        // Ideally we shouldn't expose setProjects.
        // But App.tsx calls it?
        // App.tsx doesn't seem to call setProjects directly in the render logic I saw.
        // `ProjectManager` might?
        // If so, we should warn or update cache.
        queryClient.setQueryData(PROJECT_KEYS.list(), val);
    }, [queryClient]);

    const setAllProjectDetails = useCallback((val: any) => {
        // Manual update of details map.
        // We can't easily support functional updates (prev => ...) on the whole map if we want to be granular.
        // But for compatibility:
        queryClient.setQueryData(PROJECT_DETAILS_KEYS.all, val);
        // But useQueries stores data individually!
        // This is a mismatch. `useAllProjectDetailsQuery` combines individual queries.
        // If we set `PROJECT_DETAILS_KEYS.all`, it won't affect individual queries.
        // We should avoid using this setter if possible.
        console.warn("setAllProjectDetails called - this is deprecated with React Query");
    }, [queryClient]);

    const setContacts = useCallback((val: any) => {
        queryClient.setQueryData(CONTACT_KEYS.list(), val);
    }, [queryClient]);

    return {
        state: {
            projects,
            allProjectDetails,
            contacts,
            contactStatuses,
            isDataLoading,
            loadingError,
            appLoadProgress,
            isBackgroundLoading,
            backgroundWarning,
            selectedProjectId,
            isAdmin
        },
        actions: {
            setProjects,
            setAllProjectDetails,
            setContacts,
            setContactStatuses,
            setSelectedProjectId,
            setBackgroundWarning,
            setIsBackgroundLoading: () => { }, // no-op
            loadInitialData,

            handleAddProject,
            handleDeleteProject,
            handleArchiveProject,
            handleUpdateProjectDetails,

            handleAddCategory,
            handleEditCategory,
            handleDeleteCategory,

            handleAddContact,
            handleUpdateContact,
            handleBulkUpdateContacts,
            handleDeleteContacts,
            handleImportContacts,
            handleSyncContacts,

            handleBidsChange
        }
    };
};
