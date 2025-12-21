import React from "react";
import logo from "../../assets/logo.png";

export const AuthCard: React.FC<{
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, children }) => {
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

      <div className="mt-8 pt-6 border-t border-white/10 text-center">
        <span className="text-xs text-white/40">verze 0.9.2</span>
      </div>
    </div>
  );
};
