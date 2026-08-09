import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

const contactsSource = readSource("features/contacts/Contacts.tsx");
const filterBarSource = readSource("shared/ui/contacts/ContactsFilterBar.tsx");
const cardsSource = readSource("features/contacts/ui/SubcontractorCardsView.tsx");
const css = readSource("index.css");

describe("Contacts skin integration", () => {
  it("sjednocuje režimy, globální hledání a akce do jednoho toolbaru", () => {
    expect(contactsSource).toContain('data-help-id="contacts-toolbar"');
    expect(contactsSource).toContain("tf-contacts-toolbar");
    expect(contactsSource).toContain("<HeaderGlobalSearch />");
    expect(contactsSource).toContain("showSearch={false}");
    expect(contactsSource).toContain("tf-contacts-view-switcher");
    expect(contactsSource).toContain("tf-contacts-secondary-action");
    expect(contactsSource).toContain("tf-contacts-primary-action");
  });

  it("nepoužívá prezentační modrou mimo centrální skin tokeny", () => {
    expect(contactsSource).not.toMatch(/(?:bg|text|border|hover:bg|hover:text)-blue-/);
    expect(filterBarSource).not.toMatch(/(?:bg|text|border|accent)-blue-/);
    expect(cardsSource).not.toMatch(/(?:bg|text|border)-blue-/);
  });

  it("mapuje kontaktní povrchy, stavy a focus přes společné skin tokeny", () => {
    expect(filterBarSource).toContain("tf-contacts-filterbar");
    expect(cardsSource).toContain("tf-contact-card");
    expect(css).toContain(".tf-contacts-toolbar {");
    expect(css).toContain(".tf-contacts-view-tab[data-active=\"true\"]");
    expect(css).toContain(".tf-contact-card[data-selected=\"true\"]");
    expect(css).toContain("background: var(--tf-contacts-material)");
    expect(css).toContain("outline: 2px solid var(--tf-skin-accent)");
    expect(css).toContain("@media (prefers-contrast: more)");
  });
});
