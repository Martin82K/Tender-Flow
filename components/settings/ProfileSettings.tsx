import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

// Query key for contact statuses (mirrored from useContactStatusesQuery)
const CONTACT_STATUSES_KEY = ["statuses", "contact"] as const;
import { StatusConfig, Subcontractor } from "../../types";
import {
  addContactStatus,
  updateContactStatus,
  deleteContactStatus,
} from "../../services/contactStatusService";
import { useUI } from "../../context/UIContext";
import { useAuth } from "../../context/AuthContext";
import { BiometricSettings } from "./BiometricSettings";
import { useElectronUpdater } from "../UpdateNotification";

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
  const queryClient = useQueryClient();
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
        message: `Chyba při ukládání jména: ${error?.message || "Neznámá chyba"
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
    } else {
      queryClient.invalidateQueries({
        queryKey: CONTACT_STATUSES_KEY,
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
    } else {
      queryClient.invalidateQueries({
        queryKey: CONTACT_STATUSES_KEY,
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
    } else {
      queryClient.invalidateQueries({
        queryKey: CONTACT_STATUSES_KEY,
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
    } else {
      queryClient.invalidateQueries({
        queryKey: CONTACT_STATUSES_KEY,
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
    <div className="max-w-6xl mx-auto space-y-5 animate-fadeIn">
      {/* Top Grid: Profile & Appearance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* User Profile Section */}
        <section className="bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">person</span>
            Můj profil
          </h2>

          <div className="space-y-5">
            <div className="flex flex-col gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Zobrazované jméno
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Vaše jméno"
                    className="flex-1 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/30 outline-none transition-all"
                  />
                  <button
                    onClick={handleSaveDisplayName}
                    disabled={isSavingDisplayName}
                    className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isSavingDisplayName ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Uložit"}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Zobrazuje se u projektů a komentářů.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800/50">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Email
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 truncate" title={user?.email}>
                    {user?.email}
                  </p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Role
                  </p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold bg-primary/10 text-primary uppercase">
                    {user?.role || "user"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Appearance Settings */}
        <section className="bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-pink-500 text-xl">palette</span>
            Vzhled aplikace
          </h2>

          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Režim zobrazení
              </label>
              <div className="flex gap-1.5 p-1 bg-slate-100/50 dark:bg-slate-800/50 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                {[
                  { id: "light", icon: "light_mode", label: "Světlý" },
                  { id: "dark", icon: "dark_mode", label: "Tmavý" },
                  { id: "system", icon: "brightness_auto", label: "Systém" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => onSetTheme(opt.id as any)}
                    className={`
                      flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-medium transition-all
                      ${theme === opt.id
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-600"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                      }
                    `}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {opt.icon}
                    </span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Hlavní barva
              </label>
              <div className="flex flex-wrap gap-2.5">
                {themeColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => onSetPrimaryColor(color)}
                    className={`
                      w-8 h-8 rounded-full transition-all flex items-center justify-center relative group
                      ${primaryColor === color
                        ? "ring-2 ring-offset-2 ring-primary dark:ring-offset-slate-900 scale-105"
                        : "hover:scale-110"
                      }
                    `}
                    style={{ backgroundColor: color }}
                  >
                    {primaryColor === color && (
                      <span className="material-symbols-outlined text-white text-[14px]">
                        check
                      </span>
                    )}
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Middle Grid: Biometrics & Other Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Biometric Authentication */}
        <BiometricSettings className="bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm" />

        {/* Other Settings */}
        <section className="bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-violet-500 text-xl">tune</span>
            Další nastavení
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50">
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900 dark:text-white">
                  Automatické zkracování odkazů
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Při vložení dlouhého odkazu jej automaticky zkrátit.
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={user?.preferences?.autoShortenProjectDocs ?? false}
                  onChange={(e) => {
                    updatePreferences({
                      autoShortenProjectDocs: e.target.checked,
                    });
                  }}
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </section>
      </div>

      {/* App Update Section */}
      <section className="bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <AppUpdateSection />
      </section>

      {/* Contact Statuses Management */}
      <section className="bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-5 flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-500 text-xl">label</span>
          Typy kontaktů
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {contactStatuses.length === 0 && (
            <div className="col-span-full text-center py-6 text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
              Žádné vlastní typy kontaktů.
            </div>
          )}
          {contactStatuses.map((status) => (
            <div
              key={status.id}
              className="flex items-center gap-3 p-2.5 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800/50 group hover:border-slate-200 dark:hover:border-slate-700 transition-all"
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${colorOptions.find((c) => c.value === status.color)?.class || "bg-slate-500"} text-white shadow-sm`}
              >
                <span className="material-symbols-outlined text-[14px]">star</span>
              </div>

              <input
                type="text"
                value={status.label}
                onChange={(e) => handleUpdateStatusLabel(status.id, e.target.value)}
                onBlur={(e) => handleStatusLabelBlur(status.id, e.target.value)}
                className="flex-1 bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-0 px-1"
              />

              <div className="hidden group-hover:flex items-center gap-1">
                {colorOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleUpdateStatusColor(status.id, opt.value)}
                    className={`w-4 h-4 rounded-full ${opt.class} ${status.color === opt.value ? "ring-2 ring-offset-1 ring-slate-400" : "hover:scale-110 opacity-40 hover:opacity-100"} transition-all`}
                  />
                ))}
              </div>

              <button
                onClick={() => handleDeleteStatus(status.id)}
                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
              </button>
            </div>
          ))}
        </div>

        <form
          onSubmit={handleAddStatus}
          className="flex gap-3 p-3 bg-slate-50/30 dark:bg-slate-800/20 rounded-xl border-dashed border border-slate-200 dark:border-slate-700"
        >
          <input
            type="text"
            value={newStatusLabel}
            onChange={(e) => setNewStatusLabel(e.target.value)}
            placeholder="Nový typ kontaktu..."
            className="flex-1 bg-transparent border-none text-xs focus:ring-0 placeholder:text-slate-400 dark:text-white"
          />
          <div className="flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-700 pl-3">
            {colorOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setNewStatusColor(opt.value)}
                className={`w-5 h-5 rounded-full ${opt.class} ${newStatusColor === opt.value
                  ? "ring-2 ring-offset-1 ring-slate-400 scale-105"
                  : "opacity-30 hover:opacity-100"
                  } transition-all`}
              />
            ))}
          </div>
          <button
            type="submit"
            disabled={!newStatusLabel}
            className="bg-primary text-white px-4 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 hover:brightness-110 transition-all"
          >
            Přidat
          </button>
        </form>
      </section>
    </div>
  );
};

const AppUpdateSection: React.FC = () => {
  const { checkForUpdates, status, info, error, downloadUpdate, installUpdate } =
    useElectronUpdater();
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const handleCheck = async () => {
    setLastCheck(new Date());
    await checkForUpdates();
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
        <span className="material-symbols-outlined text-sky-500">system_update</span>
        Aktualizace aplikace
      </h2>

      <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-3 h-3 rounded-full ${status === 'available' ? 'bg-green-500 animate-pulse' :
              status === 'checking' ? 'bg-blue-500 animate-pulse' :
                status === 'error' ? 'bg-red-500' :
                  'bg-slate-400'
              }`} />
            <h3 className="font-medium text-slate-900 dark:text-white">
              {status === 'checking' && 'Kontrola aktualizací...'}
              {status === 'available' && `Nová verze ${info?.version} je k dispozici`}
              {status === 'not-available' && 'Máte nejnovější verzi'}
              {status === 'downloading' && 'Stahování aktualizace...'}
              {status === 'downloaded' && 'Aktualizace připravena k instalaci'}
              {status === 'error' && 'Chyba při kontrole'}
            </h3>
          </div>

          <p className="text-sm text-slate-500 dark:text-slate-400">
            {status === 'not-available' ? (
              <>Systém automaticky kontroluje aktualizace. {lastCheck && `Poslední kontrola: ${lastCheck.toLocaleTimeString()}`}</>
            ) : status === 'available' ? (
              <>Je dostupná nová verze aplikace. Doporučujeme aktualizovat.</>
            ) : status === 'error' ? (
              <>Nepodařilo se spojit se serverem aktualizací. ({error})</>
            ) : (
              <>Probíhá komunikace se serverem...</>
            )}
          </p>
        </div>

        <div className="flex gap-3">
          {status === 'available' ? (
            <button
              onClick={() => downloadUpdate()}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Stáhnout
            </button>
          ) : status === 'downloaded' ? (
            <button
              onClick={() => installUpdate()}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">restart_alt</span>
              Restartovat
            </button>
          ) : (
            <button
              onClick={handleCheck}
              disabled={status === 'checking' || status === 'downloading'}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[18px] ${status === 'checking' ? 'animate-spin' : ''}`}>
                refresh
              </span>
              Zkontrolovat
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
