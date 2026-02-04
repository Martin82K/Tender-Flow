import React from "react";
import { PublicLayout } from "./PublicLayout";
import { PublicHeader } from "./PublicHeader";

type LegalPageLayoutProps = {
  title: string;
  lead?: string;
  updatedAt: string;
  children: React.ReactNode;
};

export const LegalPageLayout: React.FC<LegalPageLayoutProps> = ({
  title,
  lead,
  updatedAt,
  children,
}) => {
  return (
    <PublicLayout>
      <PublicHeader variant="auth" />
      <main className="relative mx-auto w-full max-w-4xl px-4 py-10 md:py-16">
        <section className="rounded-[28px] border border-white/10 bg-gray-950/40 backdrop-blur p-6 md:p-10">
          <div className="flex flex-col gap-3">
            <p className="text-xs uppercase tracking-[0.2em] text-orange-300/80">
              Právní informace
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
              {title}
            </h1>
            {lead ? (
              <p className="text-white/70 leading-relaxed">{lead}</p>
            ) : null}
            <p className="text-xs text-white/50">
              Poslední aktualizace: {updatedAt}
            </p>
            <div className="mt-2 rounded-xl border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-xs text-orange-100/90">
              Tento dokument je návrh a vyžaduje právní revizi a doplnění
              firemních údajů.
            </div>
          </div>

          <div className="mt-8 space-y-6 text-sm md:text-base text-white/70 leading-relaxed">
            {children}
          </div>
        </section>
      </main>
    </PublicLayout>
  );
};
