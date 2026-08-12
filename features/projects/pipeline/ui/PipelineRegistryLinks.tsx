import React from "react";

import { isDesktop, shellAdapter } from "@infra/platform/platformAdapter";
import { isBlankRegistrationValue } from "@features/projects/pipeline/model/pipelineContactFormModel";

export interface PipelineRegistryLinksProps {
  ico?: string | null;
}

const createRegistryLinks = (ico: string) => {
  const encodedIco = encodeURIComponent(ico.trim());

  return [
    {
      label: "ARES",
      url: `https://ares.gov.cz/ekonomicke-subjekty?ico=${encodedIco}`,
    },
    {
      label: "RŽP",
      url: `https://rzp.gov.cz/portal/cs/vyhledani?q=${encodedIco}`,
    },
    {
      label: "RES",
      url: `https://or.justice.cz/ias/ui/rejstrik-$firma?ico=${encodedIco}`,
    },
  ] as const;
};

export const PipelineRegistryLinks: React.FC<PipelineRegistryLinksProps> = ({
  ico,
}) => {
  if (!ico || isBlankRegistrationValue(ico)) return null;

  const registryLinks = createRegistryLinks(ico);

  const openRegistry = (
    event: React.MouseEvent<HTMLAnchorElement>,
    url: string,
  ) => {
    event.stopPropagation();
    if (!isDesktop) return;

    event.preventDefault();
    void shellAdapter.openExternal(url).catch((error: unknown) => {
      console.warn("Nepodařilo se otevřít odkaz:", error);
      window.open(url, "_blank", "noopener,noreferrer");
    });
  };

  return (
    <div className="col-span-2 flex items-center gap-1.5">
      <span className="mr-1 text-[11px] text-slate-400 dark:text-slate-500">
        Rejstříky:
      </span>
      {registryLinks.map((link) => (
        <a
          key={link.label}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => openRegistry(event, link.url)}
          className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600 transition-colors hover:bg-blue-100 hover:text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 dark:hover:text-blue-300"
        >
          {link.label}
          <span className="material-symbols-outlined text-[12px]">
            open_in_new
          </span>
        </a>
      ))}
    </div>
  );
};
