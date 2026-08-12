import React from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { usePipelineAlert } from "@features/projects/pipeline";

vi.mock("@shared/ui/AlertModal", () => ({
  AlertModal: (props: {
    isOpen: boolean;
    title: string;
    message: string;
    variant: string;
    copyableText?: string;
    onClose: () => void;
  }) => <div data-testid="alert-modal" {...props} />,
}));

describe("usePipelineAlert", () => {
  it("zobrazí danger alert jako error a zachová copyable text", () => {
    const { result } = renderHook(() => usePipelineAlert());

    act(() => {
      result.current.showAlert({
        title: "Chyba",
        message: "Operace selhala",
        variant: "danger",
        copyableText: "ERR-42",
      });
    });

    const modal = result.current.alertModalNode as React.ReactElement<{
      isOpen: boolean;
      title: string;
      message: string;
      variant: string;
      copyableText?: string;
      onClose: () => void;
    }>;
    expect(modal.props).toMatchObject({
      isOpen: true,
      title: "Chyba",
      message: "Operace selhala",
      variant: "error",
      copyableText: "ERR-42",
    });

    act(() => modal.props.onClose());
    expect(
      (result.current.alertModalNode as React.ReactElement<{ isOpen: boolean }>).props
        .isOpen,
    ).toBe(false);
  });
});
