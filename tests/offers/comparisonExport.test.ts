import { afterEach, expect, it, vi } from 'vitest';
import type ExcelJS from 'exceljs';
import { exportComparisonXlsx, exportComparisonPdf } from '../../features/projects/offers/api/comparisonExport';
const captured=vi.hoisted(()=>({books:[] as unknown[],table:vi.fn()}));
vi.mock('exceljs',async(importOriginal)=>{
 const actual=await importOriginal<typeof import('exceljs')>();
 return {default:{...actual.default,Workbook:class extends actual.default.Workbook{constructor(){super();captured.books.push(this);vi.spyOn(this.xlsx,'writeBuffer').mockResolvedValue(new ArrayBuffer(0));}}}};
});
vi.mock('@shared/pdf/pdfRuntime',()=>({loadPdfRuntime:async()=>({jsPDF:class{setFont(){}setFontSize(){}text(){}addPage(){}save(){}},autoTable:captured.table,RobotoRegularBase64:''}),registerRobotoFont:vi.fn()}));
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});
it('exports line-level qualifications with source references to XLSX and PDF',async()=>{
 const item={id:'a',code:'1',description:'Malba',group:'',unit:'m2',quantity:'1',unitPrice:'10',total:'10',source:{sheet:'List',row:2}};
 const doc={schemaVersion:1 as const,sources:[{id:'base',name:'Poptávka',sha256:'a'.repeat(64),origin:'file' as const,items:[{...item,note:'Včetně materiálu'}],notes:[]},{id:'offer',name:'Nabídka',sha256:'b'.repeat(64),origin:'file' as const,items:[{...item,id:'b',note:'Bez materiálu'},{...item,id:'extra',note:'Alternativní provedení'}],notes:[]}],assignments:{offer:[{baseId:'a',offerId:'b',status:'manual' as const}]}};
 vi.stubGlobal('URL',class{static createObjectURL(){return 'blob:test';}static revokeObjectURL(){}});vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});vi.useFakeTimers();
 await exportComparisonXlsx(doc,'Test');const book=captured.books.at(-1) as ExcelJS.Workbook;const notes=JSON.stringify(book.getWorksheet('Zdroje a výhrady')?.getSheetValues());
 expect(notes).toContain('Včetně materiálu');expect(notes).toContain('Bez materiálu');expect(notes).toContain('Alternativní provedení');expect(notes).toContain('List:2');
 await exportComparisonPdf(doc,'Test');const pdf=JSON.stringify(captured.table.mock.calls);expect(pdf).toContain('Bez materiálu');expect(pdf).toContain('Alternativní provedení');expect(pdf).toContain('List:2');
 vi.runAllTimers();
});
