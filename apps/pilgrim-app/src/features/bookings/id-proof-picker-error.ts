export const idProofPickerUnavailable = {
  en: 'No file picker is available on this device. Enable the Files app in Android Settings, then try uploading your ID again.',
  mr: 'या डिव्हाइसवर फाइल निवडता येत नाही. Android सेटिंग्जमध्ये Files अॅप सुरू करा आणि ओळखपत्र पुन्हा अपलोड करा.',
};

/** Also handles the wrapped native error from older Android builds. */
export function isIdProofPickerUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /ActivityNotFoundException|No Activity found to handle intent|No activity found to handle Intent/i.test(
    message,
  );
}
