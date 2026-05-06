const ADMIN_EMAILS: readonly string[] = [
  "martinkalkus82@gmail.com",
  "kalkus@baustav.cz",
];

export const isUserAdmin = (email: string | undefined): boolean => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email);
};
