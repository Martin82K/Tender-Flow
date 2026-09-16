import { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";

const INTER_STYLESHEET =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap";

export const useInterFont = (): void => {
  const [handle] = useState(() => delayRender("Inter font"));

  useEffect(() => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      continueRender(handle);
    };

    const existing = document.head.querySelector(`link[href="${INTER_STYLESHEET}"]`);
    const link = existing instanceof HTMLLinkElement ? existing : document.createElement("link");
    link.rel = "stylesheet";
    link.href = INTER_STYLESHEET;
    if (!existing) {
      document.head.appendChild(link);
    }

    const ready = () => {
      void document.fonts.ready.then(finish);
    };

    if (existing) {
      ready();
    } else {
      link.addEventListener("load", ready, { once: true });
      link.addEventListener("error", finish, { once: true });
    }

    const timeout = window.setTimeout(finish, 4000);
    return () => {
      window.clearTimeout(timeout);
      finish();
    };
  }, [handle]);
};
