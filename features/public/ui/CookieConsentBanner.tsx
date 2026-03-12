import React, { useEffect, useState } from "react";
import {
  getCookieConsentDecision,
  setCookieConsentDecision,
  type CookieConsentDecision,
} from "@/shared/privacy/cookieConsent";

const shouldShowCookieBanner = (): boolean => {
  if (typeof window === "undefined") return false;
  if (window.location.protocol === "file:") return false;
  return getCookieConsentDecision() === null;
};

export const CookieConsentBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(shouldShowCookieBanner());
  }, []);

  const handleDecision = (decision: CookieConsentDecision) => {
    setCookieConsentDecision(decision);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] border-t border-slate-200 bg-white/95 px-4 py-4 shadow-2xl backdrop-blur dark:border-slate-700 dark:bg-slate-950/95">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="max-w-3xl">
          <div className="text-sm font-bold text-slate-900 dark:text-white">
            Nastavení cookies
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Tender Flow používá nezbytné cookies pro bezpečný provoz. Nepovinné
            analytické cookies zapneme až po tvém souhlasu. Podrobnosti jsou v{" "}
            <a
              href="/cookies"
              className="font-semibold text-cyan-700 underline underline-offset-2 dark:text-cyan-300"
            >
              zásadách cookies
            </a>
            .
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => handleDecision("essential_only")}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Jen nezbytné
          </button>
          <button
            onClick={() => handleDecision("accepted_all")}
            className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500"
          >
            Přijmout vše
          </button>
        </div>
      </div>
    </div>
  );
};
