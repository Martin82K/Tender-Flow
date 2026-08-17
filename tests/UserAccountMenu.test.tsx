import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  it("udrží panel uvnitř úzkého viewportu", async () => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 246 });

    render(
      <UserAccountMenu
        user={user}
        theme="dark"
        skin="space"
        onSetTheme={vi.fn()}
        onSetSkin={vi.fn()}
        uiScale={1.5}
        onSetUiScale={vi.fn()}
        onResetUiScale={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Uživatelské menu" });
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
      bottom: 48,
      height: 36,
      left: 198,
      right: 238,
      top: 12,
      width: 40,
      x: 198,
      y: 12,
      toJSON: () => ({}),
    });

    fireEvent.click(trigger);

    const panel = await screen.findByRole("menu");
    expect(panel).toHaveStyle({ left: "8px" });
    expect(panel.style.right).toBe("");

    Object.defineProperty(window, "innerWidth", { configurable: true, value: originalInnerWidth });
  });

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
    const modeGroup = await screen.findByRole("group", { name: "Režim" });
    const lightMode = within(modeGroup).getByRole("button", { name: "Světlý" });
    const darkMode = within(modeGroup).getByRole("button", { name: "Tmavý" });

    expect(darkMode).toHaveAttribute("aria-pressed", "true");
    expect(darkMode).toHaveAttribute("tabindex", "0");
    expect(lightMode).toHaveAttribute("aria-pressed", "false");
    expect(lightMode).toHaveAttribute("tabindex", "-1");

    fireEvent.click(lightMode);

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

    const scaleGroup = screen.getByRole("group", { name: "Velikost UI" });
    expect(within(scaleGroup).getAllByRole("button")).toHaveLength(3);
    for (const button of within(scaleGroup).getAllByRole("button")) {
      expect(button).toHaveClass("size-8");
      expect(button).not.toHaveClass("border");
      expect(button).toHaveAttribute("title");
    }

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
    const skinPicker = await screen.findByRole("combobox", { name: "Motiv" });
    fireEvent.click(skinPicker);
    fireEvent.click(screen.getByRole("option", { name: "Industrial" }));

    expect(onSetSkin).toHaveBeenCalledWith("industrial");
  });

  it("ponechá motiv jako listbox a režim nabídne jako sdílený segmented control", async () => {
    const onSetSkin = vi.fn();
    const onSetTheme = vi.fn();

    render(
      <UserAccountMenu
        user={user}
        theme="system"
        skin="classic"
        onSetTheme={onSetTheme}
        onSetSkin={onSetSkin}
        uiScale={1}
        onSetUiScale={vi.fn()}
        onResetUiScale={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Uživatelské menu" }));

    const skinPicker = await screen.findByRole("combobox", { name: "Motiv" });
    const modeGroup = screen.getByRole("group", { name: "Režim" });

    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(within(modeGroup).getAllByRole("button")).toHaveLength(3);
    expect(within(modeGroup).getByRole("button", { name: "Auto" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(skinPicker);
    expect(screen.getByRole("option", { name: "Botanica" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Nature" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: "Nature" }));
    fireEvent.click(within(modeGroup).getByRole("button", { name: "Tmavý" }));

    expect(onSetSkin).toHaveBeenCalledWith("nature");
    expect(onSetTheme).toHaveBeenCalledWith("dark");
  });

  it("ovládá sdílený segmented režim šipkami, Home a End", async () => {
    const onSetTheme = vi.fn();

    render(
      <UserAccountMenu
        user={user}
        theme="light"
        skin="botanica"
        onSetTheme={onSetTheme}
        onSetSkin={vi.fn()}
        uiScale={1}
        onSetUiScale={vi.fn()}
        onResetUiScale={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Uživatelské menu" }));
    const modeGroup = await screen.findByRole("group", { name: "Režim" });
    const lightMode = within(modeGroup).getByRole("button", { name: "Světlý" });
    const darkMode = within(modeGroup).getByRole("button", { name: "Tmavý" });
    const autoMode = within(modeGroup).getByRole("button", { name: "Auto" });

    lightMode.focus();
    fireEvent.keyDown(lightMode, { key: "ArrowRight" });
    expect(darkMode).toHaveFocus();
    fireEvent.keyDown(darkMode, { key: "End" });
    expect(autoMode).toHaveFocus();
    fireEvent.keyDown(autoMode, { key: "Home" });
    expect(lightMode).toHaveFocus();
    expect(onSetTheme).not.toHaveBeenCalled();
    fireEvent.click(lightMode);
    expect(onSetTheme).toHaveBeenCalledWith("light");
  });
});
