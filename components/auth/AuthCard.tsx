import React from "react";
import logo from "../../assets/logo.png";

interface RegistrationStatus {
  isOpen: boolean;
  allowedDomains: string[];
}

export const AuthCard: React.FC<{
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  registrationStatus?: RegistrationStatus | null;
}> = ({ title, subtitle, children, registrationStatus }) => {
  return (
    <div className="w-full max-w-lg mx-auto px-4 py-12">
      <div className="flex flex-col items-center text-center mb-8">
        <img
          src={logo}
          alt="Tender Flow"
          className="w-28 h-28 object-contain drop-shadow-2xl"
        />
        <h1 className="mt-4 text-3xl font-light text-white tracking-wide">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 text-sm text-white/60">{subtitle}</p>
        ) : null}
        <div className="h-1 w-24 bg-orange-500 mx-auto rounded-full mt-5" />
      </div>

      <div className="rounded-2xl border border-white/10 bg-gray-950/40 backdrop-blur px-6 py-6 sm:px-8 sm:py-8 shadow-xl shadow-black/30">
        {children}
      </div>

      <div className="mt-8 pt-6 border-t border-white/10 text-center space-y-2">
        <span className="text-xs text-white/40">verze 0.9.3-253112</span>

        {registrationStatus !== undefined && registrationStatus !== null && (
          <div className="flex flex-col items-center gap-1">
            {registrationStatus.isOpen ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Registrace otevřena
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30">
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                Registrace povolena pouze pro klienty
              </span>
            )}

          </div>
        )}
      </div>
    </div>
  );
};
