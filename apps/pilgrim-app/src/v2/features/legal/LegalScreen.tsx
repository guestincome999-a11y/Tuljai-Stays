import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRemoteConfig } from '../../core/config';
import { useColors } from '../../design/theme';
import { gutter, radius, space } from '../../design/tokens';
import { LEGAL_OPERATOR_LINE, accountStrings } from '../../i18n/accountStrings';
import { useLang } from '../../i18n/language';
import { LEGAL_DOCUMENTS } from '../../legal/legalDocuments';
import type { LegalBlock, LegalDocumentKind } from '../../legal/legalDocuments';
import { Icon } from '../../ui/Icon';
import { PressableScale } from '../../ui/PressableScale';
import { Text } from '../../ui/Text';

function readOverride(value: unknown): LegalBlock[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const blocks: LegalBlock[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) return null;
    const { kind, text } = item as Partial<LegalBlock>;
    if (
      (kind !== 'bullet' && kind !== 'heading' && kind !== 'paragraph') ||
      typeof text !== 'string'
    ) {
      return null;
    }
    blocks.push({ kind, text });
  }
  return blocks;
}

/** Shows the admin-published version when there is one, otherwise the bundled text. */
export function LegalScreen({ kind, onBack }: { kind: LegalDocumentKind; onBack: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const { config } = useRemoteConfig();
  const blocks = useMemo(
    () => readOverride(config.settings[`legal_${kind}`]) ?? LEGAL_DOCUMENTS[kind],
    [config.settings, kind],
  );
  const title = kind === 'privacy' ? accountStrings.legalPrivacy : accountStrings.legalTerms;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
        <PressableScale
          accessibilityLabel="Back"
          pressedScale={0.92}
          style={[styles.back, { backgroundColor: colors.surface }]}
          onPress={onBack}
        >
          <Icon name="arrow-left" size={20} />
        </PressableScale>
        <Text variant="title">{t(title)}</Text>
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.huge }]}
        showsVerticalScrollIndicator={false}
      >
        <Text color="inkMuted" variant="caption">
          {LEGAL_OPERATOR_LINE} · {t(accountStrings.updatedOn)}
        </Text>
        {blocks.map((block, index) =>
          block.kind === 'heading' ? (
            <Text color="primary" key={index} style={styles.heading} variant="heading">
              {block.text}
            </Text>
          ) : block.kind === 'bullet' ? (
            <View key={index} style={styles.bullet}>
              <Icon color="accent" name="chevron-right" size={16} />
              <Text color="inkMuted" style={styles.bulletText}>
                {block.text}
              </Text>
            </View>
          ) : (
            <Text color="inkMuted" key={index}>
              {block.text}
            </Text>
          ),
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  bullet: { flexDirection: 'row', gap: space.sm },
  bulletText: { flex: 1 },
  content: { gap: space.md, paddingHorizontal: gutter, paddingTop: space.lg },
  header: { alignItems: 'center', flexDirection: 'row', gap: space.lg, paddingHorizontal: gutter },
  heading: { marginTop: space.md },
  screen: { flex: 1 },
});
