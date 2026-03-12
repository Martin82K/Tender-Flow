import React, { useEffect, useState } from "react";
import { useUI } from "@/context/UIContext";
import {
  elevateAdminMfaSession,
  getAdminMfaStatus,
  startAdminMfaEnrollment,
  verifyAdminMfaEnrollment,
  type AdminMfaEnrollment,
  type AdminMfaStatus,
} from "@/features/settings/api/adminMfaService";
import type { User } from "@/types";

interface AdminMfaGuardProps {
  user?: Pick<User, "role" | "email"> | null;
  children: React.ReactNode;
}

const statusLabel = (status: AdminMfaStatus): string => {
  if (!status.required) return "MFA není vyžadováno.";
  if (status.needsEnrollment) return "Chybí ověřený MFA faktor.";
  if (status.needsVerification) return "Aktuální admin session není ověřena na úrovni AAL2.";
  return "MFA compliance je splněna.";
};

const buildQrCodeImageSrc = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.startsWith("data:image/")) return trimmed;
  if (trimmed.startsWith("<svg") || trimmed.startsWith("<?xml")) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(trimmed)}`;
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(trimmed)}`;
};

export const AdminMfaGuard: React.FC<AdminMfaGuardProps> = ({ user, children }) => {
  const { showAlert } = useUI();
  const [status, setStatus] = useState<AdminMfaStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [enrollment, setEnrollment] = useState<AdminMfaEnrollment | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [qrImageFailed, setQrImageFailed] = useState(false);

  const loadStatus = async () => {
    setIsLoading(true);
    try {
      const nextStatus = await getAdminMfaStatus(user);
      setStatus(nextStatus);
      if (!nextStatus.needsEnrollment) {
        setEnrollment(null);
        setSetupCode("");
      }
    } catch (error) {
      showAlert({
        title: "MFA kontrola selhala",
        message: `Nepodařilo se načíst stav MFA: ${String((error as Error)?.message || error)}`,
        variant: "danger",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, [user?.email, user?.role]);

  const handleStartEnrollment = async () => {
    setIsSaving(true);
    try {
      const result = await startAdminMfaEnrollment();
      setEnrollment(result);
      setQrImageFailed(false);
      showAlert({
        title: "MFA připraveno",
        message: "Naskenujte QR kód v authenticator aplikaci a ověřte první kód.",
        variant: "success",
      });
    } catch (error) {
      showAlert({
        title: "Založení MFA selhalo",
        message: `Nepodařilo se připravit MFA enrollment: ${String((error as Error)?.message || error)}`,
        variant: "danger",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyEnrollment = async () => {
    if (!enrollment || !setupCode.trim()) {
      showAlert({
        title: "Chybí kód",
        message: "Zadejte ověřovací kód z authenticator aplikace.",
        variant: "danger",
      });
      return;
    }

    setIsSaving(true);
    try {
      await verifyAdminMfaEnrollment({
        factorId: enrollment.factorId,
        code: setupCode,
      });
      setEnrollment(null);
      setSetupCode("");
      setQrImageFailed(false);
      await loadStatus();
      showAlert({
        title: "MFA aktivováno",
        message: "Admin účet má nyní ověřený MFA faktor.",
        variant: "success",
      });
    } catch (error) {
      showAlert({
        title: "Ověření selhalo",
        message: `Nepodařilo se ověřit MFA faktor: ${String((error as Error)?.message || error)}`,
        variant: "danger",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifySession = async () => {
    const factorId = status?.verifiedFactors[0]?.id;
    if (!factorId || !verifyCode.trim()) {
      showAlert({
        title: "Chybí kód",
        message: "Zadejte aktuální kód z authenticator aplikace.",
        variant: "danger",
      });
      return;
    }

    setIsSaving(true);
    try {
      await elevateAdminMfaSession({
        factorId,
        code: verifyCode,
      });
      setVerifyCode("");
      await loadStatus();
      showAlert({
        title: "Session ověřena",
        message: "Admin session byla povýšena na AAL2 a admin sekce se odemkla.",
        variant: "success",
      });
    } catch (error) {
      showAlert({
        title: "Ověření session selhalo",
        message: `Nepodařilo se ověřit admin session: ${String((error as Error)?.message || error)}`,
        variant: "danger",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !status) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm dark:border-slate-700/40 dark:bg-slate-900/80 dark:text-slate-300">
        Načítám stav admin MFA…
      </div>
    );
  }

  if (!status.required || (!status.needsEnrollment && !status.needsVerification)) {
    return <>{children}</>;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10">
        <h3 className="text-base font-bold text-amber-900 dark:text-amber-100">
          Admin MFA enforcement
        </h3>
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
          {statusLabel(status)}
        </p>
        <div className="mt-2 text-xs text-amber-700 dark:text-amber-300">
          Aktuální úroveň: {status.currentLevel ?? "neznámá"} • další úroveň:{" "}
          {status.nextLevel ?? "žádná"}
        </div>

        {status.needsEnrollment ? (
          <div className="mt-4 space-y-3">
            {!enrollment ? (
              <button
                onClick={() => void handleStartEnrollment()}
                disabled={isSaving}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:opacity-50"
              >
                {isSaving
                  ? "Připravuji…"
                  : status.unverifiedFactors.some((factor) => factor.factorType === "totp")
                    ? "Založit znovu QR kód"
                    : "Založit TOTP faktor"}
              </button>
            ) : (
              <div className="space-y-3 rounded-xl border border-amber-300 bg-white/80 p-4 dark:border-amber-500/30 dark:bg-slate-950/40">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  1. Naskenujte QR kód v authenticator aplikaci
                </div>
                {qrImageFailed ? (
                  <div
                    aria-label="QR kód pro admin MFA fallback"
                    className="flex h-44 w-44 items-center justify-center rounded-lg border border-slate-200 bg-white p-2"
                    dangerouslySetInnerHTML={{ __html: enrollment.qrCodeSvg }}
                  />
                ) : (
                  <img
                    alt="QR kód pro admin MFA"
                    src={buildQrCodeImageSrc(enrollment.qrCodeSvg)}
                    onError={() => setQrImageFailed(true)}
                    className="h-44 w-44 rounded-lg border border-slate-200 bg-white p-2"
                  />
                )}
                <div className="text-sm text-slate-700 dark:text-slate-300">
                  Záložní secret:{" "}
                  <code className="rounded bg-slate-100 px-1.5 py-1 dark:bg-slate-800">
                    {enrollment.secret}
                  </code>
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  2. Zadejte první 6místný kód
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    aria-label="Kód pro aktivaci admin MFA"
                    type="text"
                    inputMode="numeric"
                    value={setupCode}
                    onChange={(e) => setSetupCode(e.target.value.replace(/\s+/g, ""))}
                    placeholder="123456"
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                  />
                  <button
                    onClick={() => void handleVerifyEnrollment()}
                    disabled={isSaving}
                    className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                  >
                    {isSaving ? "Ověřuji…" : "Aktivovat MFA"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {status.needsVerification ? (
          <div className="mt-4 space-y-3 rounded-xl border border-amber-300 bg-white/80 p-4 dark:border-amber-500/30 dark:bg-slate-950/40">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              Potvrzení admin session
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Pro vstup do admin sekce zadejte aktuální kód z ověřené authenticator aplikace.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                aria-label="Kód pro ověření admin session"
                type="text"
                inputMode="numeric"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\s+/g, ""))}
                placeholder="123456"
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
              />
              <button
                onClick={() => void handleVerifySession()}
                disabled={isSaving}
                className="rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
              >
                {isSaving ? "Ověřuji…" : "Ověřit admin session"}
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
};
