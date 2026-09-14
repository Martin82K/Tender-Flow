import React, { useState, useRef } from "react";
import type { Bid, ContactPerson } from "@/types";
import { ThemedNativeSelect } from "@shared/ui/ThemedNativeSelect";
import { isValidEmailAddress, normalizeEmailAddress } from "@features/projects/model/pipelineEmailModel";

interface Props {
  bid: Bid;
  contacts: ContactPerson[];
  disabled: boolean;
  rememberError?: boolean;
  onSelect: (bidId: string, contactId: string) => Promise<void>;
  onSavingChange: (saving: boolean) => void;
  onEdit: (bid: Bid) => void;
}

export const BidRecipientPicker: React.FC<Props> = ({ bid, contacts, disabled, rememberError = false, onSelect, onSavingChange, onEdit }) => {
  const [error, setError] = useState(false);
  const latest = useRef(0);
  const valid = isValidEmailAddress(bid.email || "");
  const selected = contacts.find(contact => contact.name === bid.contactPerson
    && normalizeEmailAddress(contact.email) === normalizeEmailAddress(bid.email || ""));
  const select = async (contactId: string) => {
    const available = contacts.some(contact => contact.id === contactId && isValidEmailAddress(contact.email))
      || (contactId === "saved-recipient" && valid);
    if (disabled || !available) return;
    const request = ++latest.current;
    setError(false);
    onSavingChange(true);
    try {
      await onSelect(bid.id, contactId);
    } catch {
      if (latest.current === request) setError(true);
    } finally {
      if (latest.current === request) onSavingChange(false);
    }
  };
  return (
    <div className="mb-3 flex min-w-0 flex-col gap-1.5 text-xs" onClick={event => event.stopPropagation()}
      onDoubleClick={event => event.stopPropagation()} onDragStart={event => { event.preventDefault(); event.stopPropagation(); }}>
      <span className="font-medium text-slate-500 dark:text-slate-400">Příjemce poptávky</span>
      <ThemedNativeSelect aria-label="Příjemce poptávky" searchable wrapOptions menuMinWidth={420}
        className="w-full text-xs [&>span:first-child]:whitespace-normal [&>span:first-child]:text-clip [&>span:first-child]:[overflow-wrap:anywhere]" disabled={disabled} value={valid ? selected?.id || "saved-recipient" : ""}
        onChange={event => void select(event.target.value)}>
        <option value="" disabled>Vyberte příjemce</option>
        {valid && !selected && <option value="saved-recipient">{bid.contactPerson} · {bid.email} (uložený příjemce)</option>}
        {contacts.map((contact, index) => <option key={contact.id} value={contact.id} disabled={!isValidEmailAddress(contact.email)}>
          {[contact.name || "Obecný kontakt", contact.position, isValidEmailAddress(contact.email) ? contact.email : "Doplňte e-mail v kontaktech", index === 0 ? "Hlavní" : ""].filter(Boolean).join(" · ")}
        </option>)}
      </ThemedNativeSelect>
      {!valid && <span className="text-amber-700 dark:text-amber-400">Před generováním vyberte kontakt s platným e-mailem.</span>}
      <button type="button" disabled={disabled} onClick={() => onEdit(bid)} className="self-start text-slate-500 underline hover:text-primary disabled:opacity-50">Upravit kontakt na kartě</button>
      {(error || rememberError) && <span role="alert" className="text-red-600 dark:text-red-400">Volbu se nepodařilo zapamatovat na kartě. Pro tuto poptávku platí zobrazený příjemce.</span>}
    </div>
  );
};
