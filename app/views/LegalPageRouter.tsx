import React from "react";
import { LegalCookies } from "@/features/public/ui/LegalCookies";
import { LegalDpa } from "@/features/public/ui/LegalDpa";
import { LegalImprint } from "@/features/public/ui/LegalImprint";
import { LegalPrivacy } from "@/features/public/ui/LegalPrivacy";
import { LegalTerms } from "@/features/public/ui/LegalTerms";

const legalPageByPath: Record<string, React.ReactNode> = {
  "/terms": <LegalTerms />,
  "/privacy": <LegalPrivacy />,
  "/cookies": <LegalCookies />,
  "/dpa": <LegalDpa />,
  "/imprint": <LegalImprint />,
};

export const getLegalPage = (pathname: string): React.ReactNode | null => {
  return legalPageByPath[pathname] ?? null;
};
