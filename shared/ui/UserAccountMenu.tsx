import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { buildAppUrl } from "@/shared/routing/routeUtils";
import { navigate } from "@/shared/routing/router";
import { userProfileService } from "@/services/userProfileService";
import { isDesktop, platformAdapter } from "@/services/platformAdapter";
import {
  DEFAULT_UI_SCALE,
  UI_SCALE_MAX,
  UI_SCALE_MIN,
  UI_SCALE_STEP,
  normalizeUiScale,
  type ThemeMode,
  type ThemeSkin,
} from "@/hooks/useTheme";
import type { User } from "@/types";

interface UserAccountMenuProps {
  user: User | null;
  theme: ThemeMode;
  skin: ThemeSkin;
  onSetTheme: (theme: ThemeMode) => void;
  onSetSkin: (skin: ThemeSkin) => void;
  uiScale: number;
  onSetUiScale: (scale: number) => void;
  onResetUiScale: () => void;
  onLogout: () => void | Promise<void>;
}

type Tier = "free" | "starter" | "pro" | "enterprise" | "admin";

const tierLabelMap: Record<Tier, string> = {
  free: "Free tarif",
  starter: "Starter tarif",
  pro: "Pro tarif",
  enterprise: "Enterprise tarif",
  admin: "Admin tarif",
};

const themeOptions: Array<{
  id: ThemeMode;
  icon: string;
  label: string;
}> = [
  { id: "light", icon: "light_mode", label: "Světlý" },
  { id: "dark", icon: "dark_mode", label: "Tmavý" },
  { id: "system", icon: "brightness_auto", label: "Auto" },
];

const skinOptions: Array<{
  id: ThemeSkin;
  icon: string;
  label: string;
}> = [
  { id: "industrial", icon: "precision_manufacturing", label: "Industrial" },
  { id: "classic", icon: "dashboard_customize", label: "Classic" },
];

const getInitials = (nameOrEmail: string | undefined): string => {
  const value = (nameOrEmail || "U").trim();
  const nameParts = value.includes("@")
    ? [value.split("@")[0]]
    : value.split(/\s+/).filter(Boolean);

  return nameParts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "U";
};

const getDisplayRole = (role: User["role"] | undefined): string => {
  if (role === "admin") return "Správce";
  if (role === "demo") return "Demo";
  return "Uživatel";
};

export const UserAccountMenu: React.FC<UserAccountMenuProps> = ({
  user,
  theme,
  skin,
  onSetTheme,
  onSetSkin,
  uiScale,
  onSetUiScale,
  onResetUiScale,
  onLogout,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarStatus, setAvatarStatus] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number }>({
    top: 0,
    right: 16,
  });

  const tier = (user?.subscriptionTier || "free") as Tier;
  const fallbackName = displayName || user?.name || user?.email?.split("@")[0] || "Uživatel";
  const initials = getInitials(displayName || user?.name || user?.email);
  const accountMeta = `${getDisplayRole(user?.role)} · ${tierLabelMap[tier] ?? "Free tarif"}`;
  const canUploadAvatar = Boolean(user?.id && user.role !== "demo");
  const normalizedUiScale = normalizeUiScale(uiScale);
  const uiScalePercent = Math.round(normalizedUiScale * 100);
  const canDecreaseUiScale = normalizedUiScale > UI_SCALE_MIN;
  const canIncreaseUiScale = normalizedUiScale < UI_SCALE_MAX;
  const biometricLabel =
    platformAdapter.platform.os === "win32" ? "Windows Hello" : "Touch ID / Face ID";

  const updateMenuPosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPosition({
      top: rect.bottom + 8,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !menuRef.current?.contains(target) &&
        !menuPanelRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, updateMenuPosition]);

  useEffect(() => {
    if (!user?.id) return;

    let active = true;
    const loadProfile = async () => {
      try {
        const profile = await userProfileService.getProfile(user.id);
        const nextAvatarUrl = await userProfileService.getAvatarUrl(profile.avatarPath);
        if (!active) return;
        setDisplayName(profile.displayName || "");
        setAvatarUrl(nextAvatarUrl);
      } catch {
        if (active) {
          setDisplayName("");
          setAvatarUrl(null);
        }
      }
    };

    void loadProfile();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const closeAndNavigate = (
    settingsTab: "user" | "tools" | "organization" | "admin",
    settingsSubTab:
      | "profile"
      | "notifications"
      | "backup"
      | "contacts"
      | "excelUnlocker"
      | "overview"
      | "members"
      | "billing"
      | "branding" = "profile",
  ) => {
    navigate(buildAppUrl("settings", { settingsTab, settingsSubTab }));
    setIsOpen(false);
  };

  const handleOpenManual = () => {
    setIsOpen(false);

    if (isDesktop) {
      platformAdapter.app.openUserManual().catch((error) => {
        console.error("Nepodařilo se otevřít příručku:", error);
      });
      return;
    }

    window.open("/user-manual/index.html", "_blank", "noopener,noreferrer");
  };

  const handleLogoutClick = () => {
    if (isDesktop) {
      setShowLogoutConfirm(true);
      return;
    }

    void onLogout();
  };

  const handleConfirmQuit = async () => {
    try {
      if (platformAdapter.app.quit) {
        await platformAdapter.app.quit();
      } else {
        window.close();
      }
    } catch (error) {
      console.error("Failed to quit app:", error);
    }
  };

  const handleConfirmLogout = () => {
    void onLogout();
    setShowLogoutConfirm(false);
    setIsOpen(false);
  };

  const handleDecreaseUiScale = () => {
    onSetUiScale(normalizeUiScale(normalizedUiScale - UI_SCALE_STEP));
  };

  const handleIncreaseUiScale = () => {
    onSetUiScale(normalizeUiScale(normalizedUiScale + UI_SCALE_STEP));
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !user?.id || !canUploadAvatar) return;

    setIsUploadingAvatar(true);
    setAvatarStatus(null);
    try {
      const result = await userProfileService.uploadAvatar(user.id, file);
      setAvatarUrl(result.avatarUrl);
      setAvatarStatus("Avatar uložen.");
    } catch (error) {
      setAvatarStatus(error instanceof Error ? error.message : "Avatar se nepodařilo uložit.");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  return (
    <>
      <div ref={menuRef} className="tf-account-menu relative">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleAvatarChange}
        />
        <button
          ref={triggerRef}
          type="button"
          onClick={() => {
            updateMenuPosition();
            setIsOpen((prev) => !prev);
          }}
          className={`flex h-9 items-center gap-1.5 rounded-full border pl-1 pr-1.5 transition-all ${
            isOpen
              ? "border-primary bg-primary/10 text-primary shadow-sm"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          }`}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-label="Uživatelské menu"
        >
          <span className="tf-account-menu-avatar flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-[11px] font-black text-white ring-2 ring-white dark:ring-slate-900">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="size-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              initials
            )}
          </span>
          <span className="hidden max-w-20 truncate text-xs font-bold lg:inline">
            {initials}
          </span>
          <span
            aria-hidden="true"
            className={`material-symbols-outlined text-[18px] transition-transform ${isOpen ? "rotate-180" : ""}`}
          >
            expand_more
          </span>
        </button>

        {isOpen && createPortal((
          <div
            ref={menuPanelRef}
            role="menu"
            className="tf-account-menu-panel fixed z-[100] w-[min(92vw,280px)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40"
            style={{
              top: menuPosition.top,
              right: menuPosition.right,
            }}
          >
            <div className="flex gap-2.5 border-b border-slate-200 p-2.5 dark:border-slate-800">
              <div className="tf-account-menu-avatar relative size-10 shrink-0 overflow-hidden rounded-lg bg-primary text-white shadow-inner">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    className="size-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-sm font-black">
                    {initials}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-extrabold text-slate-900 dark:text-white">
                  {fallbackName}
                </div>
                <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {user?.email || "Bez e-mailu"}
                </div>
                <div className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
                  {accountMeta}
                </div>
              </div>
            </div>

            <div className="border-b border-slate-200 p-1.5 dark:border-slate-800">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!canUploadAvatar || isUploadingAvatar}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <span
                  aria-hidden="true"
                  className="material-symbols-outlined text-[16px] text-slate-400"
                >
                  add_a_photo
                </span>
                {isUploadingAvatar ? "Nahrávám avatar..." : "Nahrát avatar"}
              </button>
              {avatarStatus && (
                <div className="px-2 pb-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {avatarStatus}
                </div>
              )}
            </div>

            <div className="border-b border-slate-200 p-2 dark:border-slate-800">
              <MenuItem
                icon="person"
                label="Můj profil"
                onClick={() => closeAndNavigate("user", "profile")}
              />
              <MenuItem
                icon="tune"
                label="Předvolby účtu"
                onClick={() => closeAndNavigate("user", "notifications")}
              />
              <MenuItem
                icon="settings"
                label="Nastavení"
                onClick={() => closeAndNavigate("user", "profile")}
              />
              <MenuItem
                icon="build"
                label="Nástroje"
                onClick={() => closeAndNavigate("tools", "excelUnlocker")}
              />
              <MenuItem
                icon="domain"
                label="Organizace"
                detail={user?.organizationName}
                onClick={() => closeAndNavigate("organization", "overview")}
              />
            </div>

            <div className="border-b border-slate-200 p-2 dark:border-slate-800">
              <div className="mb-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Vzhled
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {themeOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onSetTheme(option.id)}
                    className={`flex min-h-8 items-center justify-center gap-1 rounded-md border px-1.5 text-[10px] font-bold transition-all ${
                      theme === option.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400 dark:hover:bg-slate-800"
                    }`}
                    aria-pressed={theme === option.id}
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
                      {option.icon}
                    </span>
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {skinOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onSetSkin(option.id)}
                    className={`flex min-h-8 items-center justify-center gap-1 rounded-md border px-1.5 text-[10px] font-bold transition-all ${
                      skin === option.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400 dark:hover:bg-slate-800"
                    }`}
                    aria-pressed={skin === option.id}
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
                      {option.icon}
                    </span>
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 p-1.5 dark:border-slate-700 dark:bg-slate-950">
                <div className="min-w-0 px-1.5">
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    Velikost UI
                  </div>
                  <div className="text-[11px] font-bold tabular-nums text-slate-700 dark:text-slate-200">
                    {uiScalePercent} %
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <UiScaleButton
                    icon="remove"
                    label="Zmenšit UI"
                    disabled={!canDecreaseUiScale}
                    onClick={handleDecreaseUiScale}
                  />
                  <UiScaleButton
                    icon="restart_alt"
                    label={`Resetovat velikost UI na ${Math.round(DEFAULT_UI_SCALE * 100)} %`}
                    disabled={normalizedUiScale === DEFAULT_UI_SCALE}
                    onClick={onResetUiScale}
                  />
                  <UiScaleButton
                    icon="add"
                    label="Zvětšit UI"
                    disabled={!canIncreaseUiScale}
                    onClick={handleIncreaseUiScale}
                  />
                </div>
              </div>
            </div>

            <div className="p-1.5">
              <MenuItem
                icon="help"
                label="Nápověda & podpora"
                onClick={handleOpenManual}
              />
              <MenuItem
                icon="keyboard"
                label="Klávesové zkratky"
                detail="Ctrl K"
                onClick={() => setIsOpen(false)}
              />
              <MenuItem
                icon="logout"
                label="Odhlásit se"
                danger
                onClick={handleLogoutClick}
              />
            </div>
          </div>
        ), document.body)}
      </div>

      {showLogoutConfirm && (
        <div className="tf-logout-confirm-modal fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="tf-logout-confirm-panel w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <h3 className="mb-2 text-xl font-bold text-white">
              Chcete ukončit aplikaci?
            </h3>
            <p className="mb-6 text-slate-400">
              Můžete aplikaci ukončit a zůstat přihlášeni pro {biometricLabel},
              nebo se úplně odhlásit.
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleConfirmQuit}
                className="tf-logout-confirm-primary flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 font-bold text-white transition-colors hover:bg-amber-500"
              >
                <span aria-hidden="true" className="material-symbols-outlined">
                  power_settings_new
                </span>
                Ukončit aplikaci
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="tf-logout-confirm-secondary flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 font-medium text-slate-300 transition-colors hover:bg-slate-700"
              >
                <span aria-hidden="true" className="material-symbols-outlined">logout</span>
                Odhlásit se
              </button>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="tf-logout-confirm-cancel mt-1 w-full px-4 py-2 text-sm text-slate-500 transition-colors hover:text-white"
              >
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

interface MenuItemProps {
  icon: string;
  label: string;
  detail?: string;
  danger?: boolean;
  onClick: () => void;
}

const MenuItem: React.FC<MenuItemProps> = ({
  icon,
  label,
  detail,
  danger = false,
  onClick,
}) => (
  <button
    type="button"
    role="menuitem"
    onClick={onClick}
    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-medium transition-colors ${
      danger
        ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
    }`}
  >
    <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-slate-400">
      {icon}
    </span>
    <span className="min-w-0 flex-1 truncate">{label}</span>
    {detail && (
      <span className="max-w-28 truncate text-[11px] text-slate-400 dark:text-slate-500">
        {detail}
      </span>
    )}
  </button>
);

interface UiScaleButtonProps {
  icon: string;
  label: string;
  disabled: boolean;
  onClick: () => void;
}

const UiScaleButton: React.FC<UiScaleButtonProps> = ({
  icon,
  label,
  disabled,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="flex size-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
    aria-label={label}
    title={label}
  >
    <span aria-hidden="true" className="material-symbols-outlined text-[15px]">
      {icon}
    </span>
  </button>
);
