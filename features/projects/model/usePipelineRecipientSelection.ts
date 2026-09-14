import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { Bid, ProjectDetails, Subcontractor } from "@/types";
import { PROJECT_DETAILS_KEYS } from "@shared/queryKeys/projectDetailKeys";
import { updateBidRecipient } from "@features/projects/api/pipelineApi";
import { projectDemoDataApi } from "@features/projects/api/projectDemoDataApi";
import { recipientPatch, type BidRecipient } from "./pipelineRecipientModel";

interface Input {
  projectId: string;
  categoryId?: string;
  userId?: string;
  organizationId?: string;
  bids: Record<string, Bid[]>;
  contacts: Subcontractor[];
  userRole?: string;
}
interface Choice { supplierId: string; recipient: BidRecipient; revision: number; saving: boolean; error: boolean }
interface Session { choices: Record<string, Choice>; generating: string[] }
const queues = new WeakMap<QueryClient, Map<string, Promise<void>>>();
let revision = 0;
const enqueue = (client: QueryClient, key: string, action: () => Promise<void>) => {
  let queue = queues.get(client);
  if (!queue) { queue = new Map(); queues.set(client, queue); }
  const previous = queue.get(key) || Promise.resolve();
  const pending = previous.catch(() => {}).then(action);
  queue.set(key, pending);
  const clear = () => { if (queue.get(key) === pending) queue.delete(key); };
  void pending.then(clear, clear);
  return pending;
};

// Session choices and per-card generation survive navigation, but not a page
// reload. Only persistence is queued; neither selection nor generation waits.
export const usePipelineRecipientSelection = ({ projectId, categoryId, userId, organizationId, bids, contacts, userRole }: Input) => {
  const client = useQueryClient();
  const queryKey = ["pipelineInquirySession", userId || "", organizationId || "", projectId];
  const { data: session } = useQuery<Session>({ queryKey, queryFn: async () => ({ choices: {}, generating: [] }),
    initialData: () => ({ choices: {}, generating: [] }), enabled: false, staleTime: Infinity, gcTime: Infinity });
  const read = () => client.getQueryData<Session>(queryKey) || { choices: {}, generating: [] };
  const update = (fn: (session: Session) => Session) => client.setQueryData<Session>(queryKey, previous => fn(previous || { choices: {}, generating: [] }));
  const keyFor = (category: string, id: string) => JSON.stringify([category, id]);
  const queueKey = (id: string) => JSON.stringify([...queryKey, categoryId, id]);
  const inquiryBids = Object.fromEntries(Object.entries(bids).map(([category, items]) => [category, items.map(bid => {
    const choice = session.choices[keyFor(category, bid.id)];
    return choice?.supplierId === bid.subcontractorId ? { ...bid, ...choice.recipient } : bid;
  })]));
  const beginChoice = (bid: Bid, recipient: BidRecipient) => {
    const key = keyFor(categoryId!, bid.id);
    const choice: Choice = { supplierId: bid.subcontractorId, recipient, revision: ++revision, saving: true, error: false };
    update(previous => ({ ...previous, choices: { ...previous.choices, [key]: choice } }));
    return { key, choice };
  };
  const finishChoice = (key: string, choice: Choice, error: boolean) => update(previous => {
    if (previous.choices[key]?.revision !== choice.revision) return previous;
    return { ...previous, choices: { ...previous.choices, [key]: { ...choice, saving: false, error } } };
  });
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
    const { key, choice } = beginChoice(bid, recipient);
    const merge = (previous: Record<string, Bid[]>): Record<string, Bid[]> => ({ ...previous,
      [categoryId]: (previous[categoryId] || []).map(item => item.id === bid.id && item.subcontractorId === bid.subcontractorId ? { ...item, ...recipient } : item),
    });
    try {
      await enqueue(client, queueKey(bid.id), async () => {
        if (read().choices[key]?.revision !== choice.revision) return;
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
          if (read().choices[key]?.revision !== choice.revision) return;
          client.setQueryData<ProjectDetails | null>(PROJECT_DETAILS_KEYS.detail(projectId), previous => previous ? { ...previous, bids: merge(previous.bids || {}) } : previous);
        }
        // The query cache updates mounted project views. Do not call an old
        // view's setter after navigation; the explicit session choice is live.
      });
      finishChoice(key, choice, false);
    } catch (error) { finishChoice(key, choice, true); throw error; }
  };
  const saveEditedBid = async (bid: Bid, original: Bid, save: (includeRecipient: boolean) => Promise<void>) => {
    if (!categoryId || !bids[categoryId]?.some(item => item.id === bid.id && item.subcontractorId === bid.subcontractorId)) return;
    const changed = bid.contactPerson !== original.contactPerson || bid.email !== original.email || bid.phone !== original.phone;
    const selected = changed ? beginChoice(bid, { contactPerson: bid.contactPerson, email: bid.email, phone: bid.phone }) : undefined;
    try {
      await enqueue(client, queueKey(bid.id), () => save(changed));
      if (selected) finishChoice(selected.key, selected.choice, false);
    } catch (error) { if (selected) finishChoice(selected.key, selected.choice, true); throw error; }
  };
  const generateInquiry = async (bid: Bid, generate: (snapshot: Bid) => Promise<void>) => {
    if (!categoryId) return;
    const key = keyFor(categoryId, bid.id);
    if (read().generating.includes(key)) return;
    update(previous => ({ ...previous, generating: [...previous.generating, key] }));
    const choice = read().choices[key];
    const snapshot = choice?.supplierId === bid.subcontractorId ? { ...bid, ...choice.recipient } : { ...bid };
    try { await generate(snapshot); }
    finally { update(previous => ({ ...previous, generating: previous.generating.filter(item => item !== key) })); }
  };
  const stateFor = (bidId: string) => session.choices[keyFor(categoryId || "", bidId)];
  const isGenerating = (bidId: string) => session.generating.includes(keyFor(categoryId || "", bidId));
  return { selectRecipient, inquiryBids, saveEditedBid, generateInquiry, stateFor, isGenerating };
};
