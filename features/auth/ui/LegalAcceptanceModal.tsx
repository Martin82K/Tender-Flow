import React, { useId, useState } from "react";
import { Modal } from "@/shared/ui/Modal";
import { getCurrentLegalAcceptanceInput } from "@/shared/legal/legalDocumentVersions";

interface LegalAcceptanceModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  onAccept: (input: { termsVersion: string; privacyVersion: string }) => Promise<void>;
}

export const LegalAcceptanceModal: React.FC<LegalAcceptanceModalProps> = ({
  isOpen,
  isSubmitting,
  onAccept,
}) => {
  const [termsChecked, setTermsChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [error, setError] = useState("");
  const termsId = useId();
  const privacyId = useId();

  const handleAccept = async () => {
    if (!termsChecked || !privacyChecked) {
      setError("Pro pokračování musíš potvrdit podmínky používání i zásady ochrany osobních údajů.");
      return;
    }

    setError("");
    await onAccept(getCurrentLegalAcceptanceInput());
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => undefined}
      title="Potvrzení podmínek a ochrany osobních údajů"
      description="Před pokračováním v aplikaci potřebujeme potvrdit aktuální podmínky používání a zásady ochrany osobních údajů."
      persistent
      showCloseButton={false}
      footer={(
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Bez potvrzení nebude účet dále zpřístupněn.
          </p>
          <button
            type="button"
            onClick={() => void handleAccept()}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Ukládám..." : "Potvrdit a pokračovat"}
          </button>
        </div>
      )}
    >
      <div className="space-y-4 text-sm text-slate-700 dark:text-slate-200">
        <p>
          Otevři si dokumenty a potvrď, že jsi se s nimi seznámil:
        </p>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
          <ul className="space-y-2">
            <li>
              <a
                href="/terms"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-orange-600 underline underline-offset-2 dark:text-orange-400"
              >
                Podmínky používání
              </a>
            </li>
            <li>
              <a
                href="/privacy"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-orange-600 underline underline-offset-2 dark:text-orange-400"
              >
                Zásady ochrany osobních údajů
              </a>
            </li>
          </ul>
        </div>

        <label htmlFor={termsId} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <input
            id={termsId}
            type="checkbox"
            checked={termsChecked}
            onChange={(e) => setTermsChecked(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
          />
          <span>Potvrzuji, že jsem si přečetl(a) a přijímám podmínky používání aplikace.</span>
        </label>

        <label htmlFor={privacyId} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <input
            id={privacyId}
            type="checkbox"
            checked={privacyChecked}
            onChange={(e) => setPrivacyChecked(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
          />
          <span>Potvrzuji, že jsem byl(a) informován(a) o zpracování osobních údajů podle GDPR a zásad ochrany osobních údajů.</span>
        </label>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        ) : null}
      </div>
    </Modal>
  );
};
