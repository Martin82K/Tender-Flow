import React from "react";
import { FolderOpen, Zap, Shield } from "lucide-react";

export interface WhatsNewItem {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export const desktopWelcomeConfig = {
  header: {
    titleStart: "Vítejte v",
    titleHighlight: "Tender Flow",
    subtitle: "Šetříme čas, budujeme přehled, sjednocujeme data.",
  },
  whatsNewSectionTitle: "Co je nového",
  whatsNew: [
    {
      icon: <FolderOpen className="w-5 h-5 text-amber-500" />,
      title: "Přímý přístup k složkám",
      description: "Pracujte přímo s lokálními složkami.",
    },
    {
      icon: <Zap className="w-5 h-5 text-orange-500" />,
      title: "Nástroje pro Excel",
      description: "Přímo na vašem počítači.",
    },
    {
      icon: <Shield className="w-5 h-5 text-amber-600" />,
      title: "Bezpečné uložení",
      description: "Vaše data a hesla zůstávají v bezpečí vašeho zařízení.",
    },
  ] as WhatsNewItem[],
};
