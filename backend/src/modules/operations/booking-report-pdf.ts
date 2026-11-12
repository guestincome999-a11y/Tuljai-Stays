import { join } from 'node:path';

import type { BookingReportRow } from '@tuljai/types';
import PDFDocument from 'pdfkit';

const assets = join(__dirname, 'report-assets', 'assets');
const colors = {
  maroon: '#6b1a2b',
  gold: '#b8862f',
  cream: '#fbf7f0',
  card: '#f6eedd',
  shade: '#f8f2e6',
  line: '#e6dccb',
  ink: '#2b2b2b',
  gray: '#6a6a6a',
  navy: '#1f3a5f',
};
const widths = [24, 61, 77, 107, 60, 56, 55, 39, 64, 46, 74, 75, 48];
const headings = [
  'Sr.',
  'Booking ID',
  'Guest Name',
  'Lodge Name',
  'Room Type',
  'Check-in Date',
  'Check-out Date',
  'Nights',
  'Booking\nAmount (INR)',
  'Commission\nRate',
  'Commission\nAmount (INR)',
  'Payment Mode',
  'Stay Status',
];
const money = (value: number) =>
  `₹ ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const amount = (value: string | null | undefined) => Number(value ?? 0);
const date = (value: string) =>
  new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

/** Recreates the supplied template's point-based geometry with its original assets and fonts. */
export async function buildBookingReportPdf(
  rows: BookingReportRow[],
  startDate: string,
  endDate: string,
  reportType: 'all' | 'completed' = 'completed',
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: [842, 790],
    margin: 0,
    bufferPages: true,
    info: { Title: 'Bookings & Commission Report - Tuljai Stays', Author: 'Tuljai Stays' },
  });
  const chunks: Buffer[] = [];
  const output = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  doc.registerFont('sans', join(assets, 'fonts/DejaVuSans.ttf'));
  doc.registerFont('bold', join(assets, 'fonts/DejaVuSans-Bold.ttf'));
  doc.registerFont('serif', join(assets, 'fonts/DejaVuSerif-Bold.ttf'));
  doc.registerFont('italic', join(assets, 'fonts/DejaVuSerif-Italic.ttf'));
  function text(
    value: string,
    x: number,
    y: number,
    width: number,
    size = 8,
    font = 'sans',
    color = colors.ink,
    align: 'left' | 'right' | 'center' = 'left',
  ) {
    doc.font(font).fontSize(size);
    const measured = doc.widthOfString(value);
    if (measured > width) doc.fontSize((size * width) / measured);
    doc.fillColor(color).text(value, x, y, { width, align, lineBreak: false });
  }
  function box(x: number, y: number, w: number, h: number, color: string, radius = 0) {
    doc.fillColor(color);
    if (radius) doc.roundedRect(x, y, w, h, radius).fill();
    else doc.rect(x, y, w, h).fill();
  }
  function line(x: number, y: number, w: number) {
    box(x, y, w, 0.7, colors.line);
  }
  function headerFooter() {
    box(0, 0, 842, 790, colors.cream);
    doc.image(join(assets, 'logo.jpg'), 28, 26.3, { width: 64.7, height: 64.7 });
    text('Tuljai Stays', 100, 40.4, 190, 25, 'serif', colors.maroon);
    doc.image(join(assets, 'tagline_marathi.png'), 96, 70.8, { width: 168, height: 25.2 });
    box(290, 46, 1, 40, colors.gold);
    text('Premium Stays Near', 302, 50.7, 180, 9, 'serif', colors.gold);
    text('Tulja Bhavani Temple', 302, 63.1, 180, 9, 'serif', colors.gold);
    box(302, 79.5, 78, 1, colors.gold);
    text('Shree Tulja Bhavani Mata', 580, 47.4, 234, 9, 'serif', colors.maroon, 'right');
    text('|| Jai Tuljabhavani ||', 580, 60.4, 234, 8.5, 'italic', colors.maroon, 'right');
    line(28, 97.4, 786);
    const y = 715;
    line(28, y, 786);
    doc.image(join(assets, 'logo.jpg'), 28.8, y + 4.2, { width: 36, height: 36 });
    text('Tuljai Stays', 72, y + 16.3, 105, 14, 'serif', colors.maroon);
    text('Comfort    •    Devotion    •    Together', 178, y + 19.3, 298, 9, 'italic', colors.gold);
    box(481, y + 5, 0.9, 34, colors.line);
    text('Tuljai Stays', 492, y + 8.2, 130, 9, 'sans', colors.gray);
    text('Tuljapur, Maharashtra, India', 492, y + 20.7, 130, 8, 'sans', colors.gray);
    box(624, y + 5, 0.9, 34, colors.line);
    doc.image(join(assets, 'signature.png'), 644, y + 6.8, { width: 106.5, height: 31.2 });
    box(0, 786, 842, 4, colors.gold);
  }
  function tableHeader(y: number) {
    box(28, y, 786, 26.5, colors.maroon, 5);
    let x = 28;
    headings.forEach((heading, i) => {
      const w = widths[i]!;
      heading.split('\n').forEach((part, j, parts) => {
        text(
          part,
          x + 2,
          y + (parts.length > 1 ? 5 : 9) + j * 7.6,
          w - 4,
          6.1,
          'bold',
          '#ffffff',
          [0, 5, 6, 7, 8, 9, 10].includes(i) ? 'center' : 'left',
        );
      });
      x += w;
    });
    return y + 26.5;
  }
  const totalAmount =
    rows.reduce((sum, row) => sum + Math.round(amount(row.totalAmount) * 100), 0) / 100;
  const totalCommission =
    rows.reduce((sum, row) => sum + Math.round(amount(row.commissionAmount) * 100), 0) / 100;
  const completed = rows.filter((row) => ['CHECKED_OUT', 'COMPLETED'].includes(row.status)).length;
  const period = `${date(startDate)} – ${date(endDate)}`;
  headerFooter();
  text(
    reportType === 'completed'
      ? 'Completed Bookings & Commission Report'
      : 'Bookings & Commission Report',
    28,
    110,
    530,
    21,
    'serif',
    colors.maroon,
  );
  text(
    reportType === 'completed'
      ? 'Booking Commission Summary (Fully Completed Stays)'
      : 'Booking Commission Summary (All Booking Statuses)',
    28,
    137.2,
    530,
    11.5,
    'sans',
    colors.navy,
  );
  text(period, 28, 162.6, 260, 8, 'sans', colors.gray);
  const generated = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  text(`Generated on: ${generated} IST`, 298, 162.6, 260, 8, 'sans', colors.gray);
  box(564, 98, 250, 65.6, colors.card, 8);
  const summary = [
    ['Report Type', reportType === 'completed' ? 'Completed Bookings (Full Stay)' : 'All Bookings'],
    ['Time Period', period],
    ['Total Bookings', String(rows.length)],
    ['Total Commission (INR)', money(totalCommission)],
  ];
  summary.forEach(([label, value], i) => {
    text(label!, 576, 107 + i * 14, 100, 7);
    text(value!, 676, 107 + i * 14, 128, 6.6, i === 3 ? 'bold' : 'sans');
  });
  const kpiY = 188.5;
  box(28, kpiY, 786, 39.5, colors.card, 6);
  const kpis = [
    ['▣', 'Total Bookings', String(rows.length)],
    ['₹', 'Total Booking Amount (INR)', money(totalAmount)],
    ['%', 'Total Commission (INR)', money(totalCommission)],
    ['⌂', 'Total Lodges', String(new Set(rows.map((r) => r.lodgeId)).size)],
    [
      '✓',
      'Fully Completed Stays',
      `${completed} (${rows.length ? Math.round((completed / rows.length) * 100) : 0}%)`,
    ],
  ];
  kpis.forEach(([icon, label, value], i) => {
    const x = 28 + 157.2 * i;
    if (i) box(x, kpiY + 5.75, 0.9, 28, colors.line);
    box(x + 8.7, kpiY + 9.3, 22, 22, '#f0ddb5', 11);
    text(icon!, x + 8.7, kpiY + 13, 22, 10, 'bold', colors.gold, 'center');
    text(label!, x + 38, kpiY + 9.2, 115, 7);
    text(value!, x + 38, kpiY + 21.5, 115, 10.5, 'bold', colors.maroon);
  });
  let y = tableHeader(239.5);
  function newTablePage() {
    doc.addPage();
    headerFooter();
    y = tableHeader(110);
  }
  rows.forEach((row, index) => {
    const values = [
      String(index + 1),
      row.bookingCode,
      row.guestName,
      row.lodgeName ?? 'Lodge unavailable',
      row.roomTypeName ?? '—',
      date(row.checkInDate),
      date(row.checkOutDate),
      String(
        Math.max(
          0,
          Math.round((Date.parse(row.checkOutDate) - Date.parse(row.checkInDate)) / 86_400_000),
        ),
      ),
      money(amount(row.totalAmount)),
      row.commissionType === 'FIXED_PER_BOOKING'
        ? 'Fixed'
        : row.commissionRatePercent != null
          ? `${Number(row.commissionRatePercent)}%`
          : '—',
      money(amount(row.commissionAmount)),
      row.paymentMode
        ? row.paymentMode.replaceAll('PAY_AT_LODGE', 'At lodge').replaceAll('ONLINE', 'Online')
        : row.paymentStatus === 'PAY_AT_LODGE'
          ? 'At lodge'
          : 'Not recorded',
      ['CHECKED_OUT', 'COMPLETED'].includes(row.status)
        ? 'Completed'
        : row.status.replaceAll('_', ' ').toLowerCase(),
    ];
    doc.font('sans').fontSize(6.6);
    const height = Math.max(
      24,
      ...values.map(
        (value, i) => doc.heightOfString(value, { width: widths[i]! - 8, lineGap: 0 }) + 10,
      ),
    );
    if (y + height > 703) newTablePage();
    if (index % 2) box(28, y, 786, height, colors.shade);
    let x = 28;
    values.forEach((value, i) => {
      doc
        .font('sans')
        .fontSize(6.6)
        .fillColor(colors.ink)
        .text(value, x + 4, y + 6, {
          width: widths[i]! - 8,
          height: height - 6,
          align: [8, 10].includes(i) ? 'right' : [0, 5, 6, 7, 9].includes(i) ? 'center' : 'left',
        });
      x += widths[i]!;
    });
    y += height;
    line(28, y, 786);
  });
  if (y + 30 > 703) newTablePage();
  box(28, y, 786, 26, colors.card, 6);
  text(`Total (All ${rows.length} Bookings)`, 50, y + 8, 465, 7.5, 'bold');
  text(money(totalAmount), 511, y + 8, 60, 7, 'bold', colors.ink, 'right');
  text(money(totalCommission), 621, y + 8, 70, 7, 'bold', colors.ink, 'right');
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    text(`Page ${i + 1} of ${range.count}`, 753, 746, 61, 6.3, 'sans', colors.gray, 'right');
  }
  doc.end();
  return output;
}
