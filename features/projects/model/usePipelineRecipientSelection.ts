import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Bid, ProjectDetails, Subcontractor } from "@/types";
import { PROJECT_DETAILS_KEYS } from "@shared/queryKeys/projectDetailKeys";
import { updateBidRecipient } from "@features/projects/api/pipelineApi";
import { projectDemoDataApi } from "@features/projects/api/projectDemoDataApi";
import { recipientPatch, type BidRecipient } from "./pipelineRecipientModel";

interface Input {
  projectId: string;
  categoryId?: string;
  bids: Record<string, Bid[]>;
  contacts: Subcontractor[];
  userRole?: string;
  updateBidsInternal: (updater: (previous: Record<string, Bid[]>) => Record<string, Bid[]>) => void;
}

// A deliberate choice for the next draft is independent of remembering it on
// the card. Failed/slow persistence must not change the chosen draft recipient.
export const usePipelineRecipientSelection = ({ projectId, categoryId, bids, contacts, userRole, updateBidsInternal }: Input) => {
  const client = useQueryClient();
  const [choices, setChoices] = useState<Record<string, { supplierId: string; recipient: BidRecipient }>>({});
  const requests = useRef(new Map<string, symbol>());
  const scope = JSON.stringify([projectId, categoryId]);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const keyFor = (category: string, id: string) => JSON.stringify([projectId, category, id]);
  const inquiryBids = Object.fromEntries(Object.entries(bids).map(([category, items]) => [category, items.map(bid => {
    const choice = choices[keyFor(category, bid.id)];
    return choice?.supplierId === bid.subcontractorId ? { ...bid, ...choice.recipient } : bid;
  })]));

  const selectRecipient = async (bidId: string, contactId: string) => {
    if (!categoryId) throw new Error("Výběrové řízení není dostupné.");
    const bid = bids[categoryId]?.find(item => item.id === bidId);
    const displayedBid = inquiryBids[categoryId]?.find(item => item.id === bidId);
    const contact = contacts.find(supplier => supplier.id === bid?.subcontractorId)?.contacts.find(person => person.id === contactId)
      ?? (contactId === "saved-recipient" && displayedBid ? {
        id: "saved-recipient", name: displayedBid.contactPerson, email: displayedBid.email || "", phone: displayedBid.phone || "",
      } : undefined);
    if (!bid || !contact) throw new Error("Kontakt není dostupný pro tohoto dodavatele.");
    const recipient = recipientPatch(contact);
    const key = keyFor(categoryId, bidId);
    const request = Symbol();
    requests.current.set(key, request);
    setChoices(previous => ({ ...previous, [key]: { supplierId: bid.subcontractorId, recipient } }));
    const merge = (previous: Record<string, Bid[]>): Record<string, Bid[]> => ({
      ...previous,
      [categoryId]: (previous[categoryId] || []).map(item => item.id === bid.id && item.subcontractorId === bid.subcontractorId ? { ...item, ...recipient } : item),
    });
    if (userRole === "demo") {
      const demo = projectDemoDataApi.getDemoData();
      const details = demo?.projectDetails[projectId];
      if (!demo || !details?.bids?.[categoryId]?.some(item => item.id === bid.id)) throw new Error("Karta již není dostupná.");
      projectDemoDataApi.saveDemoData({ ...demo, projectDetails: {
        ...demo.projectDetails, [projectId]: { ...details, bids: merge(details.bids) },
      } });
    } else {
      await client.cancelQueries({ queryKey: PROJECT_DETAILS_KEYS.detail(projectId), exact: true });
      await updateBidRecipient(categoryId, bid, recipient);
      if (requests.current.get(key) !== request) return;
      client.setQueryData<ProjectDetails | null>(PROJECT_DETAILS_KEYS.detail(projectId), previous => previous ? { ...previous, bids: merge(previous.bids || {}) } : previous);
    }
    if (mounted.current && currentScope.current === scope && requests.current.get(key) === request) updateBidsInternal(merge);
  };
  const selectEditedRecipient = (bid: Bid) => {
    if (!categoryId || !bids[categoryId]?.some(item => item.id === bid.id && item.subcontractorId === bid.subcontractorId)) return;
    const key = keyFor(categoryId, bid.id);
    requests.current.set(key, Symbol());
    setChoices(previous => ({ ...previous, [key]: { supplierId: bid.subcontractorId,
      recipient: { contactPerson: bid.contactPerson, email: bid.email, phone: bid.phone },
    } }));
  };
  return { selectRecipient, inquiryBids, selectEditedRecipient };
};
