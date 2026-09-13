import { strToU8, zipSync } from 'fflate';
import { loadPdfRuntime, registerRobotoFont } from '@shared/pdf/pdfRuntime';
import { documentFooter, documentSections, type DocumentSnapshot } from './model';

// Both formats consume the same immutable snapshot; no live organization/contact lookup during export.
export const exportDocumentPdf = async (snapshot: DocumentSnapshot): Promise<Uint8Array> => {
  const { jsPDF, RobotoRegularBase64 } = await loadPdfRuntime();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  registerRobotoFont(doc, RobotoRegularBase64);
  doc.setFont('Roboto', 'normal');
  doc.setTextColor(24, 31, 44);
  let y = 18;
  const ensure = (height: number) => { if (y + height > 271) { doc.addPage(); y = 18; } };
  const text = (value: string, size = 10) => {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(value, 174) as string[];
    for (const line of lines) { ensure(5); doc.text(line, 18, y); y += 5; }
  };
  if (snapshot.logo) {
    const logo = snapshot.logo;
    const scale = Math.min(42 / logo.width, 17 / logo.height);
    doc.addImage(logo.dataUrl, 'PNG', 18, y, logo.width * scale, logo.height * scale);
    y += 22;
  }
  text('PŘEDÁVACÍ PROTOKOL', 18);
  y += 5;
  text(`Předání díla subdodavatele · Verze ${snapshot.version}`, 9);
  y += 4;
  for (const section of documentSections(snapshot)) {
    ensure(15);
    text(section.title, 11);
    if (section.text) text(section.text);
    for (let row = 0; row < (section.handwritingLines || 0); row++) {
      ensure(8); y += 8; doc.setDrawColor(180, 186, 194); doc.line(18, y - 2, 192, y - 2);
    }
    y += 6;
  }
  ensure(32);
  y += 10;
  doc.setDrawColor(120, 128, 140);
  doc.line(18, y, 92, y); doc.line(118, y, 192, y);
  y += 5;
  doc.setFontSize(9);
  doc.text('Za organizaci', 18, y); doc.text('Za subdodavatele', 118, y);
  y += 5;
  // Long representatives wrap instead of extending into the other signature column.
  const left = doc.splitTextToSize(`${snapshot.fields.issuerRepresentative || 'Jméno'} · datum a podpis`, 74) as string[];
  const right = doc.splitTextToSize(`${snapshot.fields.vendorRepresentative || 'Jméno'} · datum a podpis`, 74) as string[];
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    ensure(5); if (left[i]) doc.text(left[i], 18, y); if (right[i]) doc.text(right[i], 118, y); y += 5;
  }
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); doc.setDrawColor(211, 215, 222); doc.line(18, 280, 192, 280);
    doc.setFontSize(8); doc.setTextColor(90, 100, 115);
    doc.text(documentFooter(snapshot), 18, 285);
    doc.text(`Strana ${page} / ${pages}`, 192, 290, { align: 'right' });
  }
  return new Uint8Array(doc.output('arraybuffer'));
};

const escapeXml = (value: string) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const run = (value: string) => `<w:r><w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r>`;
const paragraph = (value: string, style = '') => `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}<w:spacing w:after="80"/></w:pPr>${value.split('\n').map((line, i) => `${i ? '<w:r><w:br/></w:r>' : ''}${run(line)}`).join('')}</w:p>`;
const xmlHeader = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const wordNamespaces = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

export const exportDocumentDocx = async (snapshot: DocumentSnapshot): Promise<Uint8Array> => {
  const files: Record<string, Uint8Array> = {};
  const add = (name: string, xml: string) => { files[name] = strToU8(xmlHeader + xml); };
  let logoXml = '';
  if (snapshot.logo) {
    const raw = atob(snapshot.logo.dataUrl.split(',')[1]);
    files['word/media/logo.png'] = Uint8Array.from(raw, c => c.charCodeAt(0));
    const scale = Math.min(1512000 / snapshot.logo.width, 612000 / snapshot.logo.height);
    const cx = Math.round(snapshot.logo.width * scale); const cy = Math.round(snapshot.logo.height * scale);
    logoXml = `<w:p><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" name="Logo organizace"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="Logo organizace"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  }
  const content = documentSections(snapshot).map(section => paragraph(section.title, 'Heading1') + (section.text ? paragraph(section.text) : '') + Array.from({ length: section.handwritingLines || 0 }, () => '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="4" w:color="BAC0C8"/><w:between w:val="single" w:sz="4" w:color="BAC0C8"/></w:pBdr><w:spacing w:before="0" w:after="0" w:line="450" w:lineRule="exact"/></w:pPr><w:r><w:t> </w:t></w:r></w:p>').join('')).join('');
  const signatures = `<w:tbl><w:tblPr><w:tblW w:w="9864" w:type="dxa"/></w:tblPr><w:tblGrid><w:gridCol w:w="4932"/><w:gridCol w:w="4932"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr>${['Za organizaci\n' + (snapshot.fields.issuerRepresentative || 'Jméno'), 'Za subdodavatele\n' + (snapshot.fields.vendorRepresentative || 'Jméno')].map(t => `<w:tc><w:tcPr><w:tcW w:w="4932" w:type="dxa"/></w:tcPr>${paragraph('\n____________________________\n' + t + '\nDatum a podpis')}</w:tc>`).join('')}</w:tr></w:tbl>`;
  add('word/document.xml', `<w:document ${wordNamespaces}><w:body>${logoXml}${paragraph('PŘEDÁVACÍ PROTOKOL', 'Title')}${paragraph(`Předání díla subdodavatele · Verze ${snapshot.version}`)}${content}${signatures}<w:sectPr><w:footerReference w:type="default" r:id="rFooter"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1021" w:right="1021" w:bottom="1134" w:left="1021" w:header="400" w:footer="567"/></w:sectPr></w:body></w:document>`);
  add('word/footer1.xml', `<w:ftr ${wordNamespaces}>${paragraph(documentFooter(snapshot))}<w:p>${run('Strana ')}<w:fldSimple w:instr="PAGE"/>${run(' / ')}<w:fldSimple w:instr="NUMPAGES"/></w:p></w:ftr>`);
  add('word/styles.xml', `<w:styles ${wordNamespaces}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="20"/><w:lang w:val="cs-CZ"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:keepNext/><w:spacing w:before="160"/></w:pPr><w:rPr><w:b/><w:sz w:val="22"/></w:rPr></w:style></w:styles>`);
  const rel = (id: string, type: string, target: string) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;
  add('_rels/.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rDoc', 'officeDocument', 'word/document.xml')}</Relationships>`);
  add('word/_rels/document.xml.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rFooter', 'footer', 'footer1.xml')}${rel('rStyles', 'styles', 'styles.xml')}${snapshot.logo ? rel('rLogo', 'image', 'media/logo.png') : ''}</Relationships>`);
  add('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>' + ['document', 'styles', 'footer1'].map(name => `<Override PartName="/word/${name}.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${name === 'document' ? 'document.main' : name === 'footer1' ? 'footer' : 'styles'}+xml"/>`).join('') + '</Types>');
  return zipSync(files, { level: 6 });
};
