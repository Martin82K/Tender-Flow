import React, { useState } from 'react';

interface SubscriptionRequiredViewProps {
  verificationError?: boolean;
  onRefresh: () => Promise<void>;
  onLogout: () => Promise<void>;
}

/** Recovery stays outside AppContent: no project queries, realtime or backups. */
export const SubscriptionRequiredView: React.FC<SubscriptionRequiredViewProps> = ({ onRefresh, onLogout, verificationError }) => {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const refresh = async () => {
    setBusy(true);
    setMessage('');
    try {
      await onRefresh();
      setMessage('Ověření dokončeno. Pokud přístup zůstává uzamčený, kontaktujte správce své firmy.');
    } catch {
      setMessage('Předplatné se nepodařilo ověřit. Zkontrolujte připojení a zkuste to znovu.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm">
        <p className="text-sm font-semibold text-slate-500 mb-3">Tender Flow</p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{verificationError ? 'Přístup se nepodařilo ověřit' : 'Předplatné není aktivní'}</h1>
        <p className="mt-4 text-slate-600 dark:text-slate-300">{verificationError ? 'Zkontrolujte připojení a zkuste předplatné ověřit znovu.' : 'Pro práci v aplikaci potřebujete platné předplatné. Bezplatný účet není k dispozici.'}</p>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Po obnovení předplatného se přístup vrátí. Zablokování přístupu nemaže vaše data. Obnovení domluvte se správcem své firmy nebo s naší podporou.</p>
        <div className="mt-6 flex flex-col gap-3">
          <a href="mailto:martin@tenderflow.cz?subject=Obnoven%C3%AD%20p%C5%99edplatn%C3%A9ho%20Tender%20Flow" className="rounded-xl bg-emerald-600 px-4 py-3 text-center font-semibold text-white hover:bg-emerald-700">Kontaktovat podporu</a>
          <button type="button" disabled={busy} onClick={() => void refresh()} className="rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-3 text-slate-900 dark:text-white disabled:opacity-50">{busy ? 'Ověřuji předplatné…' : 'Znovu ověřit předplatné'}</button>
          <button type="button" onClick={() => void onLogout()} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300">Odhlásit se</button>
        </div>
        <p role="status" className="mt-4 text-sm text-slate-600 dark:text-slate-300">{message}</p>
      </section>
    </main>
  );
};
