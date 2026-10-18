import type { BookingGuestIdProofUpload } from '@tuljai/types';
import * as DocumentPicker from 'expo-document-picker';
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { uploadIdProof } from '../../core/booking';
import { useColors } from '../../design/theme';
import { radius, space } from '../../design/tokens';
import { useLang } from '../../i18n/language';
import { bookingStrings } from '../../i18n/strings';
import { Icon } from '../../ui/Icon';
import { PressableScale } from '../../ui/PressableScale';
import { Text } from '../../ui/Text';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

function resolveMimeType(fileName: string, supplied?: string): string | null {
  if (supplied && ALLOWED_TYPES.includes(supplied)) return supplied;
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'pdf') return 'application/pdf';
  return null;
}

/** Picks a government ID and uploads it straight away, so it is done long before the guest pays. */
export function IdProofPicker({
  error,
  onChange,
  onUploadingChange,
  value,
}: {
  error?: string | null;
  onChange: (upload: BookingGuestIdProofUpload | null) => void;
  onUploadingChange: (uploading: boolean) => void;
  value: BookingGuestIdProofUpload | null;
}) {
  const colors = useColors();
  const { t } = useLang();
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const pickerOpen = useRef(false);

  async function pick() {
    if (pickerOpen.current || uploading) return;
    pickerOpen.current = true;
    setLocalError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: Platform.OS === 'android' ? '*/*' : ALLOWED_TYPES,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;
      const mimeType = resolveMimeType(asset.name, asset.mimeType);
      if (!mimeType) {
        setLocalError(t(bookingStrings.idUnsupported));
        return;
      }
      if (asset.size && asset.size > MAX_SIZE_BYTES) {
        setLocalError(t(bookingStrings.idTooLarge));
        return;
      }
      setUploading(true);
      onUploadingChange(true);
      onChange(null);
      const uploaded = await uploadIdProof({
        mimeType,
        name: asset.name,
        sizeBytes: asset.size,
        uri: asset.uri,
      });
      onChange(uploaded);
    } catch (cause) {
      onChange(null);
      setLocalError(cause instanceof Error ? cause.message : t(bookingStrings.idMissing));
    } finally {
      setUploading(false);
      onUploadingChange(false);
      pickerOpen.current = false;
    }
  }

  const shownError = localError ?? error ?? null;

  return (
    <View style={styles.wrap}>
      <Text color="inkMuted" variant="label">
        {t(bookingStrings.idTitle)}
      </Text>
      <PressableScale
        accessibilityLabel={t(value ? bookingStrings.idReplace : bookingStrings.idUpload)}
        style={[
          styles.box,
          {
            backgroundColor: colors.surface,
            borderColor: shownError ? colors.danger : value ? colors.success : colors.line,
          },
        ]}
        onPress={() => void pick()}
      >
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          {uploading ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Icon
              color={value ? 'success' : 'primary'}
              name={value ? 'check' : 'upload'}
              size={20}
            />
          )}
        </View>
        <View style={styles.copy}>
          <Text numberOfLines={1} variant="label">
            {uploading
              ? t(bookingStrings.idUploading)
              : value
                ? value.originalName
                : t(bookingStrings.idUpload)}
          </Text>
          <Text color="inkMuted" variant="caption">
            {value && !uploading ? t(bookingStrings.idReplace) : t(bookingStrings.idHint)}
          </Text>
        </View>
      </PressableScale>
      {shownError ? (
        <Text color="danger" variant="caption">
          {shownError}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: space.md,
    padding: space.lg,
  },
  copy: { flex: 1, gap: 2 },
  icon: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  wrap: { gap: space.xs },
});
