/**
 * Validates that a redirect URL points to a trusted domain.
 * Prevents open redirect attacks by checking the URL's hostname
 * against an allowlist of known safe domains.
 */

const ALLOWED_REDIRECT_HOSTS: string[] = [
  // GoPay payment gateway
  'gw.gopay.com',
  'gw.sandbox.gopay.com',
  'gate.gopay.cz',
  // Stripe Checkout (test i live mód, oba na stejném hostu)
  'checkout.stripe.com',
  // Google OAuth
  'accounts.google.com',
  // Microsoft OAuth
  'login.microsoftonline.com',
  'login.live.com',
  // App domains
  'tenderflow.cz',
  'www.tenderflow.cz',
];

const ALLOWED_REDIRECT_SUFFIXES: string[] = [
  // Vercel preview deployments
  '.vercel.app',
];

export function isRedirectUrlSafe(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Only allow HTTPS (except localhost for dev)
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
      return false;
    }

    const host = parsed.hostname.toLowerCase();

    if (ALLOWED_REDIRECT_HOSTS.includes(host)) return true;
    if (ALLOWED_REDIRECT_SUFFIXES.some((s) => host.endsWith(s))) return true;

    return false;
  } catch {
    return false;
  }
}
