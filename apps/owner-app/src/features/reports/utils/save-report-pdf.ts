import type { BookingReportPdf } from '@tuljai/types';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export async function saveReportPdf(report: BookingReportPdf): Promise<void> {
  if (Platform.OS === 'web') {
    const bytes = Uint8Array.from(atob(report.base64), (char) => char.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = report.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return;
  }
  const file = new File(Paths.cache, report.filename);
  let shared = false;
  try {
    file.create({ overwrite: true });
    file.write(report.base64, { encoding: 'base64' });
    if (!(await Sharing.isAvailableAsync()))
      throw new Error('File sharing is unavailable on this device.');
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: 'Save or share your Tuljai Stays report',
    });
    shared = true;
  } finally {
    // Android can resolve the chooser before the receiving app reads its content URI.
    // Keep successful shares in the private OS cache until it is reclaimed or replaced.
    if (file.exists && (!shared || Platform.OS !== 'android')) file.delete();
  }
}
