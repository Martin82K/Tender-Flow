import { Bid, BidStatus, ProjectDetails, DemandCategory, Subcontractor } from '../types';
import { supabase } from '../services/supabase';
import { getDemoData, saveDemoData } from '../services/demoData';
import { useAuth } from '../context/AuthContext';
import { parseFormattedNumber } from '../utils/formatters';

interface UsePipelineActionsProps {
    projectId: string;
    projectDetails: ProjectDetails;
    activeCategory: DemandCategory | null;
    updateBidsInternal: (updater: (prev: Record<string, Bid[]>) => Record<string, Bid[]>) => void;
    bids: Record<string, Bid[]>;
    localContacts: Subcontractor[];
}

export const usePipelineActions = ({
    projectId,
    projectDetails,
    activeCategory,
    updateBidsInternal,
    bids,
    localContacts
}: UsePipelineActionsProps) => {
    const { user } = useAuth();
    const projectData = projectDetails;

    const handleDragStart = (e: React.DragEvent, bidId: string) => {
        e.dataTransfer.setData("bidId", bidId);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDrop = async (e: React.DragEvent, targetStatus: BidStatus) => {
        e.preventDefault();
        const bidId = e.dataTransfer.getData("bidId");

        if (activeCategory && bidId) {
            // Optimistic update
            updateBidsInternal((prev) => {
                const categoryBids = [...(prev[activeCategory.id] || [])];
                const bidIndex = categoryBids.findIndex((b) => b.id === bidId);

                if (bidIndex > -1 && categoryBids[bidIndex].status !== targetStatus) {
                    categoryBids[bidIndex] = {
                        ...categoryBids[bidIndex],
                        status: targetStatus,
                    };
                    return { ...prev, [activeCategory.id]: categoryBids };
                }
                return prev;
            });

            // Persist to Supabase or Demo Storage
            try {
                if (user?.role === 'demo') {
                    const demoData = getDemoData();
                    if (demoData && demoData.projectDetails[projectData.id]) {
                        const projectBids = demoData.projectDetails[projectData.id].bids || {};
                        // Find which category this bid belongs to
                        let categoryId = "";
                        for (const [catId, catBids] of Object.entries(projectBids)) {
                            if ((catBids as Bid[]).some(b => b.id === bidId)) {
                                categoryId = catId;
                                break;
                            }
                        }

                        if (categoryId) {
                            const categoryBids = projectBids[categoryId] || [];
                            const index = categoryBids.findIndex((b: Bid) => b.id === bidId);
                            if (index > -1) {
                                categoryBids[index].status = targetStatus;
                                projectBids[categoryId] = categoryBids;
                                demoData.projectDetails[projectData.id].bids = projectBids;
                                saveDemoData(demoData);
                            }
                        }
                    }
                    return;
                }

                const { error } = await supabase
                    .from("bids")
                    .update({ status: targetStatus })
                    .eq("id", bidId);

                if (error) {
                    console.error("Error updating bid status:", error);
                }
            } catch (err) {
                console.error("Unexpected error updating bid:", err);
            }
        }
    };

    const handleToggleContracted = async (bid: Bid) => {
        if (!activeCategory) return;

        const newContracted = !bid.contracted;

        // Optimistic update
        updateBidsInternal((prev) => {
            const categoryBids = [...(prev[activeCategory.id] || [])];
            const index = categoryBids.findIndex((b) => b.id === bid.id);
            if (index > -1) {
                categoryBids[index] = {
                    ...categoryBids[index],
                    contracted: newContracted
                };
                return { ...prev, [activeCategory.id]: categoryBids };
            }
            return prev;
        });

        // Persist to Supabase or Demo Storage
        try {
            if (user?.role === 'demo') {
                const demoData = getDemoData();
                if (demoData && demoData.projectDetails[projectData.id]) {
                    const projectBids = demoData.projectDetails[projectData.id].bids || {};
                    const categoryBids = projectBids[activeCategory.id] || [];
                    const index = categoryBids.findIndex((b: Bid) => b.id === bid.id);
                    if (index > -1) {
                        categoryBids[index].contracted = newContracted;
                        projectBids[activeCategory.id] = categoryBids;
                        demoData.projectDetails[projectData.id].bids = projectBids;
                        saveDemoData(demoData);
                    }
                }
                return;
            }

            const { error } = await supabase
                .from("bids")
                .update({ contracted: newContracted })
                .eq("id", bid.id);

            if (error) {
                console.error("Error updating bid contracted status:", error);
            }
        } catch (err) {
            console.error("Unexpected error updating bid:", err);
        }
    };

    const handleAddSubcontractors = async (selectedSubcontractorIds: Set<string>, onSuccess: () => void) => {
        if (!activeCategory) return;

        const newBids: Bid[] = [];
        selectedSubcontractorIds.forEach((id) => {
            const contact = localContacts.find((c) => c.id === id);
            if (contact) {
                // Check if already exists
                const existing = (bids[activeCategory.id] || []).find(
                    (b) => b.subcontractorId === contact.id
                );
                if (!existing) {
                    const primaryContact = contact.contacts[0];
                    newBids.push({
                        id: `bid_${Date.now()}_${contact.id}`,
                        subcontractorId: contact.id,
                        companyName: contact.company,
                        contactPerson: primaryContact?.name || "-",
                        email: primaryContact?.email || "-",
                        phone: primaryContact?.phone || "-",
                        price: "?",
                        status: "contacted",
                        tags: [],
                    });
                }
            }
        });

        if (newBids.length > 0) {
            // Optimistic update
            updateBidsInternal((prev) => ({
                ...prev,
                [activeCategory.id]: [...(prev[activeCategory.id] || []), ...newBids],
            }));

            // Persist to Supabase or Demo Storage
            try {
                if (user?.role === 'demo') {
                    const demoData = getDemoData();
                    if (demoData && demoData.projectDetails[projectData.id]) {
                        const projectBids = demoData.projectDetails[projectData.id].bids || {};
                        projectBids[activeCategory.id] = [
                            ...(projectBids[activeCategory.id] || []),
                            ...newBids
                        ];
                        demoData.projectDetails[projectData.id].bids = projectBids;
                        saveDemoData(demoData);
                    }
                    onSuccess();
                    return;
                }

                const bidsToInsert = newBids.map((bid) => ({
                    id: bid.id,
                    demand_category_id: activeCategory.id,
                    subcontractor_id: bid.subcontractorId,
                    company_name: bid.companyName,
                    contact_person: bid.contactPerson,
                    email: bid.email,
                    phone: bid.phone,
                    price: null, // Numeric price, null for new bids
                    price_display: bid.price, // String display like "?" or "1.5M Kč"
                    notes: bid.notes || null,
                    status: bid.status,
                    tags: bid.tags || [],
                }));

                const { data, error } = await supabase.from("bids").insert(bidsToInsert).select();

                if (error) {
                    console.error("🔴 Error inserting bids:", error);
                    alert(`Chyba při ukládání nabídek: ${error.message}`);
                } else {
                    onSuccess();
                }
            } catch (err) {
                console.error("🔴 Unexpected error inserting bids:", err);
                alert(`Neočekávaná chyba: ${err}`);
            }
        } else {
            onSuccess(); // No bids to add, but action is "done"
        }
    };

    const handleSaveBid = async (updatedBid: Bid) => {
        if (!activeCategory) return;

        // Optimistic update
        updateBidsInternal((prev) => {
            const categoryBids = [...(prev[activeCategory.id] || [])];
            const index = categoryBids.findIndex((b) => b.id === updatedBid.id);
            if (index > -1) {
                categoryBids[index] = updatedBid;
                return { ...prev, [activeCategory.id]: categoryBids };
            }
            return prev;
        });

        // Parse numeric price from display string
        const numericPrice = updatedBid.price
            ? parseFormattedNumber(updatedBid.price.replace(/[^\d\s,.-]/g, ''))
            : null;

        // Persist to Supabase or Demo Storage
        try {
            if (user?.role === 'demo') {
                const demoData = getDemoData();
                if (demoData && demoData.projectDetails[projectData.id]) {
                    const projectBids = demoData.projectDetails[projectData.id].bids || {};
                    const categoryBids = projectBids[activeCategory.id] || [];
                    const index = categoryBids.findIndex((b: Bid) => b.id === updatedBid.id);
                    if (index > -1) {
                        categoryBids[index] = updatedBid;
                        projectBids[activeCategory.id] = categoryBids;
                        demoData.projectDetails[projectData.id].bids = projectBids;
                        saveDemoData(demoData);
                    }
                }
                return;
            }

            const { error } = await supabase
                .from('bids')
                .update({
                    contact_person: updatedBid.contactPerson,
                    email: updatedBid.email,
                    phone: updatedBid.phone,
                    price: numericPrice && numericPrice > 0 ? numericPrice : null,
                    price_display: updatedBid.price,
                    price_history: updatedBid.priceHistory || null,
                    notes: updatedBid.notes,
                    status: updatedBid.status,
                    update_date: updatedBid.updateDate || null,
                    selection_round: updatedBid.selectionRound || null
                })
                .eq('id', updatedBid.id);

            if (error) {
                console.error('Error updating bid:', error);
            }
        } catch (err) {
            console.error('Unexpected error updating bid:', err);
        }
    };

    const handleDeleteBid = async (bidId: string) => {
        if (!activeCategory) return;

        // Optimistic update
        updateBidsInternal((prev) => {
            const categoryBids = (prev[activeCategory.id] || []).filter(b => b.id !== bidId);
            return { ...prev, [activeCategory.id]: categoryBids };
        });

        // Delete from Supabase or Demo Storage
        try {
            if (user?.role === 'demo') {
                const demoData = getDemoData();
                if (demoData && demoData.projectDetails[projectData.id]) {
                    const projectBids = demoData.projectDetails[projectData.id].bids || {};
                    projectBids[activeCategory.id] = (projectBids[activeCategory.id] || []).filter((b: Bid) => b.id !== bidId);
                    demoData.projectDetails[projectData.id].bids = projectBids;
                    saveDemoData(demoData);
                }
                return;
            }

            const { error } = await supabase
                .from('bids')
                .delete()
                .eq('id', bidId);

            if (error) {
                console.error('Error deleting bid:', error);
            }
        } catch (err) {
            console.error('Unexpected error deleting bid:', err);
        }
    };

    return {
        handleDragStart,
        handleDrop,
        handleToggleContracted,
        handleAddSubcontractors,
        handleSaveBid,
        handleDeleteBid
    };
};
