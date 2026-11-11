import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

export interface BookingPassDetails {
  bookingCode: string;
  guestName: string;
  lodgeName: string;
  address: string;
  checkIn: string;
  checkOut: string;
  room: string;
  guests: number;
  amount: string;
  paymentStatus: string;
  paymentMethod: string;
  instructions: string;
  support: string;
  bookingUrl?: string;
  qrPayload: string;
}

const assets = join(__dirname, '../../assets/booking-pass');
export function passLogo(): Buffer {
  return readFileSync(join(assets, 'logo.png'));
}
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );

export function bookingPassRows(pass: BookingPassDetails): Array<[string, string]> {
  return [
    ['Booking ID', pass.bookingCode],
    ['Lodge', pass.lodgeName],
    ['Address', pass.address],
    ['Check-in (IST)', pass.checkIn],
    ['Check-out (IST)', pass.checkOut],
    ['Room', pass.room],
    ['Guests', String(pass.guests)],
    ['Rooms', '1'],
    ['Total booking amount', pass.amount],
    ['Payment status', pass.paymentStatus],
    ['Payment method', pass.paymentMethod],
  ];
}

export function confirmationEmail(pass: BookingPassDetails): { html: string; text: string } {
  const rows = bookingPassRows(pass);
  const bookingUrl =
    pass.bookingUrl && /^https:\/\//u.test(pass.bookingUrl) ? pass.bookingUrl : undefined;
  const text = `Tuljai Stays\nBooking confirmed\nHello ${pass.guestName},\n\n${rows.map(([label, value]) => `${label}: ${value}`).join('\n')}\n\nCheck-in instructions\n${pass.instructions}\n\n${pass.support}\nKeep this pass private. The lodge verifies the current booking status at check-in.${bookingUrl ? `\nView booking: ${bookingUrl}` : ''}`;
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"></head>
  <body style="margin:0;background:#fff8ef;font-family:Arial,sans-serif;color:#30251f">
  <div style="display:none;max-height:0;overflow:hidden">Your stay is confirmed. Your QR booking pass is attached.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:20px 10px">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #eddfd1;border-radius:16px;overflow:hidden">
  <tr><td style="background:#641c32;color:white;padding:24px"><img src="cid:tuljai-logo" width="48" height="48" alt="Tuljai Stays" style="vertical-align:middle;border-radius:10px"> <span style="font-size:26px;font-weight:bold">Tuljai Stays</span><div style="margin-top:10px;color:#ffd197">A peaceful stay for your pilgrimage</div></td></tr>
  <tr><td style="padding:24px"><div style="color:#16804a;font-size:13px;font-weight:bold;letter-spacing:1px">BOOKING CONFIRMED</div>
  <h1 style="font-size:24px;margin:12px 0">Your stay is reserved.</h1><p>Hello ${escapeHtml(pass.guestName)},</p><p>Your booking is confirmed. Keep the attached digital pass ready for check-in.</p>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows.map(([label, value]) => `<tr><td style="padding:10px 8px 10px 0;border-bottom:1px solid #f1e6db;color:#77675d;vertical-align:top;width:40%;font-size:14px">${escapeHtml(label)}</td><td style="padding:10px 0;border-bottom:1px solid #f1e6db;font-size:14px;overflow-wrap:anywhere">${escapeHtml(value)}</td></tr>`).join('')}</table>
  <div style="text-align:center;padding:24px 0"><img src="cid:booking-qr" alt="QR check-in pass - also attached as PDF" width="220" height="220" style="max-width:100%;height:auto"><div style="font-size:13px;color:#77675d">Present this pass and your original ID at the lodge.</div></div>
  ${bookingUrl ? `<p style="text-align:center"><a href="${escapeHtml(bookingUrl)}" style="display:inline-block;background:#641c32;color:white;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:bold">View booking</a></p>` : ''}
  <h2 style="font-size:17px;color:#641c32">Before you arrive</h2><p style="font-size:14px;line-height:1.7;white-space:pre-line">${escapeHtml(pass.instructions)}</p>
  <p style="font-size:13px;line-height:1.7;color:#77675d">${escapeHtml(pass.support)}</p></td></tr>
  <tr><td style="padding:20px 24px;border-top:3px solid #e89236;background:#fff8ef;font-size:12px;line-height:1.6;color:#77675d">Keep your QR pass private. Check-in is subject to the current booking status. A cancelled booking or a used pass cannot be used for another check-in.<br>Tuljai Stays · Booking confirmation</td></tr>
  </table></td></tr></table></body></html>`;
  return { html, text };
}

export async function generateBookingPass(
  pass: BookingPassDetails,
): Promise<{ pdf: Buffer; qr: Buffer }> {
  const qr = await QRCode.toBuffer(pass.qrPayload, {
    errorCorrectionLevel: 'M',
    margin: 4,
    width: 800,
  });
  const doc = new PDFDocument({
    size: 'A4',
    margin: 42,
    info: { Title: `Tuljai Stays - ${pass.bookingCode}`, Author: 'Tuljai Stays' },
  });
  const chunks: Buffer[] = [];
  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  doc.registerFont('Mukta', join(assets, 'Mukta-Regular.ttf')).font('Mukta');
  const header = () => {
    doc.rect(0, 0, 596, 115).fill('#641c32');
    doc.image(passLogo(), 42, 28, { width: 54, height: 54 });
    doc.fillColor('#ffffff').fontSize(28).text('Tuljai Stays', 112, 28);
    doc.fillColor('#ffd197').fontSize(12).text('DIGITAL BOOKING PASS', 112, 66);
    doc.y = 139;
    doc.x = 42;
  };
  header();
  doc.fillColor('#16804a').fontSize(15).text('BOOKING CONFIRMED');
  doc.fillColor('#30251f').fontSize(20).text(pass.guestName, { width: 510 });
  doc.moveDown(0.4);
  for (const [label, value] of bookingPassRows(pass)) {
    const height = Math.max(doc.fontSize(11).heightOfString(value, { width: 340 }), 16) + 5;
    if (doc.y + height > 545) {
      doc.addPage();
      header();
    }
    const y = doc.y;
    doc.fillColor('#77675d').text(label, 42, y, { width: 155 });
    doc.fillColor('#30251f').text(value, 205, y, { width: 345 });
    doc.y = y + height;
  }
  if (doc.y > 550) {
    doc.addPage();
    header();
  }
  const qrY = doc.y + 10;
  doc.moveTo(42, qrY).lineTo(553, qrY).dash(4).strokeColor('#dfb68d').stroke().undash();
  doc.image(qr, 42, qrY + 14, { width: 175 });
  doc
    .fillColor('#641c32')
    .fontSize(17)
    .text('Your check-in pass', 237, qrY + 22, { width: 310 });
  doc
    .fillColor('#30251f')
    .fontSize(12)
    .text(
      'Present this QR and your original photo ID at the lodge.\n\nThe owner scans this same secure pass in Tuljai Stays. Current booking status and one-time check-in rules apply.',
      237,
      qrY + 56,
      { width: 305 },
    );
  doc.y = qrY + 195;
  doc.x = 42;
  doc.fillColor('#641c32').fontSize(14).text('Before you arrive');
  doc.fillColor('#30251f').fontSize(11).text(pass.instructions, { width: 510 });
  doc
    .moveDown(0.5)
    .fillColor('#77675d')
    .fontSize(10)
    .text(
      `${pass.support}\nKeep this pass private. Cancelled bookings and used passes are not valid for another check-in.`,
      { width: 510 },
    );
  doc.end();
  return { pdf: await completed, qr };
}
