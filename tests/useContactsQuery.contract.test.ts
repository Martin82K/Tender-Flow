import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Subcontractor } from "@/types";

type QueryOptions = {
  queryKey: readonly unknown[];
  enabled: boolean;
  queryFn: () => Promise<Subcontractor[]>;
  staleTime: number;
};

const mocks = vi.hoisted(() => ({
  queryOptions: null as QueryOptions | null,
  from: vi.fn(),
  getContacts: vi.fn(),
  withRetry: vi.fn((operation: () => Promise<unknown>) => operation()),
  withTimeout: vi.fn((promise: Promise<unknown>) => promise),
  useAuth: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: QueryOptions) => {
    mocks.queryOptions = options;
    return { data: undefined, isLoading: false, error: null };
  },
}));

vi.mock("@infra/db/dbAdapter", () => ({
  dbAdapter: { from: mocks.from },
}));

vi.mock("@infra/demo/demoDataAdapter", () => ({
  demoDataAdapter: { getContacts: mocks.getContacts },
}));

vi.mock("@shared/async/asyncControl", () => ({
  withRetry: mocks.withRetry,
  withTimeout: mocks.withTimeout,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: mocks.useAuth,
}));

import {
  CONTACT_KEYS,
  useContactsQuery,
} from "@features/contacts/hooks/useContactsQuery";
import {
  CONTACT_KEYS as legacyContactKeys,
  useContactsQuery as legacyUseContactsQuery,
} from "@/hooks/queries/useContactsQuery";

describe("useContactsQuery contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryOptions = null;
    mocks.useAuth.mockReturnValue({
      user: { id: "user-1", role: "user" },
    });
    mocks.getContacts.mockReturnValue([]);
  });

  it("preserves query key, enablement, and five-minute stale time", () => {
    useContactsQuery({ userId: "user-1", userRole: "user" });

    expect(mocks.queryOptions?.queryKey).toEqual([
      ...CONTACT_KEYS.list(),
      "user-1",
    ]);
    expect(mocks.queryOptions?.enabled).toBe(true);
    expect(mocks.queryOptions?.staleTime).toBe(5 * 60 * 1000);

    useContactsQuery({ userId: undefined, userRole: undefined });
    expect(mocks.queryOptions?.enabled).toBe(false);
  });

  it("keeps the legacy no-argument adapter behavior", () => {
    legacyUseContactsQuery();

    expect(legacyContactKeys).toBe(CONTACT_KEYS);
    expect(mocks.queryOptions?.queryKey).toEqual([
      ...CONTACT_KEYS.list(),
      "user-1",
    ]);
    expect(mocks.queryOptions?.enabled).toBe(true);
  });

  it("returns demo contacts without touching the database", async () => {
    const contacts = [{ id: "demo-1", company: "Demo" }] as Subcontractor[];
    mocks.getContacts.mockReturnValue(contacts);

    useContactsQuery({ userId: "demo-user", userRole: "demo" });

    await expect(mocks.queryOptions?.queryFn()).resolves.toBe(contacts);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("starts contacts and ratings requests before either settles", async () => {
    let resolveContacts: (value: { data: unknown[]; error: null }) => void =
      () => undefined;
    let resolveRatings: (value: { data: unknown[]; error: null }) => void =
      () => undefined;
    const contactsPromise = new Promise<{ data: unknown[]; error: null }>(
      (resolve) => {
        resolveContacts = resolve;
      },
    );
    const ratingsPromise = new Promise<{ data: unknown[]; error: null }>(
      (resolve) => {
        resolveRatings = resolve;
      },
    );

    mocks.from.mockImplementation((table: string) => {
      if (table === "subcontractors") {
        return {
          select: () => ({
            order: () => ({ range: () => contactsPromise }),
          }),
        };
      }
      return {
        select: () => ({
          not: () => ({ not: () => ratingsPromise }),
        }),
      };
    });

    useContactsQuery({ userId: "user-1", userRole: "user" });
    const result = mocks.queryOptions?.queryFn();

    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual([
      "subcontractors",
      "contracts",
    ]);

    resolveContacts({ data: [], error: null });
    resolveRatings({ data: [], error: null });
    await expect(result).resolves.toEqual([]);
  });

  it("paginates contacts in 1000-row windows", async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => ({
      id: `contact-${index}`,
      company_name: `Firma ${index}`,
      specialization: [],
      contacts: [],
      status_id: "available",
    }));
    const secondPage = [
      {
        id: "contact-1000",
        company_name: "Firma 1000",
        specialization: [],
        contacts: [],
        status_id: "available",
      },
    ];
    const range = vi.fn((from: number) =>
      Promise.resolve({ data: from === 0 ? firstPage : secondPage, error: null }),
    );
    mocks.from.mockImplementation((table: string) =>
      table === "subcontractors"
        ? { select: () => ({ order: () => ({ range }) }) }
        : {
            select: () => ({
              not: () => ({
                not: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          },
    );

    useContactsQuery({ userId: "user-1", userRole: "user" });
    const contacts = await mocks.queryOptions?.queryFn();

    expect(range.mock.calls).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(contacts).toHaveLength(1001);
  });

  it("propagates contacts errors", async () => {
    const contactsError = new Error("contacts unavailable");
    mocks.from.mockImplementation((table: string) =>
      table === "subcontractors"
        ? {
            select: () => ({
              order: () => ({
                range: () => Promise.resolve({ data: null, error: contactsError }),
              }),
            }),
          }
        : {
            select: () => ({
              not: () => ({
                not: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          },
    );

    useContactsQuery({ userId: "user-1", userRole: "user" });

    await expect(mocks.queryOptions?.queryFn()).rejects.toBe(contactsError);
  });

  it("tolerates an optional ratings response error", async () => {
    mocks.from.mockImplementation((table: string) =>
      table === "subcontractors"
        ? {
            select: () => ({
              order: () => ({
                range: () =>
                  Promise.resolve({
                    data: [
                      {
                        id: "contact-1",
                        company_name: "Firma",
                        contacts: [],
                        specialization: [],
                        status_id: "available",
                      },
                    ],
                    error: null,
                  }),
              }),
            }),
          }
        : {
            select: () => ({
              not: () => ({
                not: () =>
                  Promise.resolve({ data: null, error: new Error("ratings") }),
              }),
            }),
          },
    );

    useContactsQuery({ userId: "user-1", userRole: "user" });

    await expect(mocks.queryOptions?.queryFn()).resolves.toEqual([
      expect.objectContaining({ id: "contact-1", company: "Firma" }),
    ]);
  });
});
