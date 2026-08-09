import type jsPDF from "jspdf";

export type PdfRuntime = {
  RobotoRegularBase64: string;
  autoTable: typeof import("jspdf-autotable").default;
  jsPDF: typeof import("jspdf").default;
};

let pdfRuntimePromise: Promise<PdfRuntime> | null = null;

export const loadPdfRuntime = (): Promise<PdfRuntime> => {
  if (!pdfRuntimePromise) {
    pdfRuntimePromise = Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
      import("@/fonts/roboto-regular"),
    ])
      .then(([jsPdfModule, autoTableModule, fontModule]) => ({
        RobotoRegularBase64: fontModule.RobotoRegularBase64,
        autoTable: autoTableModule.default,
        jsPDF: jsPdfModule.default,
      }))
      .catch((error: unknown) => {
        pdfRuntimePromise = null;
        throw error;
      });
  }

  return pdfRuntimePromise;
};

export const registerRobotoFont = (
  doc: jsPDF,
  robotoRegularBase64: string,
): void => {
  doc.addFileToVFS("Roboto-Regular.ttf", robotoRegularBase64);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal", "Identity-H");
  doc.addFont("Roboto-Regular.ttf", "Roboto", "bold", "Identity-H");
};
