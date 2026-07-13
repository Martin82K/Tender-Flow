import React from "react";

import type {
  PipelineBulkEmailKind,
  PipelineEmailRecipientSelection,
} from "@/features/projects/model/pipelineEmailModel";
import { Button } from "@/shared/ui/Button";
import { Modal } from "@/shared/ui/Modal";

interface PipelineBulkEmailConfirmationModalProps {
  isOpen: boolean;
  kind: PipelineBulkEmailKind;
  userEmail: string;
  selection: PipelineEmailRecipientSelection;
  isSubmitting: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

const actionLabels: Record<PipelineBulkEmailKind, string> = {
  inquiry: "standardní poptávku",
  materialInquiry: "materiálovou poptávku",
  losers: "poděkování nevybraným",
};

const actionTitles: Record<PipelineBulkEmailKind, string> = {
  inquiry: "Hromadná standardní poptávka",
  materialInquiry: "Hromadná materiálová poptávka",
  losers: "Poděkování nevybraným",
};

const BidNames: React.FC<{ title: string; bids: PipelineEmailRecipientSelection["candidateBids"] }> = ({
  title,
  bids,
}) => {
  if (bids.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
      <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
        {title} ({bids.length})
      </p>
      <ul className="mt-1 space-y-1 text-xs text-amber-700 dark:text-amber-400">
        {bids.map((bid) => (
          <li key={bid.id}>{bid.companyName}</li>
        ))}
      </ul>
    </div>
  );
};

export const PipelineBulkEmailConfirmationModal: React.FC<
  PipelineBulkEmailConfirmationModalProps
> = ({
  isOpen,
  kind,
  userEmail,
  selection,
  isSubmitting,
  onConfirm,
  onCancel,
}) => {
  const duplicateAddressCount =
    selection.recipientBids.length - selection.emails.length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={actionTitles[kind]}
      description="Před vytvořením konceptu zkontrolujte adresáty."
      size="lg"
      persistent={isSubmitting}
      showCloseButton={false}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900/50 dark:bg-blue-950/20">
          <div className="flex gap-2">
            <span
              className="material-symbols-outlined text-[20px] text-blue-600 dark:text-blue-400"
              aria-hidden="true"
            >
              visibility_off
            </span>
            <p className="text-blue-800 dark:text-blue-200">
              Dodavatelé budou vloženi pouze do skryté kopie BCC a navzájem
              neuvidí své adresy.
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="font-semibold text-slate-600 dark:text-slate-300">
            Komu:
          </dt>
          <dd className="break-all text-slate-900 dark:text-white">
            {userEmail}
          </dd>
          <dt className="font-semibold text-slate-600 dark:text-slate-300">
            Skrytá kopie:
          </dt>
          <dd className="text-slate-900 dark:text-white">
            {selection.emails.length} unikátních adres
          </dd>
          <dt className="font-semibold text-slate-600 dark:text-slate-300">
            Akce:
          </dt>
          <dd className="text-slate-900 dark:text-white">
            Vytvořit {actionLabels[kind]}
          </dd>
        </dl>

        <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Příjemci ({selection.recipientBids.length})
          </p>
          <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
            {selection.recipientBids.map((bid) => (
              <li key={bid.id} className="flex justify-between gap-3">
                <span className="truncate">{bid.companyName}</span>
                <span className="truncate text-slate-500 dark:text-slate-400">
                  {bid.email}
                </span>
              </li>
            ))}
          </ul>
          {duplicateAddressCount > 0 ? (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {duplicateAddressCount} duplicitních adres bude odesláno pouze
              jednou.
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <BidNames
            title="Vynecháno – chybí email"
            bids={selection.missingEmailBids}
          />
          <BidNames
            title="Vynecháno – neplatný email"
            bids={selection.invalidEmailBids}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            disabled={isSubmitting}
            onClick={onCancel}
            title="Zavřít dialog bez vytvoření e-mailového konceptu"
          >
            Zrušit
          </Button>
          <Button
            type="button"
            className="flex-1"
            isLoading={isSubmitting}
            disabled={selection.emails.length === 0}
            onClick={() => void onConfirm()}
            title={`Vytvořit koncept se ${selection.emails.length} skrytými příjemci`}
          >
            Vytvořit koncept ({selection.emails.length})
          </Button>
        </div>
      </div>
    </Modal>
  );
};
