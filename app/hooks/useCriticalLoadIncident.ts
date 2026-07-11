import { useEffect, useRef, useState } from "react";

import {
  APP_CORE_DATA_LOAD_ERROR_CODE,
  APP_CORE_DATA_LOAD_ERROR_MESSAGE,
} from "@/shared/errors/appLoadError";
import { logIncident } from "@/services/incidentLogger";

export interface CriticalLoadIncident {
  errorCode: typeof APP_CORE_DATA_LOAD_ERROR_CODE;
  incidentId: string | null;
  userMessage: typeof APP_CORE_DATA_LOAD_ERROR_MESSAGE;
}

export const useCriticalLoadIncident = (
  diagnosticMessage: string | null | undefined,
): CriticalLoadIncident | null => {
  const normalizedMessage = diagnosticMessage?.trim() || null;
  const lastLoggedMessageRef = useRef<string | null>(null);
  const [incidentId, setIncidentId] = useState<string | null>(null);

  useEffect(() => {
    if (!normalizedMessage) {
      lastLoggedMessageRef.current = null;
      setIncidentId(null);
      return;
    }

    if (lastLoggedMessageRef.current === normalizedMessage) return;
    lastLoggedMessageRef.current = normalizedMessage;
    setIncidentId(null);

    let active = true;
    void logIncident({
      severity: "error",
      source: "react-query",
      category: "network",
      code: APP_CORE_DATA_LOAD_ERROR_CODE,
      message: `Core application data loading failed: ${normalizedMessage}`,
      context: {
        operation: "app.core_data_load",
        reason: "multiple_core_queries_failed",
        action_status: "error",
      },
    })
      .then((result) => {
        if (active) setIncidentId(result.incidentId);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [normalizedMessage]);

  if (!normalizedMessage) return null;
  return {
    errorCode: APP_CORE_DATA_LOAD_ERROR_CODE,
    incidentId,
    userMessage: APP_CORE_DATA_LOAD_ERROR_MESSAGE,
  };
};
