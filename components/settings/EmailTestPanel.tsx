import React, { useState } from "react";
import { emailService } from "../../services/emailService";
import { useUI } from "../../context/UIContext";
import { useAuth } from "../../context/AuthContext";

export const EmailTestPanel: React.FC = () => {
  const { user } = useAuth();
  const { showAlert } = useUI();
  const [isSending, setIsSending] = useState(false);
  const [testEmail, setTestEmail] = useState(user?.email || "");

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail) return;

    setIsSending(true);
    try {
      await emailService.sendTransactional(
        testEmail,
        "Testovací email ze Zuppa Base",
        `
                <h1>Test emailu funguje!</h1>
                <p>Toto je zkušební zpráva pro ověření integrace s Resend.</p>
                <hr />
                <p><small>Odesláno z Zuppa Base</small></p>
                `,
      );
      showAlert({
        title: "Odesláno",
        message: "Testovací email byl úspěšně odeslán.",
        variant: "success",
      });
    } catch (error: any) {
      console.error("Test email failed:", error);
      showAlert({
        title: "Chyba",
        message: `Odeslání selhalo: ${error.message}`,
        variant: "danger",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
        Test odesílání emailů
      </h3>
      <form onSubmit={handleSendTest} className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="text-xs text-slate-500 mb-1 block">
            Email příjemce
          </label>
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 px-3 py-2 text-sm text-slate-900 dark:text-white"
            placeholder="vas@email.cz"
            required
          />
        </div>
        <button
          type="submit"
          disabled={isSending}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isSending ? "Odesílání..." : "Odeslat test"}
        </button>
      </form>
      <p className="text-xs text-slate-500">
        Ověří funkčnost Edge Function `send-email` a nastavení Resend API klíče.
      </p>
    </div>
  );
};
