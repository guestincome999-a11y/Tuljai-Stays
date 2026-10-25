import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, IconButton, Searchbar, Surface, Text, useTheme } from 'react-native-paper';

import { pilgrimRadius, pilgrimSpacing } from '../theme/pilgrim-theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function AppHeader({
  eyebrow,
  title,
  subtitle,
  actionIcon,
  actionLabel,
  badgeCount = 0,
  onAction,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actionIcon?: IconName;
  actionLabel?: string;
  badgeCount?: number;
  onAction?: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        {eyebrow ? (
          <Text style={{ color: theme.colors.primary }} variant="labelLarge">
            {eyebrow}
          </Text>
        ) : null}
        <Text numberOfLines={1} variant="headlineSmall">
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodyMedium">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actionIcon && onAction ? (
        <View style={styles.actionWrap}>
          <IconButton
            accessibilityLabel={actionLabel}
            icon={actionIcon}
            mode="contained-tonal"
            onPress={onAction}
            size={22}
          />
          {badgeCount > 0 ? (
            <View style={[styles.badge, { backgroundColor: theme.colors.secondary }]}>
              <Text style={{ color: theme.colors.onSecondary }} variant="labelSmall">
                {badgeCount > 9 ? '9+' : badgeCount}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function PrimaryButton(props: ComponentProps<typeof Button>) {
  return <Button contentStyle={styles.buttonContent} mode="contained" {...props} />;
}

export function SecondaryButton(props: ComponentProps<typeof Button>) {
  return <Button contentStyle={styles.buttonContent} mode="contained-tonal" {...props} />;
}

export function PilgrimSearchBar(props: ComponentProps<typeof Searchbar>) {
  const theme = useTheme();
  return (
    <Searchbar
      elevation={0}
      iconColor={theme.colors.primary}
      inputStyle={styles.searchInput}
      style={[styles.search, { borderColor: theme.colors.outlineVariant }, props.style]}
      {...props}
    />
  );
}

export function SectionHeading({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle} variant="titleLarge">
        {title}
      </Text>
      {actionLabel && onAction ? <Button onPress={onAction}>{actionLabel}</Button> : null}
    </View>
  );
}

export function StateCard({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: IconName;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const theme = useTheme();
  return (
    <Surface elevation={0} style={[styles.state, { borderColor: theme.colors.outlineVariant }]}>
      <View style={[styles.stateIcon, { backgroundColor: theme.colors.primaryContainer }]}>
        <MaterialCommunityIcons color={theme.colors.primary} name={icon} size={24} />
      </View>
      <View style={styles.stateCopy}>
        <Text variant="titleMedium">{title}</Text>
        <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodyMedium">
          {description}
        </Text>
      </View>
      {actionLabel && onAction ? (
        <SecondaryButton onPress={onAction}>{actionLabel}</SecondaryButton>
      ) : null}
    </Surface>
  );
}

export function LoadingSkeleton({ children }: { children?: ReactNode }) {
  const theme = useTheme();
  return (
    <View accessibilityLabel="Loading content" style={styles.skeletonGroup}>
      {children ?? (
        <>
          <View style={[styles.skeletonHero, { backgroundColor: theme.colors.surfaceVariant }]} />
          <View style={[styles.skeletonLine, { backgroundColor: theme.colors.surfaceVariant }]} />
          <View
            style={[styles.skeletonLineShort, { backgroundColor: theme.colors.surfaceVariant }]}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actionWrap: { position: 'relative' },
  badge: {
    alignItems: 'center',
    borderRadius: pilgrimRadius.full,
    height: 20,
    justifyContent: 'center',
    minWidth: 20,
    paddingHorizontal: 4,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  buttonContent: { minHeight: 48 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: pilgrimSpacing.lg,
    justifyContent: 'space-between',
  },
  headerCopy: { flex: 1, gap: 2, minWidth: 0 },
  search: { borderRadius: pilgrimRadius.lg, borderWidth: 1 },
  searchInput: { minHeight: 48 },
  sectionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: { flex: 1 },
  skeletonGroup: { gap: pilgrimSpacing.sm },
  skeletonHero: { borderRadius: pilgrimRadius.lg, height: 176 },
  skeletonLine: { borderRadius: pilgrimRadius.full, height: 18, width: '80%' },
  skeletonLineShort: { borderRadius: pilgrimRadius.full, height: 14, width: '52%' },
  state: {
    alignItems: 'flex-start',
    borderRadius: pilgrimRadius.lg,
    borderWidth: 1,
    gap: pilgrimSpacing.md,
    padding: pilgrimSpacing.lg,
  },
  stateCopy: { gap: pilgrimSpacing.xs },
  stateIcon: {
    alignItems: 'center',
    borderRadius: pilgrimRadius.md,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
});
