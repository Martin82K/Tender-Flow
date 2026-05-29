import React, { useEffect, useMemo, useState } from "react";
import {
  CircleCheck,
  CircleX,
  KeyRound,
  Laptop,
  LogOut,
  Monitor,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Smartphone,
} from "lucide-react";
import {
  mfaService,
  type MfaEnrollment,
  type MfaFactor,
  type MfaStatus,
} from "@infra/auth/mfaService";
import { authDeviceService, type AuthDevice } from "@infra/auth/deviceService";
import { isDesktop, platformAdapter } from "@infra/platform/platformAdapter";
import { useUI } from "@/context/UIContext";
import { useAuth } from "@/context/AuthContext";

const buildQrCodeImageSrc = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.startsWith("data:image/")) return trimmed;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(trimmed)}`;
};

const getPrimaryFactor = (status: MfaStatus | null): MfaFactor | null =>
  status?.verifiedFactors.find((factor) => factor.factorType === "totp") ??
  status?.verifiedFactors[0] ??
  null;

const formatDateTime = (value: string | null): string => {
  if (!value) return "Neznámá";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Neznámá";
  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const getDeviceIcon = (device: AuthDevice) => {
  if (device.clientKind === "mobile") return Smartphone;
  if (device.clientKind === "desktop") return Monitor;
  return Laptop;
};

export const UserSecuritySettings: React.FC = () => {
  const { showAlert, showConfirm } = useUI();
  const { logout } = useAuth();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [devices, setDevices] = useState<AuthDevice[]>([]);
  const [setupCode, setSetupCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [isPinEnabled, setIsPinEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDevices, setIsLoadingDevices] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPinSaving, setIsPinSaving] = useState(false);
  const [revokingDeviceId, setRevokingDeviceId] = useState<string | null>(null);
  const [qrImageFailed, setQrImageFailed] = useState(false);

  const primaryFactor = useMemo(() => getPrimaryFactor(status), [status]);
  const isEnabled = Boolean(primaryFactor);

  const loadStatus = async () => {
    setIsLoading(true);
    try {
      setStatus(await mfaService.getStatus());
    } catch (error) {
      console.error("Failed to load MFA status:", error);
      showAlert({
        title: "Chyba",
        message: "Nepodařilo se načíst stav dvoufázového ověření.",
        variant: "danger",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadDevices = async () => {
    setIsLoadingDevices(true);
    try {
      setDevices(await authDeviceService.listDevices());
    } catch (error) {
      console.error("Failed to load auth devices:", error);
      showAlert({
        title: "Chyba",
        message: "Nepodařilo se načíst přihlášená zařízení.",
        variant: "danger",
      });
    } finally {
      setIsLoadingDevices(false);
    }
  };

  const loadPinStatus = async () => {
    if (!isDesktop) return;
    try {
      setIsPinEnabled(await platformAdapter.session.isPinEnabled());
    } catch (error) {
      console.error("Failed to load PIN status");
    }
  };

  useEffect(() => {
    void loadStatus();
    void loadDevices();
    void loadPinStatus();
  }, []);

  const handleStartEnrollment = async () => {
    setIsSaving(true);
    setQrImageFailed(false);
    try {
      const result = await mfaService.startTotpEnrollment();
      setEnrollment(result);
      setSetupCode("");
    } catch (error) {
      console.error("Failed to start MFA enrollment:", error);
      showAlert({
        title: "Zapnutí 2FA selhalo",
        message: "Nepodařilo se připravit QR kód pro authenticator aplikaci.",
        variant: "danger",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyEnrollment = async () => {
    if (!enrollment || !setupCode.trim()) return;

    setIsSaving(true);
    try {
      await mfaService.verifyEnrollment({
        factorId: enrollment.factorId,
        code: setupCode,
      });
      setEnrollment(null);
      setSetupCode("");
      await loadStatus();
      showAlert({
        title: "2FA aktivováno",
        message: "Dvoufázové ověření přes authenticator aplikaci je zapnuté.",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to verify MFA enrollment:", error);
      showAlert({
        title: "Ověření selhalo",
        message: "Zadaný kód se nepodařilo ověřit. Zkontrolujte authenticator aplikaci.",
        variant: "danger",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisableMfa = async () => {
    if (!primaryFactor || !disableCode.trim()) {
      showAlert({
        title: "Chybí kód",
        message: "Pro vypnutí 2FA zadejte aktuální kód z authenticator aplikace.",
        variant: "danger",
      });
      return;
    }

    const confirmed = await showConfirm({
      title: "Vypnout 2FA?",
      message: "Po vypnutí bude účet chráněn pouze běžným přihlášením. Tuto změnu proveďte jen na důvěryhodném zařízení.",
      variant: "danger",
      confirmLabel: "Vypnout 2FA",
      cancelLabel: "Zrušit",
    });
    if (!confirmed) return;

    setIsSaving(true);
    try {
      await mfaService.verifyFactor({
        factorId: primaryFactor.id,
        code: disableCode,
      });
      await mfaService.unenrollFactor(primaryFactor.id);
      setDisableCode("");
      await loadStatus();
      showAlert({
        title: "2FA vypnuto",
        message: "Dvoufázové ověření bylo vypnuto pro váš účet.",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to disable MFA:", error);
      showAlert({
        title: "Vypnutí 2FA selhalo",
        message: "Kód se nepodařilo ověřit nebo faktor nelze odebrat.",
        variant: "danger",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevokeDevice = async (device: AuthDevice) => {
    const confirmed = await showConfirm({
      title: device.isCurrent ? "Odhlásit aktuální zařízení?" : "Odhlásit zařízení?",
      message: device.isCurrent
        ? "Aktuální session bude zrušena a budete přesměrováni na přihlášení."
        : `Zařízení ${device.deviceName} bude odhlášeno z Tender Flow.`,
      variant: "danger",
      confirmLabel: "Odhlásit zařízení",
      cancelLabel: "Zrušit",
    });
    if (!confirmed) return;

    setRevokingDeviceId(device.id);
    try {
      await authDeviceService.revokeDevice(device.id);
      showAlert({
        title: "Zařízení odhlášeno",
        message: device.isCurrent
          ? "Aktuální zařízení bylo odhlášeno."
          : `Zařízení ${device.deviceName} bylo odhlášeno.`,
        variant: "success",
      });

      if (device.isCurrent) {
        await logout();
        return;
      }

      await loadDevices();
    } catch (error) {
      console.error("Failed to revoke auth device:", error);
      showAlert({
        title: "Odhlášení zařízení selhalo",
        message: "Zařízení se nepodařilo odhlásit. Zkuste to prosím znovu.",
        variant: "danger",
      });
    } finally {
      setRevokingDeviceId(null);
    }
  };

  const handleSetPin = async () => {
    const normalizedPin = pin.replace(/\D/g, "").slice(0, 12);
    const normalizedConfirm = pinConfirm.replace(/\D/g, "").slice(0, 12);

    if (normalizedPin.length < 6) {
      showAlert({
        title: "PIN je krátký",
        message: "Zvolte alespoň 6 číslic.",
        variant: "danger",
      });
      return;
    }

    if (normalizedPin !== normalizedConfirm) {
      showAlert({
        title: "PIN nesouhlasí",
        message: "Obě pole musí obsahovat stejný PIN.",
        variant: "danger",
      });
      return;
    }

    setIsPinSaving(true);
    try {
      await platformAdapter.session.setPin(normalizedPin);
      setPin("");
      setPinConfirm("");
      setIsPinEnabled(true);
      showAlert({
        title: "PIN aktivován",
        message: "Rychlé desktopové odemknutí PINem je zapnuté.",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to set PIN");
      showAlert({
        title: "Nastavení PINu selhalo",
        message: "PIN se nepodařilo bezpečně uložit.",
        variant: "danger",
      });
    } finally {
      setIsPinSaving(false);
    }
  };

  const handleClearPin = async () => {
    const confirmed = await showConfirm({
      title: "Vypnout PIN?",
      message: "Rychlé odemknutí PINem bude na tomto zařízení vypnuté.",
      variant: "danger",
      confirmLabel: "Vypnout PIN",
      cancelLabel: "Zrušit",
    });
    if (!confirmed) return;

    setIsPinSaving(true);
    try {
      await platformAdapter.session.clearPin();
      setIsPinEnabled(false);
      showAlert({
        title: "PIN vypnut",
        message: "Rychlé odemknutí PINem bylo vypnuto.",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to clear PIN");
      showAlert({
        title: "Vypnutí PINu selhalo",
        message: "PIN se nepodařilo vypnout.",
        variant: "danger",
      });
    } finally {
      setIsPinSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">security</span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Zabezpečení
          </h2>
        </div>
        <p className="text-sm text-slate-500">
          Správa dvoufázového ověření účtu a bezpečnostních prvků přihlášení.
        </p>
      </div>

      <section className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className={`rounded-xl p-3 ${isEnabled ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"}`}>
              {isEnabled ? <ShieldCheck className="h-6 w-6" /> : <ShieldOff className="h-6 w-6" />}
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">
                Dvoufázové ověření
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {isEnabled
                  ? "2FA je zapnuté. Při nové nebo neověřené session bude vyžadován kód z authenticator aplikace."
                  : "2FA je vypnuté. Můžete ho zapnout pomocí Google Authenticator, Microsoft Authenticator, 1Password nebo podobné aplikace."}
              </p>
            </div>
          </div>

          {isLoading ? (
            <span className="text-sm text-slate-500">Načítám...</span>
          ) : isEnabled ? (
            <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              Aktivní
            </span>
          ) : (
            <button
              onClick={() => void handleStartEnrollment()}
              disabled={isSaving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-50"
            >
              {isSaving ? "Připravuji..." : "Zapnout 2FA"}
            </button>
          )}
        </div>

        {enrollment && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
            <div className="grid gap-5 md:grid-cols-[auto,1fr]">
              {qrImageFailed ? (
                <div
                  aria-label="QR kód pro 2FA fallback"
                  className="flex h-44 w-44 items-center justify-center rounded-lg border border-slate-200 bg-white p-3 text-center text-xs text-slate-600"
                >
                  QR kód se nepodařilo zobrazit. Použijte ruční secret.
                </div>
              ) : (
                <img
                  alt="QR kód pro 2FA"
                  src={buildQrCodeImageSrc(enrollment.qrCodeSvg)}
                  onError={() => setQrImageFailed(true)}
                  className="h-44 w-44 rounded-lg border border-slate-200 bg-white p-2"
                />
              )}

              <div className="space-y-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    1. Naskenujte QR kód v authenticator aplikaci
                  </div>
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    Ruční secret:{" "}
                    <code className="rounded bg-white px-1.5 py-1 dark:bg-slate-800">
                      {enrollment.secret}
                    </code>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-900 dark:text-white">
                    2. Zadejte první 6místný kód
                  </label>
                  <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                    <input
                      aria-label="Kód pro aktivaci 2FA"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={setupCode}
                      onChange={(e) => setSetupCode(e.target.value.replace(/[^\d\s]/g, "").slice(0, 8))}
                      placeholder="123456"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                    />
                    <button
                      onClick={() => void handleVerifyEnrollment()}
                      disabled={isSaving || !setupCode.trim()}
                      className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                    >
                      {isSaving ? "Ověřuji..." : "Aktivovat 2FA"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {isEnabled && primaryFactor && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
            <h4 className="text-sm font-semibold text-red-900 dark:text-red-100">
              Vypnutí 2FA
            </h4>
            <p className="mt-1 text-sm text-red-800 dark:text-red-200">
              Pro vypnutí zadejte aktuální kód z authenticator aplikace. Při ztrátě telefonu kontaktujte administrátora.
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                aria-label="Kód pro vypnutí 2FA"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/[^\d\s]/g, "").slice(0, 8))}
                placeholder="123456"
                className="rounded-lg border border-red-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-red-500/30 dark:bg-slate-950/40 dark:text-white"
              />
              <button
                onClick={() => void handleDisableMfa()}
                disabled={isSaving || !disableCode.trim()}
                className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
              >
                {isSaving ? "Vypínám..." : "Vypnout 2FA"}
              </button>
            </div>
          </div>
        )}
      </section>

      {isDesktop ? (
        <section className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <div className={`rounded-xl p-3 ${isPinEnabled ? "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"}`}>
                <KeyRound className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  Rychlé odemknutí PINem
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  PIN odemkne jen uloženou desktopovou session po úspěšném přihlášení. Pokud session ztratí AAL2, authenticator bude pořád vyžadovaný.
                </p>
              </div>
            </div>

            {isPinEnabled ? (
              <span className="rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
                Aktivní
              </span>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr),minmax(0,1fr),auto]">
            <input
              aria-label="Nový PIN"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 12))}
              placeholder="Nový PIN"
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
            />
            <input
              aria-label="Potvrzení PINu"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 12))}
              placeholder="Potvrdit PIN"
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
            />
            <button
              type="button"
              onClick={() => void handleSetPin()}
              disabled={isPinSaving || pin.length < 6 || pinConfirm.length < 6}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-50"
            >
              {isPinSaving ? "Ukládám..." : isPinEnabled ? "Změnit PIN" : "Zapnout PIN"}
            </button>
          </div>

          {isPinEnabled ? (
            <button
              type="button"
              onClick={() => void handleClearPin()}
              disabled={isPinSaving}
              className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-500/30 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-500/10"
            >
              Vypnout PIN
            </button>
          ) : null}
        </section>
      ) : null}

      <section className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">
              Zařízení
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Přehled zařízení, ze kterých jste se přihlásili do Tender Flow.
              Zařízení je možné odhlásit bez vypnutí 2FA.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadDevices()}
            disabled={isLoadingDevices}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingDevices ? "animate-spin" : ""}`} />
            Obnovit
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {isLoadingDevices ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/40">
              Načítám zařízení...
            </div>
          ) : devices.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
              Zatím tu není žádné evidované zařízení. Aktuální zařízení se uloží po příštím úspěšném přihlášení.
            </div>
          ) : (
            devices.map((device) => {
              const DeviceIcon = getDeviceIcon(device);
              const isRevoked = device.status === "revoked";
              return (
                <div
                  key={device.id}
                  className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-primary dark:border-slate-700 dark:bg-slate-900">
                      <DeviceIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {device.deviceName}
                        </div>
                        {device.isCurrent && (
                          <span className="rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
                            Aktuální
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${
                            isRevoked
                              ? "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                          }`}
                        >
                          {isRevoked ? <CircleX className="h-3.5 w-3.5" /> : <CircleCheck className="h-3.5 w-3.5" />}
                          {isRevoked ? "Odhlášené" : "Aktivní"}
                        </span>
                      </div>
                      <div className="mt-2 grid gap-1 text-sm text-slate-600 dark:text-slate-400 sm:grid-cols-2 xl:grid-cols-3">
                        <span>Typ: {device.clientKind === "desktop" ? "Desktop" : device.clientKind === "mobile" ? "Mobil" : "Web"}</span>
                        <span>Platforma: {device.platform || "Neznámá"}</span>
                        <span>IP: {device.ipAddress || "Nedostupná"}</span>
                        <span>Poslední aktivita: {formatDateTime(device.lastSeenAt)}</span>
                        <span>První přihlášení: {formatDateTime(device.firstSeenAt)}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleRevokeDevice(device)}
                    disabled={isRevoked || revokingDeviceId === device.id}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-500/30 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-500/10"
                  >
                    <LogOut className="h-4 w-4" />
                    {revokingDeviceId === device.id ? "Odhlašuji..." : "Odhlásit"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};
