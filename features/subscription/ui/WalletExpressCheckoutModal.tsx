import React, { useEffect, useMemo, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { AlertTriangle, Loader2, Wallet } from "lucide-react";
import {
  createSetupIntent,
  createSubscriptionFromPaymentMethod,
  formatBillingPrice,
} from "@/features/subscription/api";
import type { SubscriptionTier } from "@/types";
import { Modal } from "@/shared/ui/Modal";

type PaidTier = "starter" | "pro" | "enterprise";

interface WalletExpressCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  tier: PaidTier;
  billingPeriod: "monthly" | "yearly";
  onSuccess: () => Promise<void> | void;
}

interface WalletCheckoutFormProps {
  tier: PaidTier;
  billingPeriod: "monthly" | "yearly";
  setError: (message: string | null) => void;
  onSuccess: () => Promise<void> | void;
}

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

const WalletCheckoutForm: React.FC<WalletCheckoutFormProps> = ({
  tier,
  billingPeriod,
  setError,
  onSuccess,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);

    if (!stripe || !elements) {
      setError("Platební formulář se ještě načítá.");
      return;
    }

    setSubmitting(true);
    try {
      const confirmation = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
      });

      if (confirmation.error) {
        setError(confirmation.error.message || "Nepodařilo se potvrdit platební metodu.");
        return;
      }

      const paymentMethodId =
        typeof confirmation.setupIntent?.payment_method === "string"
          ? confirmation.setupIntent.payment_method
          : null;

      if (!paymentMethodId) {
        setError("Nepodařilo se získat platební metodu pro předplatné.");
        return;
      }

      const createResult = await createSubscriptionFromPaymentMethod({
        tier: tier as SubscriptionTier,
        billingPeriod,
        paymentMethodId,
      });

      if (!createResult.success) {
        setError(createResult.error || "Nepodařilo se vytvořit předplatné.");
        return;
      }

      if (createResult.requiresAction && createResult.paymentIntentClientSecret) {
        const authResult = await stripe.confirmCardPayment(
          createResult.paymentIntentClientSecret,
        );
        if (authResult.error) {
          setError(authResult.error.message || "Dodatečné ověření platby selhalo.");
          return;
        }
      }

      await onSuccess();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Došlo k neočekávané chybě.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <PaymentElement />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!stripe || !elements || submitting}
        className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all shadow-sm shadow-orange-500/20"
      >
        {submitting ? "Zpracovávám..." : "Potvrdit a aktivovat předplatné"}
      </button>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
        Apple Pay / Google Pay se zobrazí automaticky podle zařízení a prohlížeče.
      </p>
    </div>
  );
};

export const WalletExpressCheckoutModal: React.FC<WalletExpressCheckoutModalProps> = ({
  isOpen,
  onClose,
  tier,
  billingPeriod,
  onSuccess,
}) => {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceLabel = useMemo(
    () => formatBillingPrice(tier as SubscriptionTier, billingPeriod),
    [tier, billingPeriod],
  );

  useEffect(() => {
    if (!isOpen) {
      setClientSecret(null);
      setError(null);
      setLoading(false);
      return;
    }

    const loadSetupIntent = async () => {
      if (!stripePublishableKey || !stripePromise) {
        setError("Chybí VITE_STRIPE_PUBLISHABLE_KEY. Wallet checkout nelze inicializovat.");
        return;
      }

      setLoading(true);
      setError(null);
      const result = await createSetupIntent();
      if (!result.success || !result.clientSecret) {
        setError(result.error || "Nepodařilo se inicializovat peněženkovou platbu.");
      } else {
        setClientSecret(result.clientSecret);
      }
      setLoading(false);
    };

    void loadSetupIntent();
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Express checkout (beta)"
      description={`Tarif ${tier.toUpperCase()} • ${billingPeriod === "monthly" ? "měsíčně" : "ročně"} • ${priceLabel}`}
      size="md"
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-orange-200 dark:border-orange-900/40 bg-orange-50/70 dark:bg-orange-500/10 p-3.5 text-xs text-orange-800 dark:text-orange-300 flex items-start gap-2">
          <Wallet className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            Wallet checkout je ve fázi beta. Pokud vaše zařízení peněženku nepodporuje, použijte standardní Stripe Checkout.
          </span>
        </div>

        {loading && (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-xs">Inicializuji platební formulář...</span>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-500/10 p-3.5 text-xs text-red-700 dark:text-red-400 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!loading && clientSecret && stripePromise && (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: "stripe",
              },
            }}
          >
            <WalletCheckoutForm
              tier={tier}
              billingPeriod={billingPeriod}
              setError={setError}
              onSuccess={onSuccess}
            />
          </Elements>
        )}
      </div>
    </Modal>
  );
};
