import React, { useState } from "react";
import type { ProjectClientCard as ProjectClientCardData } from "@/types";
import { ConfirmationModal } from "@/shared/ui/ConfirmationModal";
import {
  clientNamesMatch,
  draftFromClientCard,
  emptyClientCardDraft,
  resolveClientCardDraft,
  type ProjectClientCardDraft,
} from "@features/projects/client/clientCardModel";
import {
  useProjectClientCard,
  useRemoveProjectClientCard,
  useSaveProjectClientCard,
} from "@features/projects/client/useProjectClientCard";
import { ProjectClientCardFields } from "./ProjectClientCardFields";

const labelClass = "mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500";
const valueClass = "min-h-7 py-1 text-xs font-medium text-slate-800 dark:text-slate-200";
const actionClass =
  "rounded-lg px-3 py-1.5 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

interface Props {
  projectId: string;
  projectTitle: string;
  projectCode: string;
  organizationId?: string;
  readOnly: boolean;
  financialCustomerName?: string;
  onCopyCustomerName?: (companyName: string) => Promise<void> | void;
}

const display = (value?: string) => value?.trim() || "—";

const ReadItem = ({ label, value, title }: { label: string; value?: string; title?: string }) => (
  <div className="min-w-0">
    <div className={labelClass}>{label}</div>
    <div className={`${valueClass} break-words`} title={title}>{display(value)}</div>
  </div>
);

export const ProjectClientCard: React.FC<Props> = ({
  projectId,
  projectTitle,
  projectCode,
  organizationId,
  readOnly,
  financialCustomerName,
  onCopyCustomerName,
}) => {
  const query = useProjectClientCard(projectId);
  const saveCard = useSaveProjectClientCard(projectId, organizationId);
  const removeCard = useRemoveProjectClientCard(projectId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProjectClientCardDraft>(emptyClientCardDraft);
  const [errors, setErrors] = useState<Partial<Record<keyof ProjectClientCardDraft, string>>>({});
  const [formError, setFormError] = useState("");
  const [confirmCopy, setConfirmCopy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [copying, setCopying] = useState(false);

  const card = query.data ?? null;
  const beginEdit = (source: ProjectClientCardData | null) => {
    setDraft(source ? draftFromClientCard(source) : emptyClientCardDraft());
    setErrors({});
    setFormError("");
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setErrors({});
    setFormError("");
  };

  const save = async () => {
    const resolved = resolveClientCardDraft(draft);
    if (!resolved.card) {
      setErrors(resolved.errors.companyName || Object.keys(resolved.errors).length > 0
        ? resolved.errors
        : { companyName: "Doplňte firmu nebo jméno objednatele." });
      return;
    }
    setErrors({});
    setFormError("");
    try {
      await saveCard.mutateAsync(resolved.card);
      setEditing(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Kartu objednatele se nepodařilo uložit.");
    }
  };

  const remove = async () => {
    setFormError("");
    try {
      await removeCard.mutateAsync();
      setConfirmRemove(false);
      setEditing(false);
    } catch (error) {
      setConfirmRemove(false);
      setFormError(error instanceof Error ? error.message : "Kartu objednatele se nepodařilo smazat.");
    }
  };

  const copyName = async () => {
    if (!card || !onCopyCustomerName) return;
    setCopying(true);
    setFormError("");
    try {
      await onCopyCustomerName(card.companyName);
      setConfirmCopy(false);
    } catch (error) {
      setConfirmCopy(false);
      setFormError(error instanceof Error ? error.message : "Jméno se nepodařilo převzít do smlouvy.");
    } finally {
      setCopying(false);
    }
  };

  const canCopy = Boolean(
    card && onCopyCustomerName && !readOnly && !clientNamesMatch(card.companyName, financialCustomerName),
  );

  return (
    <section
      data-help-id="documents-client-card"
      aria-labelledby="project-client-card-title"
      className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="project-client-card-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">Objednatel</h2>
          <p className="text-xs text-slate-500">Identita objednatele této stavby. Finance zůstávají ve Smlouvách.</p>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap justify-end gap-2">
            {editing ? (
              <>
                <button type="button" className={`${actionClass} text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800`} onClick={cancelEdit}>Zrušit</button>
                {card ? (
                  <button type="button" className={`${actionClass} text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10`} onClick={() => setConfirmRemove(true)}>Vymazat</button>
                ) : null}
                <button type="button" className={`${actionClass} bg-primary text-white hover:bg-primary-dark disabled:opacity-50`} disabled={saveCard.isPending} onClick={() => { void save(); }}>
                  {saveCard.isPending ? "Ukládám…" : "Uložit"}
                </button>
              </>
            ) : card ? (
              <button type="button" className={`${actionClass} border border-primary/40 text-primary hover:bg-primary/10`} onClick={() => beginEdit(card)}>Upravit</button>
            ) : null}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/40 md:grid-cols-2">
        <ReadItem label="Název stavby" value={projectTitle} />
        <ReadItem label="Kód stavby" value={projectCode} title={projectCode} />
      </div>

      {query.isPending ? <p role="status" className="mt-4 text-sm text-slate-500">Načítám kartu objednatele…</p> : null}
      {query.isError ? (
        <div role="alert" className="mt-4 space-y-2">
          <p className="text-sm text-red-600">Kartu objednatele se nepodařilo načíst.</p>
          <button type="button" className={`${actionClass} border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200`} onClick={() => { void query.refetch(); }}>Zkusit znovu</button>
        </div>
      ) : null}

      {!query.isPending && !query.isError && !card && !editing ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
          <p className="text-sm text-slate-600 dark:text-slate-300">Objednatel není vyplněn</p>
          {!readOnly ? (
            <button type="button" className={`${actionClass} mt-3 bg-primary text-white hover:bg-primary-dark`} onClick={() => beginEdit(null)}>Doplnit</button>
          ) : null}
        </div>
      ) : null}

      {editing ? (
        <div className="mt-4">
          <ProjectClientCardFields idPrefix="client-card" draft={draft} errors={errors} onChange={setDraft} />
        </div>
      ) : card ? (
        <div
          className={`mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 ${readOnly ? "" : "cursor-text rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"}`}
          role={readOnly ? undefined : "button"}
          tabIndex={readOnly ? undefined : 0}
          aria-label={readOnly ? undefined : "Upravit kartu objednatele"}
          onDoubleClick={readOnly ? undefined : () => beginEdit(card)}
          onKeyDown={readOnly ? undefined : (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            beginEdit(card);
          }}
        >
          <ReadItem label="Firma nebo jméno" value={card.companyName} />
          <ReadItem label="IČO" value={card.ico} />
          <div className="md:col-span-2"><ReadItem label="Ulice" value={card.street} /></div>
          <ReadItem label="PSČ" value={card.zip} />
          <ReadItem label="Město" value={card.city} />
          <ReadItem label="Kontaktní osoba" value={card.contactName} />
          <ReadItem label="E-mail" value={card.contactEmail} />
          <ReadItem label="Telefon" value={card.contactPhone} />
          <div className="md:col-span-2"><ReadItem label="Interní poznámka" value={card.internalNote} /></div>
        </div>
      ) : null}

      {canCopy && !editing ? (
        <div className="mt-4">
          <button type="button" className={`${actionClass} border border-primary/40 text-primary hover:bg-primary/10`} onClick={() => setConfirmCopy(true)}>
            Převzít jméno do smlouvy
          </button>
        </div>
      ) : null}

      {formError ? <p role="alert" className="mt-3 text-xs text-red-600 dark:text-red-400">{formError}</p> : null}

      <ConfirmationModal
        isOpen={confirmCopy}
        title="Převzít jméno do smlouvy?"
        message={`Do smlouvy s objednatelem se zapíše „${card?.companyName ?? ""}“. Dosavadní jméno ve finanční evidenci se přepíše. Ostatní údaje smlouvy zůstanou.`}
        confirmLabel={copying ? "Přebírám…" : "Převzít jméno"}
        cancelLabel="Zrušit"
        variant="info"
        onConfirm={() => { void copyName(); }}
        onCancel={() => setConfirmCopy(false)}
      />
      <ConfirmationModal
        isOpen={confirmRemove}
        title="Vymazat kartu objednatele?"
        message="Identita objednatele se ze stavby odstraní. Finanční evidence ve Smlouvách se nezmění."
        confirmLabel="Vymazat"
        cancelLabel="Zrušit"
        variant="danger"
        onConfirm={() => { void remove(); }}
        onCancel={() => setConfirmRemove(false)}
      />
    </section>
  );
};
