import React, { useState, useRef } from "react";
import type { Bid, ContactPerson } from "@/types";
import { ThemedSelect } from "@shared/ui/ThemedSelect";
import { isValidEmailAddress, normalizeEmailAddress } from "@features/projects/model/pipelineEmailModel";

interface Props {
  bid: Bid;
  contacts: ContactPerson[];
  disabled: boolean;
  rememberError?: boolean;
  onSelect: (bidId: string, contactId: string) => Promise<void>;
  onSavingChange: (saving: boolean) => void;
}

export const BidRecipientPicker: React.FC<Props> = ({ bid, contacts, disabled, rememberError = false, onSelect, onSavingChange }) => {
  const [error, setError] = useState(false);
  const latest = useRef(0);
  const valid = isValidEmailAddress(bid.email || "");
  const detail = (value?: string) => value?.trim() === "-" ? "" : value?.trim() || "";
  const selected = contacts.find(contact => contact.name === bid.contactPerson
    && normalizeEmailAddress(contact.email) === normalizeEmailAddress(bid.email || "")
    && detail(contact.phone) === detail(bid.phone));
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
  const saved = { name: bid.contactPerson, email: bid.email || "", phone: bid.phone || "" };
  const recipients = [
    ...(!selected && valid ? [{ ...saved, id: "saved-recipient" }] : []),
    ...contacts,
  ];
  const options = recipients.map(contact => ({
    value: contact.id,
    label: [detail(contact.name), detail(contact.email), detail(contact.phone)].filter(Boolean).join(" "),
    disabled: !isValidEmailAddress(contact.email),
  }));
  const renderDetails = (contact: Pick<ContactPerson, "name" | "email" | "phone">) => (
    <span className="flex min-w-0 flex-col gap-1 whitespace-normal text-[13px] leading-relaxed [overflow-wrap:anywhere]">
      {detail(contact.name) && <span className="font-medium">{detail(contact.name)}</span>}
      <span>{isValidEmailAddress(contact.email) ? contact.email : "Doplňte e-mail v kontaktech"}</span>
      {detail(contact.phone) && <span>{detail(contact.phone)}</span>}
    </span>
  );
  const onlyAvailable = !valid && recipients.length === 1 && isValidEmailAddress(recipients[0].email) ? recipients[0] : undefined;
  const stopCardGestures = {
    onClick: (event: React.MouseEvent) => event.stopPropagation(),
    onDoubleClick: (event: React.MouseEvent) => event.stopPropagation(),
    onDragStart: (event: React.DragEvent) => { event.preventDefault(); event.stopPropagation(); },
  };
  return (
    <div className="mb-3 flex min-w-0 flex-col gap-2 border-t border-slate-200 pt-3 text-xs dark:border-slate-700/50">
      <span className="font-medium text-slate-500 dark:text-slate-400">Příjemce poptávky</span>
      {recipients.length > 1 ? (
        <div {...stopCardGestures}>
          <ThemedSelect ariaLabel="Příjemce poptávky" searchable={recipients.length > 6} wrapOptions
            className="tf-bid-recipient-select min-w-0 w-full" triggerClassName="!px-0 !py-1 [&>span:first-child]:whitespace-normal [&>span:first-child]:text-clip"
            disabled={disabled} value={valid ? selected?.id || "saved-recipient" : ""}
            options={valid ? options : [{ value: "", label: "Vyberte příjemce", disabled: true }, ...options]}
            renderOption={option => {
              const contact = recipients.find(recipient => recipient.id === option.value);
              return contact ? renderDetails(contact) : option.label;
            }}
            onChange={contactId => void select(contactId)} />
        </div>
      ) : <div className="text-slate-900 dark:text-slate-100">{renderDetails(onlyAvailable || saved)}</div>}
      {onlyAvailable && <button {...stopCardGestures} type="button" disabled={disabled} onClick={event => { event.stopPropagation(); void select(onlyAvailable.id); }}
        className="self-start rounded-md px-2 py-1.5 font-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50">Použít tohoto příjemce</button>}
      {!valid && <span className="text-amber-700 dark:text-amber-400">Před generováním vyberte kontakt s platným e-mailem.</span>}
      {(error || rememberError) && <span role="alert" className="text-red-600 dark:text-red-400">Volbu se nepodařilo zapamatovat na kartě. Pro tuto poptávku platí zobrazený příjemce.</span>}
    </div>
  );
};
