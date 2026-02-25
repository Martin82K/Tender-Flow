import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PublicHeader } from "@/features/public/ui/PublicHeader";

vi.mock("@/assets/logo.png", () => ({
  default: "logo.png",
}));

vi.mock("@/shared/routing/router", () => ({
  Link: ({
    to,
    children,
    ...rest
  }: {
    to: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useLocation: () => ({ pathname: "/login", search: "", hash: "" }),
  navigate: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    loginAsDemo: vi.fn(),
  }),
}));

describe("PublicHeader desktop drag region", () => {
  it("má drag region na headeru a no-drag na interaktivních prvcích", () => {
    const html = renderToStaticMarkup(<PublicHeader variant="auth" />);

    expect(html).toContain("-webkit-app-region:drag");
    expect(html).toContain("-webkit-app-region:no-drag");
    expect(html).toContain("Přihlásit se");
    expect(html).toContain("Spustit demo");
  });
});
