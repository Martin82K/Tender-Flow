import { useEffect, useRef, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Bid, ProjectDetails, Subcontractor } from "@/types";
import { PROJECT_DETAILS_KEYS } from "@shared/queryKeys/projectDetailKeys";
import { updateBidRecipient } from "@features/projects/api/pipelineApi";
import { projectDemoDataApi } from "@features/projects/api/projectDemoDataApi";
import { RecipientSaveError, recipientPatch, type BidRecipient } from "./pipelineRecipientModel";

// Locks outlive a view unmount. Leaving and returning must not start a second
// write while the first request can still commit. No contact data is stored here.
const operations = new Map<string, "saving" | "generating">();
const unconfirmedRecipients = new Map<string, Set<string>>();
const listeners = new Set<() => void>();
const publish = () => listeners.forEach(listener => listener());
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

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
  const scope = JSON.stringify([projectId, categoryId]);
  const operation = useSyncExternalStore(subscribe, () => operations.get(scope));
  const hasUnconfirmedRecipient = () => (bids[categoryId || ""] || []).some(bid => unconfirmedRecipients.get(scope)?.has(bid.id));
  const unconfirmed = useSyncExternalStore(subscribe, hasUnconfirmedRecipient);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const generateWithRecipientLock = async (generate: () => Promise<void>) => {
    if (operations.has(scope) || hasUnconfirmedRecipient()) return;
    operations.set(scope, "generating");
    publish();
    try { await generate(); }
    finally { operations.delete(scope); publish(); }
  };

  const saveWithRecipientLock = async (save: () => Promise<void>) => {
    if (operations.has(scope)) return;
    operations.set(scope, "saving");
    publish();
    try { await save(); }
    finally { operations.delete(scope); publish(); }
  };

  const selectRecipient = async (bidId: string, contactId: string) => {
    if (!categoryId || operations.has(scope)) throw new Error("Počkejte na dokončení ukládání nebo generování.");
    const bid = bids[categoryId]?.find(item => item.id === bidId);
    const contact = contacts.find(supplier => supplier.id === bid?.subcontractorId)?.contacts.find(person => person.id === contactId)
      ?? (contactId === "saved-recipient" && bid ? {
        id: "saved-recipient", name: bid.contactPerson, email: bid.email || "", phone: bid.phone || "",
      } : undefined);
    if (!bid || !contact) throw new Error("Kontakt není dostupný pro tohoto dodavatele.");
    const recipient = recipientPatch(contact);
    operations.set(scope, "saving");
    publish();
    const merge = (previous: Record<string, Bid[]>, patch: BidRecipient): Record<string, Bid[]> => ({
      ...previous,
      [categoryId]: (previous[categoryId] || []).map(item => item.id === bid.id && item.subcontractorId === bid.subcontractorId ? { ...item, ...patch } : item),
    });
    const applyConfirmed = async (patch: BidRecipient) => {
      const queryKey = PROJECT_DETAILS_KEYS.detail(projectId);
      client.setQueryData<ProjectDetails | null>(queryKey, previous => previous ? { ...previous, bids: merge(previous.bids || {}, patch) } : previous);
      if (mounted.current && currentScope.current === scope) updateBidsInternal(previous => merge(previous, patch));
    };
    try {
      if (userRole === "demo") {
        const demo = projectDemoDataApi.getDemoData();
        const details = demo?.projectDetails[projectId];
        if (!demo || !details?.bids?.[categoryId]?.some(item => item.id === bid.id)) throw new Error("Karta již není dostupná.");
        projectDemoDataApi.saveDemoData({ ...demo, projectDetails: {
          ...demo.projectDetails, [projectId]: { ...details, bids: merge(details.bids, recipient) },
        } });
        if (mounted.current && currentScope.current === scope) updateBidsInternal(previous => merge(previous, recipient));
      } else {
        // Cancel pre-write snapshots, not newer refetches started by the save event.
        await client.cancelQueries({ queryKey: PROJECT_DETAILS_KEYS.detail(projectId), exact: true });
        await applyConfirmed(await updateBidRecipient(categoryId, bid, recipient));
      }
      unconfirmedRecipients.get(scope)?.delete(bidId);
      if (!unconfirmedRecipients.get(scope)?.size) unconfirmedRecipients.delete(scope);
    } catch (cause) {
      if (cause instanceof RecipientSaveError && cause.uncertain) {
        const uncertainBids = unconfirmedRecipients.get(scope) || new Set<string>();
        uncertainBids.add(bidId);
        unconfirmedRecipients.set(scope, uncertainBids);
        if (cause.recipient) await applyConfirmed(cause.recipient);
      }
      throw cause;
    } finally {
      operations.delete(scope);
      publish();
    }
  };
  return { selectRecipient, saving: operation === "saving", generating: operation === "generating", unconfirmed, unconfirmedBidIds: unconfirmedRecipients.get(scope), generateWithRecipientLock, saveWithRecipientLock };
};
