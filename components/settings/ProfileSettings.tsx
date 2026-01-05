import React, { useState, useEffect } from "react";
import { StatusConfig, Subcontractor } from "../../types";
import {
  addContactStatus,
  updateContactStatus,
  deleteContactStatus,
} from "../../services/contactStatusService";
import { useUI } from "../../context/UIContext";
import { useAuth } from "../../context/AuthContext";

interface ProfileSettingsProps {
  theme: "light" | "dark" | "system";
  onSetTheme: (theme: "light" | "dark" | "system") => void;
  primaryColor: string;
  onSetPrimaryColor: (color: string) => void;
  contactStatuses: StatusConfig[];
  onUpdateStatuses: (statuses: StatusConfig[]) => void;
  onDeleteContacts: (ids: string[]) => void;
  contacts: Subcontractor[];
  user?: any;
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({
  theme,
  onSetTheme,
  primaryColor,
  onSetPrimaryColor,
  contactStatuses,
  onUpdateStatuses,
  onDeleteContacts,
  contacts,
  user,
}) => {
  const { showAlert, showConfirm } = useUI();
  const { updatePreferences } = useAuth();
  // Status Form State
  const [newStatusLabel, setNewStatusLabel] = useState("");
  const [newStatusColor, setNewStatusColor] =
    useState<StatusConfig["color"]>("blue");

  // Display Name State
  const [displayName, setDisplayName] = useState("");
  const [isSavingDisplayName, setIsSavingDisplayName] = useState(false);

  // Load display name on mount
  useEffect(() => {
    if (user?.id) {
      loadDisplayName();
    }
  }, [user?.id]);

  const loadDisplayName = async () => {
    try {
      const { supabase } = await import("../../services/supabase");
      const { data, error } = await supabase
        .from("user_profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 = not found
        console.error("Error loading display name:", error);
        return;
      }

      if (data) {
        setDisplayName(data.display_name || "");
      }
    } catch (error) {
      console.error("Error loading display name:", error);
    }
  };

  const handleSaveDisplayName = async () => {
    if (!user?.id) {
      showAlert({
        title: "Nejste přihlášen",
        message: "Uživatel není přihlášen.",
        variant: "danger",
      });
      return;
    }

    setIsSavingDisplayName(true);
    try {
      const { supabase } = await import("../../services/supabase");

      const { error } = await supabase.from("user_profiles").upsert(
        {
          user_id: user.id,
          display_name: displayName || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        }
      );

      if (error) {
        console.error("Upsert error:", error);
        throw error;
      }

      showAlert({
        title: "Hotovo",
        message: "Zobrazované jméno bylo uloženo.",
        variant: "success",
      });
    } catch (error: any) {
      console.error("Error saving display name:", error);
      showAlert({
        title: "Chyba",
        message: `Chyba při ukládání jména: ${
          error?.message || "Neznámá chyba"
        }`,
        variant: "danger",
      });
    } finally {
      setIsSavingDisplayName(false);
    }
  };

  const handleDeleteAllContacts = async () => {
    if (contacts.length === 0) {
      showAlert({
        title: "Nic ke smazání",
        message: "Databáze kontaktů je již prázdná.",
        variant: "info",
      });
      return;
    }

    const ok = await showConfirm({
      title: "Smazat všechny kontakty?",
      message: `VAROVÁNÍ: Opravdu chcete smazat VŠECHNY kontakty (${contacts.length}) z databáze?\n\nTuto akci nelze vrátit zpět!`,
      variant: "danger",
      confirmLabel: "Smazat",
      cancelLabel: "Zrušit",
    });
    if (!ok) return;

    const ok2 = await showConfirm({
      title: "Opravdu smazat?",
      message: "Opravdu? Jste si naprosto jistí?",
      variant: "danger",
      confirmLabel: "Ano, smazat",
      cancelLabel: "Zrušit",
    });
    if (!ok2) return;

    const allIds = contacts.map((c) => c.id);
    onDeleteContacts(allIds);
  };

  const handleAddStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatusLabel) return;

    const id =
      newStatusLabel.toLowerCase().replace(/[^a-z0-9]/g, "") +
      "_" +
      Date.now().toString().slice(-4);

    const newStatus: StatusConfig = {
      id,
      label: newStatusLabel,
      color: newStatusColor,
    };

    // Optimistic update
    onUpdateStatuses([...contactStatuses, newStatus]);
    setNewStatusLabel("");

    // Persist to database
    const success = await addContactStatus(newStatus);
    if (!success) {
      showAlert({
        title: "Chyba",
        message: "Chyba při ukládání stavu do databáze.",
        variant: "danger",
      });
    }
  };

  const handleDeleteStatus = async (id: string) => {
    const ok = await showConfirm({
      title: "Smazat status?",
      message:
        "Opravdu smazat tento status?\n\nKontakty s tímto statusem budou muset být přeřazeny.",
      variant: "danger",
      confirmLabel: "Smazat",
      cancelLabel: "Zrušit",
    });
    if (!ok) return;

    // Optimistic update
    onUpdateStatuses(contactStatuses.filter((s) => s.id !== id));

    // Persist to database
    const success = await deleteContactStatus(id);
    if (!success) {
      showAlert({
        title: "Chyba",
        message: "Chyba při mazání stavu z databáze.",
        variant: "danger",
      });
    }
  };

  const handleUpdateStatusLabel = async (id: string, newLabel: string) => {
    // Optimistic update
    onUpdateStatuses(
      contactStatuses.map((s) => (s.id === id ? { ...s, label: newLabel } : s))
    );
  };

  const handleStatusLabelBlur = async (id: string, newLabel: string) => {
    const success = await updateContactStatus(id, { label: newLabel });
    if (!success) {
      showAlert({
        title: "Chyba",
        message: "Chyba při ukládání změny do databáze.",
        variant: "danger",
      });
    }
  };

  const handleUpdateStatusColor = async (
    id: string,
    newColor: StatusConfig["color"]
  ) => {
    // Optimistic update
    onUpdateStatuses(
      contactStatuses.map((s) => (s.id === id ? { ...s, color: newColor } : s))
    );

    // Persist to database
    const success = await updateContactStatus(id, { color: newColor });
    if (!success) {
      showAlert({
        title: "Chyba",
        message: "Chyba při ukládání barvy do databáze.",
        variant: "danger",
      });
    }
  };

  const colorOptions: { value: StatusConfig["color"]; class: string }[] = [
    { value: "green", class: "bg-green-500" },
    { value: "blue", class: "bg-blue-500" },
    { value: "red", class: "bg-red-500" },
    { value: "yellow", class: "bg-yellow-500" },
    { value: "purple", class: "bg-purple-500" },
    { value: "slate", class: "bg-slate-500" },
  ];

  const themeColors = [
    "#607AFB", // Default Blue
    "#3B82F6", // Vivid Blue
    "#10B981", // Emerald
    "#F59E0B", // Amber
    "#EF4444", // Red
    "#8B5CF6", // Violet
    "#EC4899", // Pink
    "#6366F1", // Indigo
  ];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* User Profile Section */}
      <section className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">person</span>
          Můj profil
        </h2>

        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-1 space-y-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Zobrazované jméno
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Vaše jméno (např. Jan Novák)"
                className="flex-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 outline-none transition-all"
              />
              <button
                onClick={handleSaveDisplayName}
                disabled={isSavingDisplayName}
                className="px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isSavingDisplayName ? "..." : "Uložit"}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Toto jméno se bude zobrazovat u vámi vytvořených projektů a
              komentářů.
            </p>
          </div>

          <div className="flex-1 space-y-4 border-l border-slate-200 dark:border-slate-700 md:pl-8">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email
              </p>
              <p className="text-slate-900 dark:text-white font-mono bg-slate-100 dark:bg-slate-800 py-1.5 px-3 rounded-lg inline-block text-sm">
                {user?.email}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Role
              </p>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary uppercase tracking-wide">
                {user?.role || "user"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Appearance Settings */}
      <section className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-pink-500">
            palette
          </span>
          Vzhled aplikace
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Theme Preference */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Režim zobrazení
            </label>
            <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              {[
                { id: "light", icon: "light_mode", label: "Světlý" },
                { id: "dark", icon: "dark_mode", label: "Tmavý" },
                { id: "system", icon: "brightness_auto", label: "Systém" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => onSetTheme(opt.id as any)}
                  className={`
                                        flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all
                                        ${
                                          theme === opt.id
                                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                                            : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                        }
                                    `}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {opt.icon}
                  </span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Primary Color */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Hlavní barva
            </label>
            <div className="flex flex-wrap gap-3">
              {themeColors.map((color) => (
                <button
                  key={color}
                  onClick={() => onSetPrimaryColor(color)}
                  className={`
                                        w-10 h-10 rounded-full transition-all flex items-center justify-center
                                        ${
                                          primaryColor === color
                                            ? "ring-4 ring-offset-2 ring-primary dark:ring-offset-slate-900 scale-110"
                                            : "hover:scale-110"
                                        }
                                    `}
                  style={{ backgroundColor: color }}
                >
                  {primaryColor === color && (
                    <span className="material-symbols-outlined text-white text-sm">
                      check
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Email Client Settings */}
      <section className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-500">
            mail
          </span>
          Nastavení emailů
        </h2>

        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Způsob odesílání poptávek
          </label>
          <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            {[
              {
                id: "mailto",
                icon: "send",
                label: "Klasický (Mailto)",
                desc: "Rychlé, odkazy viditelné",
              },
              {
                id: "eml",
                icon: "draft",
                label: "Formátovaný (EML)",
                desc: "HTML, skryté odkazy, vyžaduje stažení",
              },
            ].map((opt) => {
              const isActive =
                (user?.preferences?.emailClientMode || "mailto") === opt.id;

              return (
                <button
                  key={opt.id}
                  onClick={() => updatePreferences({ emailClientMode: opt.id })}
                  className={`
                    flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-lg text-sm font-medium transition-all
                    ${
                      isActive
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }
                `}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">
                      {opt.icon}
                    </span>
                    <span>{opt.label}</span>
                  </div>
                  <span className="text-[10px] opacity-70 font-normal">
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {user?.preferences?.emailClientMode === "eml"
              ? 'Tip: Pro automatické otevírání nastavte v prohlížeči "Vždy otevírat soubory tohoto typu" u staženého souboru.'
              : "Klasický způsob otevře vašeho emailového klienta přímo. Odkazy budou v textové podobě."}
          </p>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-700/50">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Váš emailový podpis
            </label>
            <textarea
              value={user?.preferences?.signature || ""}
              onChange={(e) => updatePreferences({ signature: e.target.value })}
              placeholder="S pozdravem,&#10;Jméno Příjmení&#10;Pozice&#10;Firma s.r.o."
              className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 outline-none transition-all h-32 resize-none"
            />
            <p className="text-xs text-slate-500 mt-1">
              Tento podpis bude automaticky vložen na konec generovaných emailů
              (zastoupí proměnnou <code>{"{PODPIS_UZIVATELE}"}</code>).
              Podporuje <strong>HTML kód</strong> (např. zkopírovaný z Outlook
              podpisu).
            </p>

            {/* Signature Preview */}
            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Náhled podpisu (HTML)
              </label>
              <div
                className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm min-h-[100px] text-sm text-slate-900"
                dangerouslySetInnerHTML={{
                  __html: (user?.preferences?.signature || "").match(
                    /<[a-z][\s\S]*>/i
                  )
                    ? user?.preferences?.signature
                    : (user?.preferences?.signature || "").replace(
                        /\n/g,
                        "<br>"
                      ),
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Contact Statuses Management */}
      <section className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-500">label</span>
          Stavy kontaktů (CRM)
        </h2>

        <div className="space-y-4 mb-8">
          {contactStatuses.map((status) => (
            <div
              key={status.id}
              className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 group"
            >
              <div className="relative">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    colorOptions.find((c) => c.value === status.color)?.class ||
                    "bg-slate-500"
                  } text-white shadow-sm`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    folder
                  </span>
                </div>
              </div>

              <input
                type="text"
                value={status.label}
                onChange={(e) =>
                  handleUpdateStatusLabel(status.id, e.target.value)
                }
                onBlur={(e) => handleStatusLabelBlur(status.id, e.target.value)}
                className="flex-1 bg-transparent border-none text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-0 px-2"
              />

              <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                {colorOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() =>
                      handleUpdateStatusColor(status.id, opt.value)
                    }
                    className={`w-5 h-5 rounded-full ${opt.class} ${
                      status.color === opt.value
                        ? "ring-2 ring-offset-1 ring-slate-400"
                        : "hover:scale-110"
                    } transition-all`}
                  />
                ))}
              </div>

              <button
                onClick={() => handleDeleteStatus(status.id)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors ml-2"
                title="Smazat status"
              >
                <span className="material-symbols-outlined text-[18px]">
                  delete
                </span>
              </button>
            </div>
          ))}
        </div>

        <form
          onSubmit={handleAddStatus}
          className="flex gap-3 p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border-dashed border-2 border-slate-200 dark:border-slate-700"
        >
          <input
            type="text"
            value={newStatusLabel}
            onChange={(e) => setNewStatusLabel(e.target.value)}
            placeholder="Název nového stavu..."
            className="flex-1 bg-transparent border-none text-sm focus:ring-0 placeholder:text-slate-400"
          />
          <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-700 pl-3">
            {colorOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setNewStatusColor(opt.value)}
                className={`w-6 h-6 rounded-full ${opt.class} ${
                  newStatusColor === opt.value
                    ? "ring-2 ring-offset-2 ring-slate-400 scale-110"
                    : "opacity-40 hover:opacity-100"
                } transition-all`}
              />
            ))}
          </div>
          <button
            type="submit"
            disabled={!newStatusLabel}
            className="ml-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-1.5 rounded-lg text-sm font-bold disabled:opacity-50 hover:shadow-lg transition-all"
          >
            Přidat
          </button>
        </form>
      </section>

      {/* Danger Zone */}
      <section className="bg-red-50/50 dark:bg-red-900/10 backdrop-blur-xl border border-red-200/60 dark:border-red-900/30 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-red-700 dark:text-red-400 mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined">warning</span>
          Nebezpečná zóna
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              Smazat všechny kontakty
            </p>
            <p className="text-xs text-slate-500">Tato akce je nevratná.</p>
          </div>
          <button
            onClick={handleDeleteAllContacts}
            className="px-4 py-2 bg-white dark:bg-red-950 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 rounded-lg text-sm font-bold hover:bg-red-50 dark:hover:bg-red-900/50 transition-colors"
          >
            Smazat vše
          </button>
        </div>
      </section>
    </div>
  );
};
