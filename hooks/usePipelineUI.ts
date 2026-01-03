/**
 * usePipelineUI Hook
 * Manages UI state for Pipeline component: modals, view mode, filters.
 * Extracted from Pipeline.tsx for better modularity.
 */

import { useState, useEffect } from 'react';
import { DemandCategory, Bid } from '../types';

type PipelineViewMode = 'grid' | 'table';
type DemandFilter = 'all' | 'open' | 'closed' | 'sod';

const PIPELINE_VIEW_MODE_STORAGE_KEY = 'tender_pipeline_view_mode';

interface UsePipelineUIProps {
    initialOpenCategoryId?: string;
    categories: DemandCategory[];
}

export const usePipelineUI = ({ initialOpenCategoryId, categories }: UsePipelineUIProps) => {
    // Active category (null = Overview mode, non-null = Detail/Kanban mode)
    const [activeCategory, setActiveCategory] = useState<DemandCategory | null>(null);

    // View mode (grid/table) - persisted to localStorage
    const [viewMode, setViewMode] = useState<PipelineViewMode>(() => {
        const stored = localStorage.getItem(PIPELINE_VIEW_MODE_STORAGE_KEY);
        return stored === 'table' || stored === 'grid' ? stored : 'grid';
    });

    // Demand filter for Overview
    const [demandFilter, setDemandFilter] = useState<DemandFilter>('all');

    // Modal states
    const [isSubcontractorModalOpen, setIsSubcontractorModalOpen] = useState(false);
    const [isSubcontractorModalMaximized, setIsSubcontractorModalMaximized] = useState(false);
    const [selectedSubcontractorIds, setSelectedSubcontractorIds] = useState<Set<string>>(new Set());

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<DemandCategory | null>(null);

    const [editingBid, setEditingBid] = useState<Bid | null>(null);

    const [isCreateContactModalOpen, setIsCreateContactModalOpen] = useState(false);
    const [newContactName, setNewContactName] = useState('');

    // Confirmation modal
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    const closeConfirmModal = () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
    };

    // Export menu
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

    // Persist view mode
    useEffect(() => {
        localStorage.setItem(PIPELINE_VIEW_MODE_STORAGE_KEY, viewMode);
    }, [viewMode]);

    // Handle initial category opening
    useEffect(() => {
        if (initialOpenCategoryId) {
            const categoryToOpen = categories.find(c => c.id === initialOpenCategoryId);
            if (categoryToOpen) {
                setActiveCategory(categoryToOpen);
            }
        } else {
            setActiveCategory(null);
        }
    }, [initialOpenCategoryId, categories]);

    return {
        // Navigation
        activeCategory,
        setActiveCategory,

        // View
        viewMode,
        setViewMode,
        demandFilter,
        setDemandFilter,

        // Subcontractor Modal
        isSubcontractorModalOpen,
        setIsSubcontractorModalOpen,
        isSubcontractorModalMaximized,
        setIsSubcontractorModalMaximized,
        selectedSubcontractorIds,
        setSelectedSubcontractorIds,

        // Category Modals
        isAddModalOpen,
        setIsAddModalOpen,
        isEditModalOpen,
        setIsEditModalOpen,
        editingCategory,
        setEditingCategory,

        // Bid Modal
        editingBid,
        setEditingBid,

        // Contact Modal
        isCreateContactModalOpen,
        setIsCreateContactModalOpen,
        newContactName,
        setNewContactName,

        // Confirmation Modal
        confirmModal,
        setConfirmModal,
        closeConfirmModal,

        // Export
        isExportMenuOpen,
        setIsExportMenuOpen,
    };
};
