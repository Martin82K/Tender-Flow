import React from "react";
import { LegalCookies } from "@/features/public/ui/LegalCookies";
import { LegalImprint } from "@/features/public/ui/LegalImprint";
import { LegalPrivacy } from "@/features/public/ui/LegalPrivacy";
import { LegalTerms } from "@/features/public/ui/LegalTerms";

const legalPageByPath: Record<string, React.ReactNode> = {
  "/terms": <LegalTerms />,
  "/privacy": <LegalPrivacy />,
  "/cookies": <LegalCookies />,
  "/imprint": <LegalImprint />,
};

export const getLegalPage = (pathname: string): React.ReactNode | null => {
  return legalPageByPath[pathname] ?? null;
};
