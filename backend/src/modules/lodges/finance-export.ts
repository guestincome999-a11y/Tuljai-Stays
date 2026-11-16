import { join } from 'node:path';

import PDFDocument from 'pdfkit';

export async function financeExport(
  title: string,
  context: string,
  headings: string[],
  rows: string[][],
  format = 'pdf',
) {
  const generated = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  if (format === 'csv') {
    const cell = (v: string) =>
      `"${(/^\s*[=+\-@\t\r]/.test(v) ? "'" : '') + v.replace(/"/g, '""')}"`;
    const csv = [
      ['Tuljai Stays', title],
      ['Generated (IST)', generated],
      [context],
      headings,
      ...rows,
    ]
      .map((r) => r.map(cell).join(','))
      .join('\r\n');
    return {
      filename: `tuljai-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`,
      base64: Buffer.from('\uFEFF' + csv).toString('base64'),
      mimeType: 'text/csv',
    };
  }
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 32, bufferPages: true });
  const fonts = join(__dirname, '../operations/report-assets/assets/fonts');
  doc.registerFont('sans', join(fonts, 'DejaVuSans.ttf'));
  doc.registerFont('bold', join(fonts, 'DejaVuSans-Bold.ttf'));
  const chunks: Buffer[] = [];
  const output = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  const width = doc.page.width - 64,
    col = width / headings.length;
  const header = () => {
    doc.fillColor('#861632').font('bold').fontSize(18).text('Tuljai Stays');
    doc.fontSize(13).text(title);
    doc
      .fillColor('#555555')
      .font('sans')
      .fontSize(8)
      .text(`Generated (IST): ${generated}`)
      .text(context);
    doc.moveDown();
  };
  const row = (values: string[], bold = false) => {
    doc.font(bold ? 'bold' : 'sans').fontSize(8);
    const height = Math.max(
      24,
      ...values.map((v) => doc.heightOfString(v, { width: col - 10 }) + 12),
    );
    if (doc.y + height > doc.page.height - 45) {
      doc.addPage();
      header();
      row(headings, true);
    }
    doc.font(bold ? 'bold' : 'sans').fontSize(8);
    const y = doc.y;
    values.forEach((v, i) => {
      doc.fillColor(bold ? '#861632' : '#20232b').text(v, 32 + i * col, y + 5, { width: col - 10 });
    });
    doc
      .strokeColor('#eadfdf')
      .moveTo(32, y + height)
      .lineTo(32 + width, y + height)
      .stroke();
    doc.x = 32;
    doc.y = y + height;
  };
  header();
  row(headings, true);
  rows.forEach((r) => row(r));
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc
      .fontSize(8)
      .fillColor('#666666')
      .text(`Page ${i + 1} / ${range.count}`, 32, doc.page.height - 28, { lineBreak: false });
  }
  doc.end();
  return {
    filename: `tuljai-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`,
    base64: (await output).toString('base64'),
    mimeType: 'application/pdf',
  };
}
