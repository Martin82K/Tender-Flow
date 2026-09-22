import React from "react";
import {
  clientCardFieldLimits,
  type ProjectClientCardDraft,
} from "@features/projects/client/clientCardModel";

const labelClass = "mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500";
const inputClass =
  "w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

interface Props {
  draft: ProjectClientCardDraft;
  errors: Partial<Record<keyof ProjectClientCardDraft, string>>;
  onChange: (draft: ProjectClientCardDraft) => void;
  idPrefix: string;
}

const Field = ({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) => (
  <div>
    <label htmlFor={id} className={labelClass}>{label}</label>
    {children}
    {error ? <p id={`${id}-error`} className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
  </div>
);

export const ProjectClientCardFields: React.FC<Props> = ({ draft, errors, onChange, idPrefix }) => {
  const set = (key: keyof ProjectClientCardDraft, value: string) => onChange({ ...draft, [key]: value });
  const invalid = (id: string, key: keyof ProjectClientCardDraft) => ({
    "aria-invalid": Boolean(errors[key]) || undefined,
    "aria-describedby": errors[key] ? `${id}-error` : undefined,
  });
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <Field id={`${idPrefix}-company`} label="Firma nebo jméno" error={errors.companyName}>
        <input id={`${idPrefix}-company`} className={inputClass} value={draft.companyName} maxLength={clientCardFieldLimits.companyName} {...invalid(`${idPrefix}-company`, "companyName")} onChange={(event) => set("companyName", event.target.value)} />
      </Field>
      <Field id={`${idPrefix}-ico`} label="IČO" error={errors.ico}>
        <input id={`${idPrefix}-ico`} className={inputClass} inputMode="numeric" value={draft.ico} {...invalid(`${idPrefix}-ico`, "ico")} onChange={(event) => set("ico", event.target.value)} />
      </Field>
      <div className="md:col-span-2">
        <Field id={`${idPrefix}-street`} label="Ulice" error={errors.street}>
          <input id={`${idPrefix}-street`} className={inputClass} value={draft.street} maxLength={clientCardFieldLimits.street} {...invalid(`${idPrefix}-street`, "street")} onChange={(event) => set("street", event.target.value)} />
        </Field>
      </div>
      <Field id={`${idPrefix}-zip`} label="PSČ" error={errors.zip}>
        <input id={`${idPrefix}-zip`} className={inputClass} inputMode="numeric" value={draft.zip} {...invalid(`${idPrefix}-zip`, "zip")} onChange={(event) => set("zip", event.target.value)} />
      </Field>
      <Field id={`${idPrefix}-city`} label="Město" error={errors.city}>
        <input id={`${idPrefix}-city`} className={inputClass} value={draft.city} maxLength={clientCardFieldLimits.city} {...invalid(`${idPrefix}-city`, "city")} onChange={(event) => set("city", event.target.value)} />
      </Field>
      <Field id={`${idPrefix}-contact`} label="Kontaktní osoba" error={errors.contactName}>
        <input id={`${idPrefix}-contact`} className={inputClass} value={draft.contactName} maxLength={clientCardFieldLimits.contactName} {...invalid(`${idPrefix}-contact`, "contactName")} onChange={(event) => set("contactName", event.target.value)} />
      </Field>
      <Field id={`${idPrefix}-email`} label="E-mail" error={errors.contactEmail}>
        <input id={`${idPrefix}-email`} type="email" autoComplete="email" className={inputClass} value={draft.contactEmail} maxLength={clientCardFieldLimits.contactEmail} {...invalid(`${idPrefix}-email`, "contactEmail")} onChange={(event) => set("contactEmail", event.target.value)} />
      </Field>
      <Field id={`${idPrefix}-phone`} label="Telefon" error={errors.contactPhone}>
        <input id={`${idPrefix}-phone`} type="tel" autoComplete="tel" className={inputClass} value={draft.contactPhone} maxLength={clientCardFieldLimits.contactPhone} {...invalid(`${idPrefix}-phone`, "contactPhone")} onChange={(event) => set("contactPhone", event.target.value)} />
      </Field>
      <div className="md:col-span-2">
        <Field id={`${idPrefix}-note`} label="Interní poznámka" error={errors.internalNote}>
          <textarea id={`${idPrefix}-note`} rows={3} className={inputClass} value={draft.internalNote} maxLength={clientCardFieldLimits.internalNote} {...invalid(`${idPrefix}-note`, "internalNote")} onChange={(event) => set("internalNote", event.target.value)} />
        </Field>
      </div>
    </div>
  );
};
