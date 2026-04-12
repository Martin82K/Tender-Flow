import React from "react";
import logo from "@/assets/logo.png";
import { APP_VERSION } from "@/config/version";

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
    <div className="auth-card-wrap">
      <div className="auth-card-header">
        <img
          src={logo}
          alt="Tender Flow"
          className="auth-card-logo"
        />
        <h1 className="auth-card-title">{title}</h1>
        {subtitle ? (
          <p className="auth-card-subtitle">{subtitle}</p>
        ) : null}
        <div className="auth-card-accent" />
      </div>

      <div className="auth-card-body">
        {children}
      </div>

      <div className="auth-card-footer">
        <span className="auth-card-version">verze {APP_VERSION}</span>

        {registrationStatus !== undefined && registrationStatus !== null && (
          <div className="auth-card-reg-status">
            {registrationStatus.isOpen ? (
              <span className="auth-reg-badge auth-reg-open">
                <svg className="auth-reg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Registrace otevřena
              </span>
            ) : (
              <span className="auth-reg-badge auth-reg-closed">
                <svg className="auth-reg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
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
