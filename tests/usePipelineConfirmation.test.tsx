import React from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { usePipelineConfirmation } from "@features/projects/pipeline";

vi.mock("@shared/ui/ConfirmationModal", () => ({
  ConfirmationModal: (props: {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    variant: string;
    onConfirm: () => void;
    onCancel: () => void;
  }) => <div data-testid="confirmation-modal" {...props} />,
}));

type ConfirmationElement = React.ReactElement<{
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  variant: string;
  onConfirm: () => void;
  onCancel: () => void;
}>;

describe("usePipelineConfirmation", () => {
  it("zavře danger dialog a spustí potvrzenou akci právě jednou", () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() => usePipelineConfirmation());

    act(() => {
      result.current.requestConfirmation({
        title: "Odstranit nabídku",
        message: "Tato akce je nevratná.",
        onConfirm,
      });
    });

    const modal = result.current.confirmationModalNode as ConfirmationElement;
    expect(modal.props).toMatchObject({
      isOpen: true,
      title: "Odstranit nabídku",
      message: "Tato akce je nevratná.",
      confirmLabel: "Odstranit",
      variant: "danger",
    });

    act(() => {
      modal.props.onConfirm();
      modal.props.onConfirm();
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(
      (result.current.confirmationModalNode as ConfirmationElement).props.isOpen,
    ).toBe(false);
  });

  it("při zrušení zavře dialog bez spuštění akce", () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() => usePipelineConfirmation());

    act(() => {
      result.current.requestConfirmation({
        title: "Smazat poptávku",
        message: "Opravdu smazat?",
        onConfirm,
      });
    });
    const modal = result.current.confirmationModalNode as ConfirmationElement;

    act(() => modal.props.onCancel());

    expect(onConfirm).not.toHaveBeenCalled();
    expect(
      (result.current.confirmationModalNode as ConfirmationElement).props.isOpen,
    ).toBe(false);
  });
});
