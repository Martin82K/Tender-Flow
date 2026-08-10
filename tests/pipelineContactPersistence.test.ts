import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Subcontractor } from "@/types";

const mocks = vi.hoisted(() => ({
  insertSubcontractor: vi.fn(),
  updateSubcontractor: vi.fn(),
}));

vi.mock("@/infra/projects/pipelineRepository", () => ({
  pipelineRepository: {
    insertSubcontractor: mocks.insertSubcontractor,
    updateSubcontractor: mocks.updateSubcontractor,
  },
}));

import {
  insertSubcontractor,
  updateSubcontractor,
} from "@/features/projects/api/pipelineApi";

const contact: Subcontractor = {
  id: "contact-1",
  company: "Bezpečná firma",
  specialization: ["Elektro"],
  contacts: [
    {
      id: "person-1",
      name: "Hlavní osoba",
      email: "primary@example.test",
      phone: "+420000000000",
      position: "Vedoucí",
    },
  ],
  ico: "12345678",
  region: "Praha",
  address: "Testovací 1",
  city: "Praha",
  web: "https://example.test",
  note: "Interní poznámka",
  regions: ["PHA"],
  status: "available",
};

describe("pipeline contact persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insertSubcontractor.mockResolvedValue({ data: null, error: null });
    mocks.updateSubcontractor.mockResolvedValue({ data: { id: contact.id }, error: null });
  });

  it.each([
    ["vytvoření", () => insertSubcontractor(contact, "org-1"), mocks.insertSubcontractor],
    ["editace", () => updateSubcontractor(contact), mocks.updateSubcontractor],
  ])("%s z Pipeline ukládá stejný úplný kontrakt", async (_label, action, repositoryCall) => {
    await action();

    const payload = repositoryCall === mocks.updateSubcontractor
      ? repositoryCall.mock.calls[0][1]
      : repositoryCall.mock.calls[0][0];
    expect(payload).toEqual(expect.objectContaining({
      contacts: contact.contacts,
      contact_person_name: "Hlavní osoba",
      email: "primary@example.test",
      phone: "+420000000000",
      address: "Testovací 1",
      city: "Praha",
      web: "https://example.test",
      note: "Interní poznámka",
      regions: ["PHA"],
    }));
    if (repositoryCall === mocks.insertSubcontractor) {
      expect(payload).toEqual(expect.objectContaining({ organization_id: "org-1" }));
    }
  });
});
