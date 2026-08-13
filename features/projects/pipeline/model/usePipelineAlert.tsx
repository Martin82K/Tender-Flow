import React, { useCallback, useState } from "react";

import { AlertModal } from "@shared/ui/AlertModal";

export interface PipelineAlertOptions {
  title: string;
  message: string;
  variant?: "danger" | "info" | "success";
  copyableText?: string;
}

interface PipelineAlertState extends PipelineAlertOptions {
  isOpen: boolean;
  variant: "danger" | "info" | "success";
}

const initialState: PipelineAlertState = {
  isOpen: false,
  title: "",
  message: "",
  variant: "info",
};

export const usePipelineAlert = () => {
  const [alert, setAlert] = useState<PipelineAlertState>(initialState);

  const showAlert = useCallback((options: PipelineAlertOptions) => {
    setAlert({
      ...options,
      isOpen: true,
      variant: options.variant ?? "info",
    });
  }, []);

  const closeAlert = useCallback(() => {
    setAlert((current) => ({ ...current, isOpen: false }));
  }, []);

  const alertModalNode = (
    <AlertModal
      isOpen={alert.isOpen}
      title={alert.title}
      message={alert.message}
      variant={alert.variant === "danger" ? "error" : alert.variant}
      copyableText={alert.copyableText}
      onClose={closeAlert}
    />
  );

  return { alertModalNode, showAlert };
};
