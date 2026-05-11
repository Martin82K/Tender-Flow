import { afterEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import {
  CONTACTS_IMPORT_FETCH_TIMEOUT_MS,
  CONTACTS_IMPORT_MAX_FILE_BYTES,
  CONTACTS_IMPORT_MAX_ROWS,
  syncContactsFromUrl,
} from "../services/contactsImportService";

const makeResponse = (
  blob: Blob,
  options?: {
    headers?: HeadersInit;
    ok?: boolean;
    statusText?: string;
  },
): Response =>
  ({
    ok: options?.ok ?? true,
    statusText: options?.statusText ?? "OK",
    headers: new Headers(options?.headers),
    blob: vi.fn().mockResolvedValue(blob),
  }) as unknown as Response;

const makeXlsxBlob = (rows: Array<Record<string, string>>): Blob => {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Kontakty");
  const data = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new Blob([data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
};

describe("contactsImportService security controls", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("rejects non-HTTPS import URLs before fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncContactsFromUrl("http://example.com/contacts.csv");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Only HTTPS URLs");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects URLs with embedded credentials before fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncContactsFromUrl("https://user:secret@example.com/contacts.csv");

    expect(result.success).toBe(false);
    expect(result.error).toContain("embedded credentials");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aborts slow downloads with AbortController timeout", async () => {
    vi.useFakeTimers();
    let receivedSignal: AbortSignal | undefined;
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      receivedSignal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        receivedSignal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const pending = syncContactsFromUrl("https://example.com/contacts.csv");
    expect(receivedSignal).toBeDefined();
    expect(receivedSignal?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(CONTACTS_IMPORT_FETCH_TIMEOUT_MS);
    const result = await pending;

    expect(result.success).toBe(false);
    expect(result.error).toContain("timed out");
    expect(receivedSignal?.aborted).toBe(true);
  });

  it("rejects oversized Content-Length before reading the response body", async () => {
    const response = makeResponse(new Blob(["Firma\nAlpha"]), {
      headers: { "content-length": String(CONTACTS_IMPORT_MAX_FILE_BYTES + 1) },
    });
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncContactsFromUrl("https://example.com/contacts.csv");

    expect(result.success).toBe(false);
    expect(result.error).toContain("too large");
    expect(response.blob).not.toHaveBeenCalled();
  });

  it("rejects oversized blobs when Content-Length is absent", async () => {
    const oversizedBlob = new Blob([new Uint8Array(CONTACTS_IMPORT_MAX_FILE_BYTES + 1)], {
      type: "text/csv",
    });
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(oversizedBlob));
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncContactsFromUrl("https://example.com/contacts.csv");

    expect(result.success).toBe(false);
    expect(result.error).toContain("too large");
  });

  it("imports a valid CSV over HTTPS", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeResponse(
          new Blob(["Firma,Jméno,Email,Telefon\nAlpha s.r.o.,Jan Novak,jan@example.com,+420123"], {
            type: "text/csv",
          }),
        ),
      ),
    );

    const result = await syncContactsFromUrl("https://example.com/contacts.csv");

    expect(result.success).toBe(true);
    expect(result.contacts).toHaveLength(1);
    expect(result.contacts[0].company).toBe("Alpha s.r.o.");
    expect(result.contacts[0].email).toBe("jan@example.com");
  });

  it("rejects CSV files above the contact row limit", async () => {
    const rows = Array.from({ length: CONTACTS_IMPORT_MAX_ROWS + 1 }, (_, index) => {
      return `Company ${index},Kontakt ${index},kontakt${index}@example.com`;
    });
    const csv = `Firma,Jméno,Email\n${rows.join("\n")}`;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeResponse(new Blob([csv], { type: "text/csv" }))),
    );

    const result = await syncContactsFromUrl("https://example.com/contacts.csv");

    expect(result.success).toBe(false);
    expect(result.error).toContain(`Maximum is ${CONTACTS_IMPORT_MAX_ROWS} rows`);
  });

  it("rejects XLSX files above the contact row limit", async () => {
    const rows = Array.from({ length: CONTACTS_IMPORT_MAX_ROWS + 1 }, (_, index) => ({
      Firma: `Company ${index}`,
      Email: `kontakt${index}@example.com`,
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeResponse(makeXlsxBlob(rows))),
    );

    const result = await syncContactsFromUrl("https://example.com/contacts.xlsx");

    expect(result.success).toBe(false);
    expect(result.error).toContain(`Maximum is ${CONTACTS_IMPORT_MAX_ROWS} rows`);
  });
});
