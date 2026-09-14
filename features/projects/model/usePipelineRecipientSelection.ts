import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Bid, ProjectDetails, Subcontractor } from "@/types";
import { PROJECT_DETAILS_KEYS } from "@shared/queryKeys/projectDetailKeys";
import { updateBidRecipient } from "@features/projects/api/pipelineApi";
import { projectDemoDataApi } from "@features/projects/api/projectDemoDataApi";
import { recipientPatch } from "./pipelineRecipientModel";

interface Input {
  projectId: string;
  categoryId?: string;
  bids: Record<string, Bid[]>;
  contacts: Subcontractor[];
  userRole?: string;
  updateBidsInternal: (updater: (previous: Record<string, Bid[]>) => Record<string, Bid[]>) => void;
}

export const usePipelineRecipientSelection = ({ projectId, categoryId, bids, contacts, userRole, updateBidsInternal }: Input) => {
  const client = useQueryClient();
  const [saving, setSaving] = useState(false);
  const operation = useRef<object | null>(null);
  useEffect(() => {
    operation.current = null;
    setSaving(false);
    return () => { operation.current = null; };
  }, [projectId, categoryId]);

  const selectRecipient = async (bidId: string, contactId: string) => {
    if (!categoryId || operation.current) throw new Error("Počkejte na dokončení ukládání.");
    const bid = bids[categoryId]?.find(item => item.id === bidId);
    const contact = contacts.find(supplier => supplier.id === bid?.subcontractorId)?.contacts.find(person => person.id === contactId);
    if (!bid || !contact) throw new Error("Kontakt není dostupný pro tohoto dodavatele.");
    let patch = recipientPatch(contact);
    const request = {};
    operation.current = request;
    setSaving(true);
    const merge = (previous: Record<string, Bid[]>): Record<string, Bid[]> => ({
      ...previous,
      [categoryId]: (previous[categoryId] || []).map(item => item.id === bid.id && item.subcontractorId === bid.subcontractorId ? { ...item, ...patch } : item),
    });
    try {
      if (userRole === "demo") {
        const demo = projectDemoDataApi.getDemoData();
        const details = demo?.projectDetails[projectId];
        if (!demo || !details?.bids?.[categoryId]?.some(item => item.id === bid.id)) throw new Error("Karta již není dostupná.");
        projectDemoDataApi.saveDemoData({ ...demo, projectDetails: {
          ...demo.projectDetails, [projectId]: { ...details, bids: merge(details.bids) },
        } });
      } else {
        patch = await updateBidRecipient(categoryId, bid, patch);
        const queryKey = PROJECT_DETAILS_KEYS.detail(projectId);
        await client.cancelQueries({ queryKey, exact: true });
        client.setQueryData<ProjectDetails | null>(queryKey, previous => previous ? { ...previous, bids: merge(previous.bids || {}) } : previous);
      }
      if (operation.current === request) updateBidsInternal(merge);
    } finally {
      if (operation.current === request) {
        operation.current = null;
        setSaving(false);
      }
    }
  };
  return { selectRecipient, saving };
};
