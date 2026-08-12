import React, { useCallback, useRef, useState } from "react";

import { ConfirmationModal } from "@shared/ui/ConfirmationModal";

export interface PipelineConfirmationOptions {
  title: string;
  message: string;
  onConfirm: () => void;
}

interface PipelineConfirmationState extends PipelineConfirmationOptions {
  isOpen: boolean;
}

const initialState: PipelineConfirmationState = {
  isOpen: false,
  title: "",
  message: "",
  onConfirm: () => {},
};

export const usePipelineConfirmation = () => {
  const [confirmation, setConfirmation] =
    useState<PipelineConfirmationState>(initialState);
  const canConfirmRef = useRef(false);

  const requestConfirmation = useCallback(
    (options: PipelineConfirmationOptions) => {
      canConfirmRef.current = true;
      setConfirmation({ ...options, isOpen: true });
    },
    [],
  );

  const closeConfirmation = useCallback(() => {
    canConfirmRef.current = false;
    setConfirmation((current) => ({ ...current, isOpen: false }));
  }, []);

  const confirm = useCallback(() => {
    if (!canConfirmRef.current) return;
    canConfirmRef.current = false;
    setConfirmation((current) => ({ ...current, isOpen: false }));
    confirmation.onConfirm();
  }, [confirmation.onConfirm]);

  const confirmationModalNode = (
    <ConfirmationModal
      isOpen={confirmation.isOpen}
      title={confirmation.title}
      message={confirmation.message}
      onConfirm={confirm}
      onCancel={closeConfirmation}
      confirmLabel="Odstranit"
      variant="danger"
    />
  );

  return { confirmationModalNode, requestConfirmation };
};
