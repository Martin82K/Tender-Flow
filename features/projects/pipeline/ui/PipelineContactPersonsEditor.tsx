import React from "react";

import type { ContactPerson } from "@/types";

export interface PipelineContactPersonsEditorProps {
  contacts: ContactPerson[];
  onChange: (contacts: ContactPerson[]) => void;
  createId: () => string;
}

const createBlankContact = (createId: () => string): ContactPerson => ({
  id: createId(),
  name: "",
  phone: "",
  email: "",
  position: "",
});

export const PipelineContactPersonsEditor: React.FC<
  PipelineContactPersonsEditorProps
> = ({ contacts, onChange, createId }) => {
  const addContact = () => {
    onChange([...contacts, createBlankContact(createId)]);
  };

  const removeContact = (id: string) => {
    onChange(contacts.filter((contact) => contact.id !== id));
  };

  const updateContact = (id: string, updates: Partial<ContactPerson>) => {
    onChange(
      contacts.map((contact) =>
        contact.id === id ? { ...contact, ...updates } : contact,
      ),
    );
  };

  return (
    <div className="col-span-2 mt-6">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
          Kontaktní osoby
        </h4>
        <button
          type="button"
          onClick={addContact}
          className="flex items-center gap-1 text-xs font-bold text-primary transition-colors hover:text-primary/80"
        >
          <span
            aria-hidden="true"
            className="material-symbols-outlined text-[16px]"
          >
            add
          </span>
          Přidat osobu
        </button>
      </div>

      <div className="space-y-4">
        {contacts.map((contact) => (
          <div
            key={contact.id}
            className="group relative rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700/50 dark:bg-slate-800/50"
          >
            {contacts.length > 1 && (
              <button
                type="button"
                onClick={() => removeContact(contact.id)}
                aria-label={`Odstranit ${contact.name || "kontaktní osobu"}`}
                className="absolute right-2 top-2 text-slate-400 transition-colors hover:text-red-500"
              >
                <span
                  aria-hidden="true"
                  className="material-symbols-outlined text-[18px]"
                >
                  delete
                </span>
              </button>
            )}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">
                  Jméno
                </label>
                <input
                  type="text"
                  value={contact.name}
                  onChange={(event) =>
                    updateContact(contact.id, { name: event.target.value })
                  }
                  onKeyDown={(event) => event.stopPropagation()}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  placeholder="Jméno a Příjmení"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">
                  Pozice
                </label>
                <input
                  type="text"
                  value={contact.position || ""}
                  onChange={(event) =>
                    updateContact(contact.id, { position: event.target.value })
                  }
                  onKeyDown={(event) => event.stopPropagation()}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  placeholder="Např. Obchodní zástupce"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">
                  Telefon
                </label>
                <input
                  type="text"
                  value={contact.phone}
                  onChange={(event) =>
                    updateContact(contact.id, { phone: event.target.value })
                  }
                  onKeyDown={(event) => event.stopPropagation()}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  placeholder="+420 ..."
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">
                  Email
                </label>
                <input
                  type="email"
                  value={contact.email}
                  onChange={(event) =>
                    updateContact(contact.id, { email: event.target.value })
                  }
                  onKeyDown={(event) => event.stopPropagation()}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  placeholder="email@example.com"
                />
              </div>
            </div>
          </div>
        ))}

        {contacts.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-slate-200 py-8 text-center dark:border-slate-800">
            <p className="text-sm text-slate-500">
              Žádné kontaktní osoby nebyly přidány.
            </p>
            <button
              type="button"
              onClick={addContact}
              className="mt-2 text-xs font-bold text-primary"
            >
              Přidat první osobu
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
