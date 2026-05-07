import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/types";
import { UserAccountMenu } from "@/shared/ui/UserAccountMenu";

const userProfileServiceMocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  getAvatarUrl: vi.fn(),
  uploadAvatar: vi.fn(),
}));

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  buildAppUrl: vi.fn(
    (
      view: string,
      opts?: { settingsTab?: string; settingsSubTab?: string },
    ) => `/app/${view}?tab=${opts?.settingsTab}&subTab=${opts?.settingsSubTab}`,
  ),
}));

const platformMocks = vi.hoisted(() => ({
  openUserManual: vi.fn(),
  quit: vi.fn(),
}));

vi.mock("@/services/userProfileService", () => ({
  userProfileService: userProfileServiceMocks,
}));

vi.mock("@/shared/routing/router", () => ({
  navigate: routerMocks.navigate,
}));

vi.mock("@/shared/routing/routeUtils", () => ({
  buildAppUrl: routerMocks.buildAppUrl,
}));

vi.mock("@/services/platformAdapter", () => ({
  isDesktop: false,
  platformAdapter: {
    platform: { os: "web" },
    app: {
      openUserManual: platformMocks.openUserManual,
      quit: platformMocks.quit,
    },
  },
}));

const user: User = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Martin Kalkuš",
  email: "martin@example.com",
  role: "admin",
  subscriptionTier: "admin",
  organizationName: "Stavby s.r.o.",
};

describe("UserAccountMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userProfileServiceMocks.getProfile.mockResolvedValue({
      displayName: "Martin Kalkuš",
      signatureName: null,
      signatureRole: null,
      signaturePhone: null,
      signaturePhoneSecondary: null,
      signatureEmail: null,
      signatureGreeting: null,
      avatarPath: "users/11111111-1111-4111-8111-111111111111/avatar.png",
    });
    userProfileServiceMocks.getAvatarUrl.mockResolvedValue("https://signed.example/avatar.png");
    userProfileServiceMocks.uploadAvatar.mockResolvedValue({
      avatarPath: "users/11111111-1111-4111-8111-111111111111/avatar.webp",
      avatarUrl: "https://signed.example/avatar.webp",
    });
  });

  it("zobrazuje účet v horním menu a naviguje do profilu", async () => {
    const { container } = render(
      <UserAccountMenu
        user={user}
        theme="dark"
        skin="industrial"
        onSetTheme={vi.fn()}
        onSetSkin={vi.fn()}
        uiScale={1}
        onSetUiScale={vi.fn()}
        onResetUiScale={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector('img[src="https://signed.example/avatar.png"]')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Uživatelské menu" }));

    expect(await screen.findByText("Martin Kalkuš")).toBeInTheDocument();
    expect(screen.getByText("martin@example.com")).toBeInTheDocument();
    expect(screen.getByText("Správce · Admin tarif")).toBeInTheDocument();
    expect(screen.queryByText("BOSS")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Můj profil"));

    expect(routerMocks.buildAppUrl).toHaveBeenCalledWith("settings", {
      settingsTab: "user",
      settingsSubTab: "profile",
    });
    expect(routerMocks.navigate).toHaveBeenCalledWith("/app/settings?tab=user&subTab=profile");
  });

  it("přepíná téma přímo z menu", async () => {
    const onSetTheme = vi.fn();

    const { container } = render(
      <UserAccountMenu
        user={user}
        theme="dark"
        skin="industrial"
        onSetTheme={onSetTheme}
        onSetSkin={vi.fn()}
        uiScale={1}
        onSetUiScale={vi.fn()}
        onResetUiScale={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector('img[src="https://signed.example/avatar.png"]')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Uživatelské menu" }));
    fireEvent.click(await screen.findByText("Světlý"));

    expect(onSetTheme).toHaveBeenCalledWith("light");
  });

  it("umožní zmenšit, zvětšit a resetovat velikost UI", async () => {
    const onSetUiScale = vi.fn();
    const onResetUiScale = vi.fn();

    const { container } = render(
      <UserAccountMenu
        user={user}
        theme="system"
        skin="industrial"
        onSetTheme={vi.fn()}
        onSetSkin={vi.fn()}
        uiScale={0.9}
        onSetUiScale={onSetUiScale}
        onResetUiScale={onResetUiScale}
        onLogout={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector('img[src="https://signed.example/avatar.png"]')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Uživatelské menu" }));

    expect(await screen.findByText("Velikost UI")).toBeInTheDocument();
    expect(screen.getByText("90 %")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Zmenšit UI" }));
    fireEvent.click(screen.getByRole("button", { name: "Zvětšit UI" }));
    fireEvent.click(screen.getByRole("button", { name: "Resetovat velikost UI na 100 %" }));

    expect(onSetUiScale).toHaveBeenNthCalledWith(1, 0.8);
    expect(onSetUiScale).toHaveBeenNthCalledWith(2, 1);
    expect(onResetUiScale).toHaveBeenCalled();
  });

  it("nahrává avatar přes validovaný service layer", async () => {
    const { container } = render(
      <UserAccountMenu
        user={user}
        theme="system"
        skin="industrial"
        onSetTheme={vi.fn()}
        onSetSkin={vi.fn()}
        uiScale={1}
        onSetUiScale={vi.fn()}
        onResetUiScale={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector('img[src="https://signed.example/avatar.png"]')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Uživatelské menu" }));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: {
        files: [new File(["avatar"], "avatar.webp", { type: "image/webp" })],
      },
    });

    await waitFor(() => {
      expect(userProfileServiceMocks.uploadAvatar).toHaveBeenCalledWith(
        user.id,
        expect.any(File),
      );
    });
    expect(await screen.findByText("Avatar uložen.")).toBeInTheDocument();
  });

  it("na webu odhlašuje bez desktop potvrzení", async () => {
    const onLogout = vi.fn();

    const { container } = render(
      <UserAccountMenu
        user={user}
        theme="system"
        skin="industrial"
        onSetTheme={vi.fn()}
        onSetSkin={vi.fn()}
        uiScale={1}
        onSetUiScale={vi.fn()}
        onResetUiScale={vi.fn()}
        onLogout={onLogout}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector('img[src="https://signed.example/avatar.png"]')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Uživatelské menu" }));
    fireEvent.click(await screen.findByText("Odhlásit se"));

    expect(onLogout).toHaveBeenCalled();
  });

  it("přepíná skin přímo z menu", async () => {
    const onSetSkin = vi.fn();

    const { container } = render(
      <UserAccountMenu
        user={user}
        theme="system"
        skin="classic"
        onSetTheme={vi.fn()}
        onSetSkin={onSetSkin}
        uiScale={1}
        onSetUiScale={vi.fn()}
        onResetUiScale={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector('img[src="https://signed.example/avatar.png"]')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Uživatelské menu" }));
    fireEvent.click(await screen.findByText("Industrial"));

    expect(onSetSkin).toHaveBeenCalledWith("industrial");
  });
});
